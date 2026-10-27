import { readFile } from "node:fs/promises";
let cached;
export async function practiceQuestions() {
  if (!cached) {
    try {
      cached = JSON.parse(
        await readFile(
          new URL("./data/questions.json", import.meta.url),
          "utf8",
        ),
      );
    } catch {
      return [];
    }
  }
  return cached.filter((q) => q.split === "practice");
}
export function normaliseAnswer(value) {
  return String(value)
    .trim()
    .replace(/^option\s+/i, "")
    .replace(/[.\s]+$/, "")
    .toUpperCase();
}
export async function gradePractice(id, answer) {
  const q = (await practiceQuestions()).find((q) => q.id === id);
  if (!q) throw Object.assign(Error("Question not found."), { status: 404 });
  return {
    correct: normaliseAnswer(answer) === normaliseAnswer(q.solution),
    expected: q.solution,
    source: q.source,
    note: "Compared with the published answer label. This does not grade your reasoning.",
  };
}
