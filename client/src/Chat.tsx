import { useEffect, useState } from "react";
import { getScenarios, postChat, type Correction, type Scenario } from "./api";

interface Turn {
  role: "user" | "assistant";
  text: string;
  correction?: Correction;
}

export function Chat({ onClose }: { onClose: () => void }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScenarios().then((s) => setScenarios(s.scenarios)).catch((e: Error) => setError(e.message));
  }, []);

  const start = (s: Scenario) => {
    setScenario(s);
    setConversationId(undefined);
    setTurns([{ role: "assistant", text: s.opener }]);
  };

  const send = async () => {
    const text = input.trim();
    if (!scenario || !text || busy) return;
    setInput("");
    setBusy(true);
    setError(null);
    setTurns((t) => [...t, { role: "user", text }]);
    try {
      const r = await postChat(scenario.id, text, conversationId);
      setConversationId(r.conversationId);
      setTurns((t) => {
        const copy = [...t];
        copy[copy.length - 1] = { role: "user", text, correction: r.correction };
        return [...copy, { role: "assistant", text: r.reply }];
      });
    } catch (e) {
      setError((e as Error).message);
      setTurns((t) => t.slice(0, -1));
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  if (!scenario) {
    return (
      <div>
        <h2>Choose a mission</h2>
        {scenarios.map((s) => (
          <button key={s.id} className="mission" onClick={() => start(s)}>
            <strong>{s.title}</strong>
            <span>{s.description}</span>
          </button>
        ))}
        {error && <p className="error">{error}</p>}
        <button onClick={onClose}>Back</button>
      </div>
    );
  }

  return (
    <div>
      <h2>{scenario.title}</h2>
      <div className="chat">
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            <p>{t.text}</p>
            {t.correction && <CorrectionView c={t.correction} />}
          </div>
        ))}
        {busy && <p className="bubble assistant">…</p>}
      </div>
      {error && <p className="error">{error}</p>}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Write in English…" maxLength={1000} />
        <button className="primary" disabled={busy || !input.trim()}>Send</button>
      </form>
      <button onClick={onClose}>End mission</button>
    </div>
  );
}

function CorrectionView({ c }: { c: Correction }) {
  if (!c.errors.length) return <small className="ok">✓ Looks good! Natural: “{c.natural}”</small>;
  return (
    <div className="correction">
      <div>✏️ {c.corrected}</div>
      <div>💬 {c.natural}</div>
      <small>{c.explanation_es}</small>
      <small>Saved {c.errors.length} mistake(s) as review cards.</small>
    </div>
  );
}
