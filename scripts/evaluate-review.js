import { readFile, writeFile, mkdir } from "node:fs/promises";
import { normaliseAnswer } from "../server/review/practice.js";
// Explicit vision transcription is needed; text-only Groq models cannot inspect diagrams.
if (!process.env.GROQ_API_KEY || !process.env.GROQ_VISION_MODEL)
  throw Error(
    "Configure GROQ_API_KEY and GROQ_VISION_MODEL for image-based evaluation.",
  );
const questions = JSON.parse(
  await readFile(
    new URL("../server/review/data/questions.json", import.meta.url),
    "utf8",
  ),
).filter((q) => q.split === "evaluation");
const count = Math.min(questions.length, Number(process.env.EVAL_COUNT || 3));
const call = async (model, messages) => {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, messages, temperature: 0, max_tokens: 1800 }),
    signal: AbortSignal.timeout(45000),
  });
  if (!r.ok) throw Error(`Evaluation provider returned ${r.status}`);
  return (await r.json()).choices[0].message.content;
};
const results = [];
for (const q of questions.slice(0, count)) {
  const start = Date.now(),
    bytes = await readFile(
      new URL(`../server/review/data/${q.id}.jpg`, import.meta.url),
    );
  const description = await call(process.env.GROQ_VISION_MODEL, [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Describe the circuit diagram exactly: all labels, values, node connectivity and polarities. Mark unreadable details. Do not answer the question.",
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${bytes.toString("base64")}`,
          },
        },
      ],
    },
  ]);
  const messages = [
    {
      role: "system",
      content:
        "Solve the electronics question. End with FINAL: followed only by the option letter or numerical answer. If the circuit description is insufficient, say FINAL: UNKNOWN.",
    },
    {
      role: "user",
      content: JSON.stringify({
        question: q.problem,
        diagramDescription: description,
      }),
    },
  ];
  const draft = await call(
    process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    messages,
  );
  const reviewed = await call(
    process.env.GROQ_REVIEW_MODEL || "openai/gpt-oss-20b",
    [
      ...messages,
      { role: "assistant", content: draft },
      {
        role: "user",
        content:
          "Check the reasoning critically, correct errors, and end with FINAL: and the answer.",
      },
    ],
  );
  const answer = (s) =>
    normaliseAnswer(s.match(/FINAL:\s*([^\n]+)/i)?.[1] || "UNKNOWN");
  results.push({
    id: q.id,
    expected: q.solution,
    draft: answer(draft),
    reviewed: answer(reviewed),
    draftCorrect: answer(draft) === normaliseAnswer(q.solution),
    reviewCorrect: answer(reviewed) === normaliseAnswer(q.solution),
    elapsedMs: Date.now() - start,
  });
  // Keep within free-tier token budgets; abort on quota errors rather than retrying indefinitely.
  console.log(
    `${q.id}: planner ${results.at(-1).draftCorrect}, reviewer ${results.at(-1).reviewCorrect}`,
  );
}
const report = {
  createdAt: new Date().toISOString(),
  scope:
    "Small held-out EEE-Bench sample. Includes vision transcription; not a hardware validation score.",
  models: {
    vision: process.env.GROQ_VISION_MODEL,
    planner: process.env.GROQ_MODEL,
    reviewer: process.env.GROQ_REVIEW_MODEL || "openai/gpt-oss-20b",
  },
  results,
};
await mkdir(new URL("../output/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../output/eee-evaluation.json", import.meta.url),
  JSON.stringify(report, null, 2),
);
console.log("Saved output/eee-evaluation.json");
