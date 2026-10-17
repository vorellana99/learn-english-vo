import { useState } from "react";
import { savePhrase, type MissionSummary as Data } from "./api";
import { sound } from "./sound";
import { Translate } from "./Translate";
import { canSpeak, speak } from "./speech";

interface Props {
  data: Data;
  onRetryNoHelp: () => void;
  onMissions: () => void;
  onHome: () => void;
}

function Comparison({ data }: { data: Data }) {
  const { stats, previous } = data;
  if (!previous) return null;
  const was = previous.errorsPerMessage;
  const now = stats.errorsPerMessage;
  const delta = was === 0 ? null : Math.round(((was - now) / was) * 100);
  return (
    <p className="muted">
      Previous run ({previous.noHelpRun ? "without help" : "with help"}): {was} mistakes per answer, {previous.unaided}/{previous.messages} unaided.
      {delta !== null && (
        <strong className={delta >= 0 ? "good" : "bad"}> {delta >= 0 ? `${delta}% fewer mistakes now` : `${-delta}% more mistakes now`}.</strong>
      )}
    </p>
  );
}

export function MissionSummary({ data, onRetryNoHelp, onMissions, onHome }: Props) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const { summary, stats } = data;

  const save = async (front: string, back: string) => {
    setError(null);
    try {
      await savePhrase(front, back);
      setSaved((s) => new Set(s).add(front));
      sound.play("correct");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="report">
      <div className="card">
        <p className="eyebrow">Mission summary{stats.noHelpRun ? " · no help" : ""}</p>
        <p>{summary.summary_es}</p>
        <div className="tiles">
          <div className="tile"><strong>{stats.messages}</strong><small>answers</small></div>
          <div className="tile"><strong>{stats.errorsPerMessage}</strong><small>mistakes / answer</small></div>
          <div className="tile"><strong>{stats.unaided}/{stats.messages}</strong><small>without help</small></div>
        </div>
        <Comparison data={data} />
      </div>

      {summary.tips.length > 0 && (
        <div className="card">
          <h3>Tips</h3>
          <ul>{summary.tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      {summary.new_phrases.length > 0 && (
        <div className="card">
          <h3>Phrases worth keeping</h3>
          {summary.new_phrases.map((p) => (
            <div key={p.text} className="phrase-row">
              <div>
                <strong>{p.text}</strong>
              </div>
              <div className="mini-actions">
                <Translate es={p.translation_es} />
                {canSpeak() && <button className="mini" aria-label="Listen" onClick={() => speak(p.text)}>🔈</button>}
                <button className="mini" disabled={saved.has(p.text)} onClick={() => void save(p.text, p.translation_es)}>
                  {saved.has(p.text) ? "✓ Saved" : "💾 Save"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3>Your conversation, said more naturally</h3>
        {summary.rewritten.map((r, i) => (
          <div key={i} className="rewrite">
            <p className="muted q-line">🧑‍💼 {r.question} <Translate es={r.question_es} /></p>
            <p className="yours">{r.yours}</p>
            <p className="better">{r.better}</p>
            <div className="mini-actions">
              <Translate es={r.better_es} />
              {canSpeak() && <button className="mini" onClick={() => speak(r.better)}>🔈 Listen</button>}
              <button className="mini" disabled={saved.has(r.better)} onClick={() => void save(r.better, r.yours)}>
                {saved.has(r.better) ? "✓ Saved" : "💾 Save"}
              </button>
            </div>
          </div>
        ))}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="answer-actions">
        <button className="chip big" onClick={onRetryNoHelp}>🚫 Retry without help</button>
        <button className="chip big" onClick={onMissions}>Other missions</button>
        <button className="primary" onClick={onHome}>Home</button>
      </div>
    </section>
  );
}
