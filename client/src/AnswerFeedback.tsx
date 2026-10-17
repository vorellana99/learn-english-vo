import { useState } from "react";
import { getAnswerDetails, savePhrase, type AnswerDetails, type Correction } from "./api";
import { AnswerCard } from "./AnswerCard";
import { ScoreBadge } from "./ScoreBadge";
import { scoreBand } from "./score";
import { sound } from "./sound";
import { canSpeak, speak } from "./speech";
import { Translate } from "./Translate";

interface Props {
  conversationId: number;
  messageId: number;
  correction: Correction;
  /** Speech-recognition confidence (0-1) when the answer was dictated. */
  clarity?: number | null;
  onMicStart: () => void;
}

/**
 * Under each answer of yours: a round score badge and a "Details" button. The details panel shows the tutor's feedback
 * right away and loads the extras (other ways to say it, vocabulary, tips) the first time it is opened.
 */
export function AnswerFeedback({ conversationId, messageId, correction, clarity, onMicStart }: Props) {
  const band = scoreBand(correction.score);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<AnswerDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  const load = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      setDetails((await getAnswerDetails(conversationId, messageId)).details);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    sound.play("click");
    setOpen((o) => !o);
    if (!open && !details) void load();
  };

  const saveWord = async (text: string, es: string) => {
    try {
      await savePhrase(text, es);
      setSavedWords((s) => new Set(s).add(text));
      sound.play("correct");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const clean = correction.errors.length === 0;
  const spoken = clarity != null;

  return (
    <div className="feedback" style={{ ["--band" as string]: band.color }}>
      <div className="feedback-row">
        <ScoreBadge score={correction.score} />
        <span className="band-label">{band.label}</span>
        <button className="mini" aria-expanded={open} onClick={toggle}>
          Details {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div className="feedback-panel">
          <div className="verdict">
            <ScoreBadge score={correction.score} size={52} />
            <div className="verdict-text">
              {clean ? (
                <p>✓ Looks good! Natural: “{correction.natural}”</p>
              ) : (
                <>
                  <p>✏️ {correction.corrected}</p>
                  <p>💬 {correction.natural}</p>
                  {correction.explanation_es && <small>{correction.explanation_es}</small>}
                  <small>Saved {correction.errors.length} mistake(s) as review cards.</small>
                </>
              )}
            </div>
          </div>

          {!clean && (
            <div className="fb-section">
              <h4>Mistakes</h4>
              {correction.errors.map((e, i) => (
                <p key={i} className="mistake">
                  <s>{e.original}</s> → <strong>{e.fixed}</strong> <small className="cat">{e.category}</small>
                </p>
              ))}
            </div>
          )}

          {spoken && (
            <div className="fb-section">
              <h4>Pronunciation</h4>
              <p>🎙 Clarity {Math.round(clarity! * 100)}%</p>
              {details?.pronunciation_es && <p className="muted">{details.pronunciation_es}</p>}
            </div>
          )}

          {loading && <p className="muted">Preparing alternatives and tips…</p>}
          {error && (
            <p className="error">
              {error} <button className="mini" onClick={() => void load()}>Try again</button>
            </p>
          )}

          {details && (
            <>
              <div className="fb-section">
                <h4>Other ways to say it</h4>
                {details.alternatives.map((s) => (
                  <AnswerCard key={s.level} suggestion={s} onMicStart={onMicStart} />
                ))}
              </div>

              {details.vocabulary.length > 0 && (
                <div className="fb-section">
                  <h4>Key vocabulary</h4>
                  <div className="chips">
                    {details.vocabulary.map((v) => (
                      <span key={v.text} className="chip static">
                        {v.text}
                        {canSpeak() && (
                          <button className="speak" aria-label={`Listen: ${v.text}`} title="Listen" onClick={() => speak(v.text)}>🔈</button>
                        )}
                        <Translate es={v.translation_es} />
                        <button
                          className="speak"
                          aria-label={`Save: ${v.text}`}
                          title={savedWords.has(v.text) ? "Saved" : "Save as a review card"}
                          disabled={savedWords.has(v.text)}
                          onClick={() => void saveWord(v.text, v.translation_es)}
                        >
                          {savedWords.has(v.text) ? "✓" : "💾"}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(details.expected_es || details.tip_es) && (
                <div className="fb-section">
                  <h4>What was expected</h4>
                  {details.expected_es && <p>{details.expected_es}</p>}
                  {details.tip_es && <p className="tip">💡 {details.tip_es}</p>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
