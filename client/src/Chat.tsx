import { useEffect, useRef, useState } from "react";
import { getScenarios, postChat, type Correction, type Scenario } from "./api";
import { sound } from "./sound";
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listener } from "./speech";

interface Turn {
  role: "user" | "assistant";
  text: string;
  correction?: Correction;
  /** Speech-recognition confidence (0-1) when the message was dictated. */
  clarity?: number | null;
}

const readAutoSpeak = () => {
  try {
    return localStorage.getItem("autospeak") === "1";
  } catch {
    return false;
  }
};

export function Chat({ onClose }: { onClose: () => void }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(readAutoSpeak);
  const listener = useRef<Listener | null>(null);
  const dictated = useRef<{ used: boolean; confidence: number | null }>({ used: false, confidence: null });

  useEffect(() => () => {
    listener.current?.stop();
    stopSpeaking();
  }, []);

  const toggleAutoSpeak = () => {
    const next = !autoSpeak;
    setAutoSpeak(next);
    try {
      localStorage.setItem("autospeak", next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
    if (!next) stopSpeaking();
    else if (turns.length) speak(turns[turns.length - 1].text);
  };

  const toggleMic = () => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    stopSpeaking();
    setError(null);
    sound.play("click");
    const l = listen({
      onText: setInput,
      onEnd: ({ text, confidence }) => {
        setListening(false);
        listener.current = null;
        if (text) dictated.current = { used: true, confidence };
      },
      onError: (m) => {
        setError(m);
        setListening(false);
      },
    });
    if (l) {
      listener.current = l;
      setListening(true);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    getScenarios().then((s) => setScenarios(s.scenarios)).catch((e: Error) => setError(e.message));
  }, []);

  const start = (s: Scenario) => {
    sound.play("click");
    setScenario(s);
    setConversationId(undefined);
    setTurns([{ role: "assistant", text: s.opener }]);
    if (autoSpeak) speak(s.opener);
  };

  const send = async () => {
    const text = input.trim();
    if (!scenario || !text || busy) return;
    listener.current?.stop();
    const voice = dictated.current;
    dictated.current = { used: false, confidence: null };
    setInput("");
    setBusy(true);
    setError(null);
    sound.play("send");
    setTurns((t) => [...t, { role: "user", text, clarity: voice.used ? voice.confidence : undefined }]);
    try {
      const r = await postChat(scenario.id, text, conversationId, voice.used);
      setConversationId(r.conversationId);
      sound.play("receive");
      if (r.correction.errors.length) window.setTimeout(() => sound.play("fix"), 220);
      else window.setTimeout(() => sound.play("correct"), 220);
      if (autoSpeak) window.setTimeout(() => speak(r.reply), 500);
      setTurns((t) => {
        const copy = [...t];
        copy[copy.length - 1] = { ...copy[copy.length - 1], correction: r.correction };
        return [...copy, { role: "assistant", text: r.reply }];
      });
    } catch (e) {
      setError((e as Error).message);
      setTurns((t) => t.slice(0, -1));
      setInput(text);
      dictated.current = voice;
    } finally {
      setBusy(false);
    }
  };

  if (!scenario) {
    return (
      <section>
        <button className="ghost" onClick={onClose}>← Back</button>
        <h2>Choose a mission</h2>
        <div className="missions">
          {scenarios.map((s) => (
            <button key={s.id} className="card mission" onClick={() => start(s)}>
              <strong>{s.title}</strong>
              <span>{s.description}</span>
            </button>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  return (
    <section>
      <div className="chat-head">
        <button className="ghost" onClick={onClose}>← End mission</button>
        {canSpeak() && (
          <button className={`chip ${autoSpeak ? "active" : ""}`} aria-pressed={autoSpeak} onClick={toggleAutoSpeak}>
            🔈 Read replies aloud
          </button>
        )}
      </div>
      <h2>{scenario.title}</h2>
      <div className="chat">
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            <p>{t.text}</p>
            {t.role === "assistant" && canSpeak() && (
              <button className="speak" aria-label="Listen" title="Listen" onClick={() => speak(t.text)}>🔈</button>
            )}
            {t.clarity != null && <small className="clarity">🎙 Clarity {Math.round(t.clarity * 100)}%</small>}
            {t.correction && <CorrectionView c={t.correction} />}
          </div>
        ))}
        {busy && <div className="bubble assistant typing"><i /><i /><i /></div>}
        <div ref={endRef} />
      </div>
      {error && <p className="error">{error}</p>}
      {!canListen() && <p className="muted">Voice input works in Chrome, Edge or Safari.</p>}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {canListen() && (
          <button type="button" className={`mic ${listening ? "live" : ""}`} aria-pressed={listening} aria-label={listening ? "Stop recording" : "Speak"} title={listening ? "Stop" : "Speak in English"} onClick={toggleMic}>
            {listening ? "■" : "🎤"}
          </button>
        )}
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening… speak in English" : "Write or speak in English…"} maxLength={1000} />
        <button className="primary" disabled={busy || !input.trim()}>Send</button>
      </form>
    </section>
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
