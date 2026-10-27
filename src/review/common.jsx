import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import LearningVoice from "../learning/LearningVoice.jsx";
import { apiRequest, post } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import "../review/review.css";

export function Workspace({ number, title, description, children, actions }) {
 const {user,ready}=useAuth();
  return (
    <section className="review-workspace section-wrap">
      <header className="review-heading">
        <div>
          <div className="eyebrow">
            <span className="review-index">{number}</span> YOUR ELECTRONICS
            WORKBENCH
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions || (ready && !user && (
          <span className="guest-chip">
            <Icon name="play" size={14} /> Try freely. Sign in to save.
          </span>
        ))}
      </header>
      {children}
    </section>
  );
}
export function Notice({ error, children }) {
  return children ? (
    <div
      className={`review-notice ${error ? "is-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  ) : null;
}
export function DictationHint() {
  return (
    <p className="review-hint">
      <Icon name="mic" size={14} /> Focus a field and use your configured Wispr
      keys to dictate.
    </p>
  );
}
let voiceStatus;
export function VoiceOutput({ text, inputId = "review-answer" }) {
  const voice = useRef(null),
    [configured, setConfigured] = useState(false),
    [enabled, setEnabled] = useState(false);
  useEffect(() => {
    voiceStatus ??= apiRequest("/learning/status").catch(() => {
      voiceStatus = null;
      return null;
    });
    let alive = true;
    voiceStatus.then((s) => {
      if (alive) setConfigured(!!s?.voice?.configured);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className="review-voice">
      <LearningVoice
        ref={voice}
        context={{
          boardId: "raspberry-pi-5",
          mode: "walkthrough",
          component: "gpio",
          experimentId: "first-light",
          step: 0,
        }}
        configured={configured}
        onEnabledChange={setEnabled}
        inputId={inputId}
      />
      {enabled && text && (
        <button
          className="text-link"
          onClick={() => voice.current?.speak(text)}
        >
          Read aloud <Icon name="play" size={14} />
        </button>
      )}
      {!configured && (
        <small>
          Voice is unavailable right now. You can still read, type or dictate.
        </small>
      )}
    </div>
  );
}
export function SaveButton({ title, kind, payload }) {
  const { user } = useAuth(),
    [state, setState] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="save-control">
      {user ? (
        <button
          className="button button-dark"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setState("");
            try {
              await post("/review/records", { title, kind, payload });
              setState("Saved to My desk.");
            } catch (e) {
              setState(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="check" size={16} />
          {busy ? "Saving…" : "Save to my desk"}
        </button>
      ) : (
        <a
          className="button button-light"
          href="/signin"
          onClick={() => {
            try {
              sessionStorage.setItem(
                "pinlight-pending-save",
                JSON.stringify({ title, kind, payload }),
              );
            } catch {}
          }}
        >
          Sign in to save <Icon name="diagonal" size={16} />
        </a>
      )}
      {state && <small role="status">{state}</small>}
    </div>
  );
}
export function Sources({ items = [] }) {
  return (
    <div className="review-sources">
      {items.map((e, i) => (
        <div key={`${e.id}-${i}`}>
          {e.url ? (
            <a href={e.url} target="_blank" rel="noreferrer">
              {e.title || e.id}
              <Icon name="diagonal" size={12} />
            </a>
          ) : (
            <span>{e.page ? `PDF page ${e.page}` : e.id}</span>
          )}
        </div>
      ))}
    </div>
  );
}
