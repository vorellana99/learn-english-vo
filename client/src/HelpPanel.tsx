import { useEffect, useRef, useState } from "react";
import { savePhrase, type Help, type Suggestion } from "./api";
import { compare, type Comparison } from "./shadow";
import { sound } from "./sound";
import { Translate } from "./Translate";
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listener } from "./speech";

const LEVEL_LABELS: Record<Suggestion["level"], string> = { simple: "Simple", medium: "Medium", natural: "Natural" };

interface Props {
  help: Help | null;
  loading: boolean;
  error: string | null;
  /** Hint steps revealed so far: 0 none, 1 ideas, 2 starter, 3 full answers. */
  level: number;
  open: boolean;
  onToggle: () => void;
  onReveal: (level: number) => void;
  onUse: (text: string) => void;
  /** Called before the panel starts the microphone so the chat's own recording stops. */
  onMicStart: () => void;
}

export function HelpPanel({ help, loading, error, level, open, onToggle, onReveal, onUse, onMicStart }: Props) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [practicing, setPracticing] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const [results, setResults] = useState<Record<string, Comparison>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const listener = useRef<Listener | null>(null);

  useEffect(
    () => () => {
      listener.current?.stop();
      stopSpeaking();
    },
    [],
  );

  const save = async (text: string, translation: string) => {
    setSaveError(null);
    try {
      await savePhrase(text, translation);
      setSaved((s) => new Set(s).add(text));
      sound.play("correct");
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const practice = (s: Suggestion) => {
    if (practicing === s.text) {
      listener.current?.stop();
      return;
    }
    listener.current?.stop();
    onMicStart();
    stopSpeaking();
    setHeard("");
    setPracticing(s.text);
    const l = listen({
      onText: setHeard,
      onEnd: ({ text }) => {
        listener.current = null;
        setPracticing(null);
        if (!text) return;
        const c = compare(s.text, text);
        setResults((r) => ({ ...r, [s.text]: c }));
        sound.play(c.score >= 90 ? "easy" : c.score >= 70 ? "correct" : "hard");
      },
      onError: () => setPracticing(null),
    });
    if (l) listener.current = l;
    else setPracticing(null);
  };

  return (
    <div className="help">
      <button className={`chip ${open ? "active" : ""}`} aria-expanded={open} onClick={onToggle}>
        💡 {open ? "Hide help" : "Need help answering?"}
      </button>
      {open && (
        <div className="help-body">
          {loading && <p className="muted">Thinking of ideas…</p>}
          {error && <p className="error">{error}</p>}
          {help && (
            <>
              <div className="hint">
                <p className="eyebrow">1 · Ideas</p>
                <div className="chips">
                  {help.ideas.map((idea) => (
                    <span key={idea.en} className="chip static">
                      {idea.en}
                      <Translate es={idea.es} />
                    </span>
                  ))}
                </div>
              </div>

              {level < 2 ? (
                <button className="ghost" onClick={() => onReveal(2)}>Show a sentence starter →</button>
              ) : (
                <div className="hint">
                  <p className="eyebrow">2 · Start like this</p>
                  <div className="starter">
                    <span>{help.starter}</span>
                    <div className="mini-actions">
                      <Translate es={help.starter_es} />
                      <button className="mini" onClick={() => onUse(help.starter.replace(/\s*\.{3}\s*$/, " "))}>✏️ Use</button>
                      {canSpeak() && <button className="mini" aria-label="Listen" onClick={() => speak(help.starter.replace(/\.{3}/g, ""))}>🔈</button>}
                    </div>
                  </div>
                </div>
              )}

              {level >= 2 &&
                (level < 3 ? (
                  <button className="ghost" onClick={() => onReveal(3)}>Show full answers →</button>
                ) : (
                  <div className="hint">
                    <p className="eyebrow">3 · Full answers</p>
                    {help.suggestions.map((s) => {
                      const result = results[s.text];
                      const live = practicing === s.text;
                      return (
                        <div key={s.level} className="suggestion">
                          <span className={`level-tag ${s.level}`}>{LEVEL_LABELS[s.level]}</span>
                          <p className="s-text">
                            {result
                              ? result.words.map((w, i) => (
                                  <span key={i} className={w.ok ? "w-ok" : "w-miss"}>{w.text} </span>
                                ))
                              : s.text}
                          </p>
                          {live && <p className="heard">{heard || "Listening…"}</p>}
                          {result && !live && <p className="muted">🎯 {result.score}% match</p>}
                          <div className="mini-actions">
                            <Translate es={s.translation_es} variant="mini" />
                            <button className="mini" onClick={() => onUse(s.text)}>✏️ Use</button>
                            {canSpeak() && <button className="mini" aria-label="Listen" onClick={() => speak(s.text)}>🔈 Listen</button>}
                            {canListen() && (
                              <button className={`mini ${live ? "live" : ""}`} onClick={() => practice(s)}>
                                {live ? "■ Stop" : "🎤 Practice"}
                              </button>
                            )}
                            <button className="mini" disabled={saved.has(s.text)} onClick={() => void save(s.text, s.translation_es)}>
                              {saved.has(s.text) ? "✓ Saved" : "💾 Save"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              {saveError && <p className="error">{saveError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
