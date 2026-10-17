import { useEffect, useRef, useState } from "react";
import { getShadowingSession, postShadowingResult, type Phrase } from "./api";
import { confetti } from "./effects";
import { compare, missedWords, type Comparison } from "./shadow";
import { sound } from "./sound";
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listener } from "./speech";

const SPEEDS = [
  { id: "slow", label: "Slow", rate: 0.7 },
  { id: "normal", label: "Normal", rate: 0.95 },
] as const;

interface Attempt {
  comparison: Comparison;
  clarity: number | null;
}

export function Shadowing({ onClose, onProgress }: { onClose: () => void; onProgress: () => void }) {
  const [phrases, setPhrases] = useState<Phrase[] | null>(null);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("normal");
  const [hideText, setHideText] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [best, setBest] = useState<Attempt | null>(null);
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [xp, setXp] = useState(0);
  const [hard, setHard] = useState<string[]>([]);
  const listener = useRef<Listener | null>(null);
  const rate = SPEEDS.find((s) => s.id === speed)!.rate;
  const finished = phrases !== null && index >= phrases.length;

  useEffect(() => {
    getShadowingSession(5).then((s) => setPhrases(s.phrases)).catch((e: Error) => setError(e.message));
    return () => {
      listener.current?.stop();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (phrases && !finished && canSpeak()) {
      const t = window.setTimeout(() => speak(phrases[index].front, undefined, rate), 400);
      return () => window.clearTimeout(t);
    }
  }, [phrases, index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (finished && scores.length) {
      sound.play("complete");
      if (scores.reduce((a, b) => a + b, 0) / scores.length >= 75) confetti(100);
    }
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error && !phrases) return <p className="error">{error}</p>;
  if (!phrases) return <p className="muted">Loading…</p>;

  if (!canListen()) {
    return (
      <section className="card summary">
        <h2>Shadowing needs voice input</h2>
        <p className="muted">Your browser has no speech recognition. Open the app in Chrome, Edge or Safari.</p>
        <button className="primary" onClick={onClose}>Back</button>
      </section>
    );
  }

  if (finished) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <section className="card summary">
        <div className="trophy">🎧</div>
        <h2>{scores.length ? "Shadowing complete!" : "No phrases available"}</h2>
        {scores.length > 0 && (
          <div className="tiles">
            <div className="tile"><strong>{avg}%</strong><small>average match</small></div>
            <div className="tile"><strong>{scores.length}</strong><small>phrases</small></div>
            <div className="tile"><strong>+{xp}</strong><small>XP</small></div>
          </div>
        )}
        {hard.length > 0 && (
          <>
            <p className="muted">Words to practice again:</p>
            <div className="chips">
              {hard.map((w) => (
                <button key={w} className="chip" onClick={() => speak(w, undefined, 0.8)}>🔈 {w}</button>
              ))}
            </div>
          </>
        )}
        <button className="primary" onClick={onClose}>Back to home</button>
      </section>
    );
  }

  const phrase = phrases[index];

  const toggleMic = () => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    stopSpeaking();
    setError(null);
    setHeard("");
    const l = listen({
      onText: setHeard,
      onEnd: ({ text, confidence }) => {
        listener.current = null;
        setListening(false);
        if (!text) return;
        const comparison = compare(phrase.front, text);
        const a = { comparison, clarity: confidence };
        setAttempt(a);
        setBest((b) => (b && b.comparison.score >= comparison.score ? b : a));
        sound.play(comparison.score >= 90 ? "easy" : comparison.score >= 70 ? "correct" : comparison.score >= 50 ? "hard" : "wrong");
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

  const next = async () => {
    const result = best ?? attempt;
    setBusy(true);
    setError(null);
    try {
      if (result) {
        const missed = missedWords(result.comparison);
        const r = await postShadowingResult(phrase.id, result.comparison.score, missed);
        setScores((s) => [...s, result.comparison.score]);
        setXp((x) => x + r.xpAwarded);
        setHard((h) => [...new Set([...h, ...missed])].slice(0, 12));
        onProgress();
      }
      setAttempt(null);
      setBest(null);
      setHeard("");
      setIndex((i) => i + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tryAgain = () => {
    setAttempt(null);
    setHeard("");
    speak(phrase.front, undefined, rate);
  };

  return (
    <section className="shadow">
      <div className="review-top">
        <button className="ghost" onClick={onClose}>← Exit</button>
        <div className="xpbar"><div style={{ width: `${(index / phrases.length) * 100}%` }} /></div>
        <small>{index + 1}/{phrases.length}</small>
      </div>

      <div className="card shadow-card" key={phrase.id}>
        <small className="tag">{phrase.level} · {phrase.topic}</small>
        {attempt ? (
          <p className="sentence">
            {attempt.comparison.words.map((w, i) => (
              <span key={i} className={w.ok ? "w-ok" : "w-miss"}>{w.text} </span>
            ))}
          </p>
        ) : (
          <p className={`sentence ${hideText && !listening ? "blurred" : ""}`}>{phrase.front}</p>
        )}
        <p className="muted">{phrase.back}</p>
        {!attempt && listening && <p className="heard">{heard || "Listening…"}</p>}
        {attempt && (
          <div className="shadow-result">
            <strong>{attempt.comparison.score}% match</strong>
            {attempt.clarity !== null && <small>🎙 Clarity {Math.round(attempt.clarity * 100)}%</small>}
            {heard && <small className="heard">You said: “{heard}”</small>}
          </div>
        )}
      </div>

      <div className="shadow-tools">
        <div className="chips" role="radiogroup" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s.id} role="radio" aria-checked={s.id === speed} className={`chip ${s.id === speed ? "active" : ""}`} onClick={() => setSpeed(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <button className={`chip ${hideText ? "active" : ""}`} aria-pressed={hideText} onClick={() => setHideText((h) => !h)}>
          🙈 Hide text
        </button>
      </div>

      <div className="answer-actions">
        <button className="chip big" onClick={() => speak(phrase.front, undefined, rate)}>🔈 Listen</button>
        <button className={`mic wide-mic ${listening ? "live" : ""}`} aria-pressed={listening} onClick={toggleMic}>
          {listening ? "■ Stop" : "🎤 Repeat it"}
        </button>
      </div>

      {attempt && (
        <div className="answer-actions">
          <button className="chip big" onClick={tryAgain}>↻ Try again</button>
          <button className="primary" disabled={busy} onClick={() => void next()}>
            {index + 1 === phrases.length ? "Finish" : "Next phrase"}
          </button>
        </div>
      )}
      {!attempt && (
        <button className="ghost" disabled={busy} onClick={() => void next()}>Skip this phrase</button>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
