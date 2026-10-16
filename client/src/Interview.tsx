import { useEffect, useRef, useState } from "react";
import { answerInterview, finishInterview, getInterviewHistory, getInterviewTypes, startInterview, type InterviewType, type Report } from "./api";
import { confetti } from "./effects";
import { sound } from "./sound";
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listener } from "./speech";

type Stage = "pick" | "ask" | "evaluating" | "report";

const SCORE_LABELS: [keyof Report["scores"], string][] = [
  ["fluency", "Fluency"],
  ["grammar", "Grammar"],
  ["vocabulary", "Vocabulary"],
  ["structure", "Answer structure"],
  ["professionalism", "Professionalism"],
];

export function Interview({ onClose, onProgress }: { onClose: () => void; onProgress: () => void }) {
  const [stage, setStage] = useState<Stage>("pick");
  const [types, setTypes] = useState<InterviewType[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const [recent, setRecent] = useState<{ id: number; type: string; overall: number }[]>([]);
  const [interviewId, setInterviewId] = useState(0);
  const [question, setQuestion] = useState("");
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<{ report: Report; xpAwarded: number } | null>(null);
  const listener = useRef<Listener | null>(null);
  const spoken = useRef(false);

  useEffect(() => {
    getInterviewTypes().then((t) => setTypes(t.types)).catch((e: Error) => setError(e.message));
    getInterviewHistory()
      .then((h) => {
        setBest(h.best);
        setRecent(h.history.slice(0, 3));
      })
      .catch(() => undefined);
    return () => {
      listener.current?.stop();
      stopSpeaking();
    };
  }, []);

  const begin = async (type: string) => {
    setBusy(true);
    setError(null);
    try {
      const s = await startInterview(type);
      sound.play("click");
      setInterviewId(s.interviewId);
      setQuestion(s.question);
      setIndex(s.index);
      setTotal(s.total);
      setAnswer("");
      setStage("ask");
      speak(s.question);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const evaluate = async () => {
    setStage("evaluating");
    setError(null);
    try {
      const r = await finishInterview(interviewId);
      setResult(r);
      setStage("report");
      sound.play("complete");
      confetti(r.report.overall >= 60 ? 140 : 60);
      onProgress();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const submit = async () => {
    const text = answer.trim();
    if (!text || busy) return;
    listener.current?.stop();
    stopSpeaking();
    setBusy(true);
    setError(null);
    try {
      const r = await answerInterview(interviewId, text, spoken.current);
      spoken.current = false;
      sound.play("send");
      setAnswer("");
      if (r.done) {
        await evaluate();
      } else {
        setQuestion(r.question!);
        setIndex(r.index);
        window.setTimeout(() => speak(r.question!), 300);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    if (listening) {
      listener.current?.stop();
      return;
    }
    stopSpeaking();
    setError(null);
    const base = answer.trim();
    const l = listen({
      onText: (t) => setAnswer(base ? `${base} ${t}` : t),
      onEnd: ({ text }) => {
        setListening(false);
        listener.current = null;
        if (text) spoken.current = true;
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

  if (stage === "pick") {
    return (
      <section>
        <button className="ghost" onClick={onClose}>← Back</button>
        <h2>Mock interview</h2>
        <p className="muted">
          6 questions, no feedback until the end. Answer out loud or in writing, then get a full evaluation with a score, CEFR estimate and better answers.
          {best !== null && ` Best score: ${best}.`}
        </p>
        <div className="missions">
          {types.map((t) => (
            <button key={t.id} className="card mission" disabled={busy} onClick={() => void begin(t.id)}>
              <strong>{t.title}</strong>
              <span>{t.description}</span>
            </button>
          ))}
        </div>
        {recent.length > 0 && <p className="muted">Recent scores: {recent.map((r) => r.overall).join(" · ")}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  if (stage === "ask") {
    return (
      <section className="interview">
        <div className="review-top">
          <button className="ghost" onClick={onClose}>← Quit</button>
          <div className="xpbar"><div style={{ width: `${(index / total) * 100}%` }} /></div>
          <small>{index + 1}/{total}</small>
        </div>
        <div className="card question" key={index}>
          <p className="eyebrow">Interviewer</p>
          <p className="q">{question}</p>
          {canSpeak() && <button className="ghost" onClick={() => speak(question)}>🔈 Repeat question</button>}
        </div>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={listening ? "Listening… speak in English" : "Type your answer, or press the microphone and speak…"}
          rows={5}
          maxLength={2000}
        />
        <div className="answer-actions">
          {canListen() ? (
            <button className={`mic wide-mic ${listening ? "live" : ""}`} aria-pressed={listening} onClick={toggleMic}>
              {listening ? "■ Stop" : "🎤 Speak"}
            </button>
          ) : (
            <span className="muted">Voice input works in Chrome, Edge or Safari.</span>
          )}
          <button className="primary" disabled={busy || !answer.trim()} onClick={() => void submit()}>
            {index + 1 === total ? "Finish interview" : "Next question"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  if (stage === "evaluating") {
    return (
      <section className="card summary">
        {error ? (
          <>
            <h2>Couldn't evaluate yet</h2>
            <p className="error">{error}</p>
            <button className="primary" onClick={() => void evaluate()}>Try again</button>
          </>
        ) : (
          <>
            <div className="typing big-typing"><i /><i /><i /></div>
            <h2>Evaluating your interview…</h2>
            <p className="muted">Reviewing your English and your answers.</p>
          </>
        )}
      </section>
    );
  }

  const { report, xpAwarded } = result!;
  return (
    <section className="report">
      <div className="card report-head">
        <div className="score-ring" style={{ ["--pct" as string]: `${report.overall}%` }}>
          <strong>{report.overall}</strong>
          <small>/ 100</small>
        </div>
        <div>
          <p className="eyebrow">Interview result</p>
          <h2>Your English looks like {report.cefr}</h2>
          <p className="muted">+{xpAwarded} XP</p>
        </div>
      </div>
      <div className="card">
        <p>{report.summary_es}</p>
        <h3>Scores</h3>
        {SCORE_LABELS.map(([key, label]) => (
          <div key={key} className="hrow">
            <span>{label}</span>
            <div className="xpbar"><div style={{ width: `${report.scores[key]}%` }} /></div>
            <span>{report.scores[key]}</span>
          </div>
        ))}
      </div>
      <div className="two-col">
        <div className="card">
          <h3>What went well</h3>
          <ul>{report.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="card">
          <h3>To improve</h3>
          <ul>{report.improvements.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>
      {report.mistakes.length > 0 && (
        <div className="card">
          <h3>Mistakes saved as review cards</h3>
          {report.mistakes.map((m, i) => (
            <p key={i} className="mistake"><s>{m.original}</s> → <strong>{m.fixed}</strong> <small>{m.category}</small></p>
          ))}
        </div>
      )}
      <div className="card">
        <h3>Question by question</h3>
        {report.answers.map((a, i) => (
          <details key={i}>
            <summary>{a.question}</summary>
            <p className="muted">{a.feedback_es}</p>
            <p className="better">{a.better_answer}</p>
            {canSpeak() && <button className="ghost" onClick={() => speak(a.better_answer)}>🔈 Listen and repeat it</button>}
          </details>
        ))}
      </div>
      <button className="primary wide" onClick={onClose}>Back to home</button>
    </section>
  );
}
