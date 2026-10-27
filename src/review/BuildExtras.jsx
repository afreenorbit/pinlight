import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { reviewParts } from "../../shared/review/catalog.js";

export function PartsImport({ disabled, onImport }) {
  const [text, setText] = useState(""),
    [note, setNote] = useState("");
  return (
    <details className="parts-import">
      <summary>Already have an AI-generated parts list?</summary>
      <label htmlFor="parts-list">Paste or dictate your list</label>
      <textarea
        id="parts-list"
        disabled={disabled}
        value={text}
        maxLength={3000}
        onChange={(e) => setText(e.target.value)}
        placeholder="Raspberry Pi 5, TMP36, MCP3008…"
      />
      <button
        className="button button-light"
        disabled={disabled || !text.trim()}
        onClick={() => {
          const normal = (s) =>
              s
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, " ")
                .trim(),
            value = ` ${normal(text)} `,
            matches = reviewParts.filter(
              (p) =>
                value.includes(` ${normal(p.id)} `) ||
                value.includes(` ${normal(p.name)} `) ||
                (p.id === "hcsr04" && value.includes(" hc sr04 ")),
            );
          const board = matches.find((p) =>
            ["raspberry-pi-5", "arduino-uno-r3"].includes(p.id),
          );
          const parts = matches
            .filter(
              (p) =>
                p !== board &&
                !["raspberry-pi-5", "arduino-uno-r3"].includes(p.id),
            )
            .map((p) => p.id);
          if (parts.length) {
            onImport({
              parts,
              missing: [],
              ...(board ? { board: board.id } : {}),
            });
            setNote(
              `Matched ${parts.length} supported parts. Check the selections below; unrecognised parts are not added.`,
            );
          } else
            setNote(
              "No exact supported part names found. Select parts below; unsupported parts need a separate source review.",
            );
        }}
      >
        Match supported parts <Icon name="check" size={14} />
      </button>
      {note && <p role="status">{note}</p>}
    </details>
  );
}
export function DownloadReview({ result, measurements }) {
  return (
    <button
      className="text-link"
      onClick={() => {
        const text = [
          `PINLIGHT BUILD REVIEW\n${result.input.goal}`,
          `Board: ${result.input.board}\nParts: ${result.input.parts.join(", ")}\nUnavailable: ${result.input.missing.join(", ") || "None marked"}`,
          `SUPPORTED CHECKS\n${result.checks.findings.map((f) => `${f.status.toUpperCase()}: ${f.title}\n${f.detail}`).join("\n\n")}`,
          `AI REVIEW\n${result.summary}\n${result.considerations.join("\n")}`,
          `QUESTIONS\n${result.questions.join("\n")}`,
          `SOURCES\n${result.evidence.map((e) => `${e.title}: ${e.url}`).join("\n")}`,
          `STUDENT-REPORTED OBSERVATIONS\n${measurements || "No physical measurements recorded."}`,
          `This is a pre-build review, not proof of physical operation. Generated ${result.createdAt}`,
        ].join("\n\n");
        const url = URL.createObjectURL(
            new Blob([text], { type: "text/plain;charset=utf-8" }),
          ),
          link = document.createElement("a");
        link.href = url;
        link.download = "pinlight-build-review.txt";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      Export review <Icon name="download" size={16} />
    </button>
  );
}
