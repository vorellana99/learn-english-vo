import { useEffect, useState } from "react";
import { savePhrase, type Suggestion } from "./api";
import { compare, type Comparison } from "./shadow";
import { sound } from "./sound";
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listener } from "./speech";
import { Translate } from "./Translate";

const LEVEL_LABELS: Record<Suggestion["level"], string> = { simple: "Simple", medium: "Medium", natural: "Natural" };

// Only one card records at a time.
let activeListener: Listener | null = null;

interface Props {
  suggestion: Suggestion;
  /** Shows a "Use" button that puts the text in the answer box. */
  onUse?: (text: string) => void;
  /** Called before this card starts the microphone, so the chat's own recording can stop. */
  onMicStart?: () => void;
}

/** One English sentence with its level, translation, and the listen / practice / save actions. */
export function AnswerCard({ suggestion: s, onUse, onMicStart }: Props) {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState<Comparison | null>(null);

  useEffect(
    () => () => {
      if (activeListener) {
        activeListener.stop();
        activeListener = null;
      }
    },
    [],
  );

  const save = async () => {
    setSaveError(null);
    try {
      await savePhrase(s.text, s.translation_es);
      setSaved(true);
      sound.play("correct");
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const practice = () => {
    if (live) {
      activeListener?.stop();
      return;
    }
    activeListener?.stop();
    onMicStart?.();
    stopSpeaking();
    setHeard("");
    setLive(true);
    const l = listen({
      onText: setHeard,
      onEnd: ({ text }) => {
        activeListener = null;
        setLive(false);
        if (!text) return;
        const c = compare(s.text, text);
        setResult(c);
        sound.play(c.score >= 90 ? "easy" : c.score >= 70 ? "correct" : "hard");
      },
      onError: () => setLive(false),
    });
    if (l) activeListener = l;
    else setLive(false);
  };

  return (
    <div className="suggestion">
      <span className={`level-tag ${s.level}`}>{LEVEL_LABELS[s.level]}</span>
      <p className="s-text">
        {result ? result.words.map((w, i) => <span key={i} className={w.ok ? "w-ok" : "w-miss"}>{w.text} </span>) : s.text}
      </p>
      {live && <p className="heard">{heard || "Listening…"}</p>}
      {result && !live && <p className="muted">🎯 {result.score}% match</p>}
      <div className="mini-actions">
        <Translate es={s.translation_es} />
        {onUse && <button className="mini" onClick={() => onUse(s.text)}>✏️ Use</button>}
        {canSpeak() && <button className="mini" aria-label="Listen" onClick={() => speak(s.text)}>🔈 Listen</button>}
        {canListen() && (
          <button className={`mini ${live ? "live" : ""}`} onClick={practice}>
            {live ? "■ Stop" : "🎤 Practice"}
          </button>
        )}
        <button className="mini" disabled={saved} onClick={() => void save()}>
          {saved ? "✓ Saved" : "💾 Save"}
        </button>
      </div>
      {saveError && <p className="error">{saveError}</p>}
    </div>
  );
}
