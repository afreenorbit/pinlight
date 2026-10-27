import { useEffect, useState } from "react";
import { apiRequest, post } from "../lib/api.js";
import Icon from "../components/Icon.jsx";
let pendingSave;
export default function SavedWork() {
  const [rows, setRows] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pending = sessionStorage.getItem("pinlight-pending-save");
        if (pending) {
          const draft = JSON.parse(pending);
          pendingSave ??= post("/review/records", draft)
            .then(() => sessionStorage.removeItem("pinlight-pending-save"))
            .finally(() => {
              pendingSave = null;
            });
          await pendingSave;
        }
        const data = await apiRequest("/review/records");
        if (alive) setRows(data);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="desk-group">
      <div className="desk-group-heading">
        <span className="eyebrow">BUILD REVIEWS & PRACTICE</span>
        <span>{rows.length}</span>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="saved-review-list">
        {rows.map((row) => (
          <article key={row.id}>
            <small>
              {row.kind.toUpperCase()} ·{" "}
              {new Date(row.updated_at).toLocaleDateString()}
            </small>
            <details>
              <summary>{row.title}</summary>
              {row.kind === "build" ? (
                <>
                  <p>{row.payload.summary}</p>
                  <p>{row.payload.considerations?.join("\n")}</p>
                  <a className="text-link" href={`/build?saved=${row.id}`}>
                    Reopen the plan <Icon name="arrow" size={16} />
                  </a>
                </>
              ) : row.kind === "viva" ? (
                <>
                  {row.payload.pdf&&<p>PDF: {row.payload.pdf.name} · {row.payload.pdf.pages} pages</p>}
                  {row.payload.current?.question&&<p>Next question: {row.payload.current.question}</p>}
                  {row.payload.turns?.map((t, i) => (
                    <div key={i}>
                      <p>
                        <strong>{t.question}</strong>
                      </p>
                      <p>Your answer: {t.answer}</p>
                      <p>{t.feedback}</p>{Number.isFinite(t.score)&&<strong>{t.score}/10</strong>}{t.referenceAnswer&&<p>Reference answer: {t.referenceAnswer}</p>}
                    </div>
                  ))}
                </>
              ) : (
                <div><p>
                  Answer: {row.payload.answer} ·{" "}
                  {row.payload.result?.correct
                    ? "Matches the answer key"
                    : "Review this question again"}
                </p></div>
              )}
            </details>
          </article>
        ))}
      </div>
      {!rows.length && !error && (
        <p>
          Saved build reviews, viva conversations and practice answers will
          appear here.
        </p>
      )}
    </div>
  );
}
