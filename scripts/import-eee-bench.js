import { mkdir, writeFile } from "node:fs/promises";
// Keep answers server-side and a disjoint evaluation slice out of the practice UI.
const root = new URL("../server/review/data/", import.meta.url),
  publicRoot = new URL("../public/eee-bench/", import.meta.url);
await mkdir(root, { recursive: true });
await mkdir(publicRoot, { recursive: true });
const response = await fetch(
  "https://datasets-server.huggingface.co/rows?dataset=afdsafas/EEE-Bench&config=default&split=test&offset=0&length=40",
);
if (!response.ok) throw Error(`Dataset request failed: ${response.status}`);
const { rows } = await response.json(),
  items = [];
for (const { row_idx, row } of rows) {
  const image = await fetch(row.image.src);
  if (!image.ok) throw Error("Dataset image download failed.");
  const bytes = Buffer.from(await image.arrayBuffer()),
    id = `eee-${row_idx}`;
  const item = {
    id,
    index: row_idx,
    problem: row.problem,
    solution: row.solution,
    image: `/eee-bench/${id}.jpg`,
    source: "https://huggingface.co/datasets/afdsafas/EEE-Bench",
    split: row_idx < 24 ? "practice" : "evaluation",
  };
  await writeFile(
    new URL(`${id}.jpg`, row_idx < 24 ? publicRoot : root),
    bytes,
  );
  items.push(item);
}
await writeFile(
  new URL("questions.json", root),
  JSON.stringify(items, null, 2),
);
await writeFile(
  new URL("NOTICE.txt", publicRoot),
  "EEE-Bench by the dataset authors. Dataset card declares MIT licence. Source: https://huggingface.co/datasets/afdsafas/EEE-Bench\nQuestions and images are unchanged; practice/evaluation partition is Pinlight-specific, not an official split.\n",
);
console.log(
  `Imported ${items.length} questions: 24 practice, 16 held out. Answers remain server-side.`,
);
