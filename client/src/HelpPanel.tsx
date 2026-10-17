import type { HelpPart, HelpState } from "./api";
import { AnswerCard } from "./AnswerCard";
import { canSpeak, speak } from "./speech";
import { Translate } from "./Translate";

interface Props {
  help: HelpState | null;
  /** Which part of the help is being requested right now. */
  loading: HelpPart | null;
  error: string | null;
  /** Hint steps revealed so far: 0 none, 1 ideas, 2 starter, 3 full answers. */
  level: number;
  open: boolean;
  onToggle: () => void;
  onReveal: (level: number) => void;
  onRetry: (part: HelpPart) => void;
  onUse: (text: string) => void;
  /** Called before a card starts the microphone so the chat's own recording stops. */
  onMicStart: () => void;
}

export function HelpPanel({ help, loading, error, level, open, onToggle, onReveal, onRetry, onUse, onMicStart }: Props) {
  const restReady = Boolean(help?.starter && help?.suggestions);
  const failedPart: HelpPart = !help?.ideas ? "ideas" : "rest";

  return (
    <div className="help">
      <button className={`chip ${open ? "active" : ""}`} aria-expanded={open} onClick={onToggle}>
        💡 {open ? "Hide help" : "Need help answering?"}
      </button>
      {open && (
        <div className="help-body">
          <div className="hint">
            <p className="eyebrow">1 · Ideas</p>
            {help?.ideas ? (
              <div className="chips">
                {help.ideas.map((idea) => (
                  <span key={idea.en} className="chip static">
                    {idea.en}
                    {canSpeak() && (
                      <button className="speak" aria-label={`Listen: ${idea.en}`} title="Listen" onClick={() => speak(idea.en)}>🔈</button>
                    )}
                    <Translate es={idea.es} />
                  </span>
                ))}
              </div>
            ) : (
              loading === "ideas" && <p className="muted">Thinking of ideas…</p>
            )}
          </div>

          {error && (
            <p className="error">
              {error} <button className="mini" onClick={() => onRetry(failedPart)}>Try again</button>
            </p>
          )}

          {level < 2 ? (
            <button className="ghost" onClick={() => onReveal(2)}>Show a sentence starter →</button>
          ) : help?.starter ? (
            <div className="hint">
              <p className="eyebrow">2 · Start like this</p>
              <div className="starter">
                <span>{help.starter}</span>
                <div className="mini-actions">
                  <Translate es={help.starter_es} />
                  <button className="mini" onClick={() => onUse(help.starter!.replace(/\s*\.{3}\s*$/, " "))}>✏️ Use</button>
                  {canSpeak() && <button className="mini" aria-label="Listen" onClick={() => speak(help.starter!.replace(/\.{3}/g, ""))}>🔈</button>}
                </div>
              </div>
            </div>
          ) : (
            loading === "rest" && (
              <div className="hint">
                <p className="eyebrow">2 · Start like this</p>
                <p className="muted">Writing a sentence starter…</p>
              </div>
            )
          )}

          {level >= 2 &&
            restReady &&
            (level < 3 ? (
              <button className="ghost" onClick={() => onReveal(3)}>Show full answers →</button>
            ) : (
              <div className="hint">
                <p className="eyebrow">3 · Full answers</p>
                {help!.suggestions!.map((s) => (
                  <AnswerCard key={s.level} suggestion={s} onUse={onUse} onMicStart={onMicStart} />
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
