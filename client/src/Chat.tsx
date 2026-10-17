import { useEffect, useRef, useState } from "react";
import { getHelp, getMissionSummary, getPracticed, getScenarios, postChat, type Correction, type Help, type MissionSummary as SummaryData, type Scenario } from "./api";
import { HelpPanel } from "./HelpPanel";
import { MissionSummary } from "./MissionSummary";
import { Translate } from "./Translate";
import { sound } from "./sound";
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listener } from "./speech";

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** Spanish translation of an assistant message. */
  es?: string;
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
  const [practiced, setPracticed] = useState<Record<string, number>>({});
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [noHelp, setNoHelp] = useState(false);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(readAutoSpeak);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  // Help for the question currently on screen. It starts hidden and resets with every new question.
  const [help, setHelp] = useState<Help | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpLevel, setHelpLevel] = useState(0);
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);
  const fromSuggestion = useRef(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listener = useRef<Listener | null>(null);
  const dictated = useRef<{ used: boolean; confidence: number | null }>({ used: false, confidence: null });

  useEffect(() => () => {
    listener.current?.stop();
    stopSpeaking();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  useEffect(() => {
    getScenarios().then((s) => setScenarios(s.scenarios)).catch((e: Error) => setError(e.message));
    getPracticed().then((p) => setPracticed(p.practiced)).catch(() => undefined);
  }, []);

  const resetHelp = (next: Help | null) => {
    setHelp(next);
    setHelpOpen(false);
    setHelpLevel(0);
    setHelpError(null);
    fromSuggestion.current = false;
  };

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

  const stopMic = () => listener.current?.stop();

  const toggleMic = () => {
    if (listening) {
      stopMic();
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
        if (text) {
          dictated.current = { used: true, confidence };
          fromSuggestion.current = false;
        }
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

  const start = (s: Scenario, withoutHelp = false) => {
    sound.play("click");
    setScenario(s);
    setNoHelp(withoutHelp);
    setSummary(null);
    setConversationId(undefined);
    setTurns([{ role: "assistant", text: s.opener, es: s.opener_es }]);
    setInput("");
    resetHelp(null);
    if (autoSpeak) speak(s.opener);
  };

  // The opening question has no help yet: it is requested the first time the panel is opened.
  const toggleHelp = async () => {
    sound.play("click");
    if (helpOpen) {
      setHelpOpen(false);
      return;
    }
    setHelpOpen(true);
    setHelpLevel((l) => Math.max(l, 1));
    if (!help && scenario && !helpLoading) {
      setHelpLoading(true);
      setHelpError(null);
      try {
        setHelp((await getHelp(scenario.id, conversationId)).help);
      } catch (e) {
        setHelpError((e as Error).message);
      } finally {
        setHelpLoading(false);
      }
    }
  };

  const useText = (text: string) => {
    sound.play("click");
    stopMic();
    setInput(text);
    fromSuggestion.current = true;
    dictated.current = { used: false, confidence: null };
    inputRef.current?.focus();
  };

  const send = async () => {
    const text = input.trim();
    if (!scenario || !text || busy) return;
    stopMic();
    const voice = dictated.current;
    const usedHelp = { level: helpLevel, suggestion: fromSuggestion.current };
    dictated.current = { used: false, confidence: null };
    setInput("");
    setBusy(true);
    setError(null);
    sound.play("send");
    setTurns((t) => [...t, { role: "user", text, clarity: voice.used ? voice.confidence : undefined }]);
    try {
      const r = await postChat(scenario.id, text, {
        conversationId,
        spoken: voice.used,
        helpLevel: usedHelp.level,
        fromSuggestion: usedHelp.suggestion,
        noHelp,
      });
      setConversationId(r.conversationId);
      resetHelp(noHelp ? null : (r.help ?? null));
      sound.play("receive");
      if (r.correction.errors.length) window.setTimeout(() => sound.play("fix"), 220);
      else window.setTimeout(() => sound.play("correct"), 220);
      if (autoSpeak) window.setTimeout(() => speak(r.reply), 500);
      setTurns((t) => {
        const copy = [...t];
        copy[copy.length - 1] = { ...copy[copy.length - 1], correction: r.correction };
        return [...copy, { role: "assistant", text: r.reply, es: r.reply_es }];
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

  const finish = async () => {
    if (conversationId === undefined || summarizing) return;
    stopMic();
    stopSpeaking();
    setSummarizing(true);
    setError(null);
    try {
      setSummary(await getMissionSummary(conversationId));
      sound.play("complete");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSummarizing(false);
    }
  };

  const backToMissions = () => {
    setScenario(null);
    setSummary(null);
    getPracticed().then((p) => setPracticed(p.practiced)).catch(() => undefined);
  };

  if (!scenario) {
    return (
      <section>
        <button className="ghost" onClick={onClose}>← Back</button>
        <h2>Choose a mission</h2>
        <div className="missions">
          {scenarios.map((s) => (
            <div key={s.id} className="mission-wrap">
              <button className="card mission" onClick={() => start(s)}>
                <strong>{s.title}</strong>
                <span>{s.description}</span>
              </button>
              {practiced[s.id] > 0 && (
                <div className="mission-extra">
                  <button className="mini" onClick={() => start(s, true)}>🚫 Retry without help</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  if (summary) {
    return (
      <MissionSummary
        data={summary}
        onRetryNoHelp={() => start(scenario, true)}
        onMissions={backToMissions}
        onHome={onClose}
      />
    );
  }

  const userTurns = turns.filter((t) => t.role === "user").length;
  return (
    <section>
      <div className="chat-head">
        <button className="ghost" onClick={backToMissions}>← Missions</button>
        <div className="chips">
          {canSpeak() && (
            <button className={`chip ${autoSpeak ? "active" : ""}`} aria-pressed={autoSpeak} onClick={toggleAutoSpeak}>
              🔈 Read replies aloud
            </button>
          )}
          {userTurns > 0 && conversationId !== undefined && (
            <button className="chip" disabled={summarizing || busy} onClick={() => void finish()}>
              {summarizing ? "Summarizing…" : "✅ Finish & summary"}
            </button>
          )}
        </div>
      </div>
      <h2>{scenario.title}</h2>
      {noHelp && <p className="nohelp-banner">🚫 No-help run: suggestions are off. Answer on your own.</p>}
      <div className="chat">
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            <p>{t.text}</p>
            {t.role === "assistant" && (
              <div className="bubble-tools">
                {canSpeak() && (
                  <button className="speak" aria-label="Listen" title="Listen" onClick={() => speak(t.text)}>🔈</button>
                )}
                <Translate es={t.es} />
              </div>
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
      {!noHelp && !busy && (
        <HelpPanel
          help={help}
          loading={helpLoading}
          error={helpError}
          level={helpLevel}
          open={helpOpen}
          onToggle={() => void toggleHelp()}
          onReveal={(l) => setHelpLevel((cur) => Math.max(cur, l))}
          onUse={(text) => {
            setHelpLevel((cur) => Math.max(cur, 2));
            useText(text);
          }}
          onMicStart={stopMic}
        />
      )}
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
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (!e.target.value) fromSuggestion.current = false;
          }}
          placeholder={listening ? "Listening… speak in English" : "Write or speak in English…"}
          maxLength={1000}
        />
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
