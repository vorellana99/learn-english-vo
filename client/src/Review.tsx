import { useCallback, useEffect, useRef, useState } from "react";
import { getSession, postReview, type Card, type Mode, type Plan, type Profile } from "./api";
import { confetti } from "./effects";
import { sound, type Sfx } from "./sound";

const RATINGS: { value: number; label: string; sfx: Sfx; xp: number }[] = [
  { value: 0, label: "Again", sfx: "wrong", xp: 2 },
  { value: 1, label: "Hard", sfx: "hard", xp: 5 },
  { value: 2, label: "Good", sfx: "correct", xp: 10 },
  { value: 3, label: "Easy", sfx: "easy", xp: 15 },
];

interface Props {
  mode: Mode;
  level: string;
  streak: number;
  onProgress: (p: Profile) => void;
  onDone: () => void;
}

export function Review({ mode, level, streak, onProgress, onDone }: Props) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gained, setGained] = useState(0);
  const [good, setGood] = useState(0);
  const [pop, setPop] = useState<{ id: number; xp: number } | null>(null);
  const [levelUp, setLevelUp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startLevel = useRef(level);
  const startStreak = useRef(streak);
  const finished = cards !== null && index >= cards.length;

  useEffect(() => {
    getSession(mode)
      .then((s) => {
        setCards(s.cards);
        setPlan(s.plan);
      })
      .catch((e: Error) => setError(e.message));
  }, [mode]);

  useEffect(() => {
    if (finished && cards.length > 0 && !levelUp) {
      sound.play("complete");
      confetti(90);
    }
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = useCallback(
    async (r: (typeof RATINGS)[number]) => {
      if (!cards || busy) return;
      setBusy(true);
      try {
        const p = await postReview(cards[index].id, r.value);
        sound.play(r.sfx);
        setGained((g) => g + r.xp);
        if (r.value >= 2) setGood((g) => g + 1);
        setPop({ id: Date.now(), xp: r.xp });
        onProgress(p);
        if (p.level !== startLevel.current) {
          startLevel.current = p.level;
          setLevelUp(p.level);
          window.setTimeout(() => {
            sound.play("levelUp");
            confetti(180);
          }, 250);
        } else if (p.streak > startStreak.current) {
          startStreak.current = p.streak;
          window.setTimeout(() => sound.play("streak"), 450);
        }
        setFlipped(false);
        setIndex((i) => i + 1);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [cards, index, busy, onProgress],
  );

  const flip = useCallback(() => {
    sound.play("click");
    setFlipped(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!cards || finished) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        flip();
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        void rate(RATINGS[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cards, finished, flipped, rate, flip]);

  if (error) return <p className="error">{error}</p>;
  if (!cards) return <p className="muted">Loading…</p>;

  if (finished) {
    return (
      <section className="card summary">
        <div className="trophy">{cards.length ? "🏆" : "☕"}</div>
        <h2>{cards.length ? "Session complete!" : "Nothing to review right now"}</h2>
        {cards.length > 0 && (
          <div className="tiles">
            <div className="tile"><strong>{cards.length}</strong><small>cards</small></div>
            <div className="tile"><strong>+{gained}</strong><small>XP</small></div>
            <div className="tile"><strong>{Math.round((good / cards.length) * 100)}%</strong><small>recalled</small></div>
          </div>
        )}
        {levelUp && <p className="levelup-note">You reached level {levelUp}! 🎉</p>}
        <button className="primary" onClick={onDone}>Back to home</button>
      </section>
    );
  }

  const card = cards[index];
  return (
    <section className="review">
      {levelUp && (
        <div className="overlay" onClick={() => setLevelUp(null)} role="dialog" aria-label="Level up">
          <div className="levelup">
            <p className="eyebrow">Level up!</p>
            <div className="big">{levelUp}</div>
            <button className="primary">Keep going</button>
          </div>
        </div>
      )}
      <div className="review-top">
        <button className="ghost" onClick={onDone}>← Exit</button>
        <div className="xpbar"><div style={{ width: `${(index / cards.length) * 100}%` }} /></div>
        <small>{index + 1}/{cards.length}</small>
      </div>
      {index === 0 && plan && <p className="muted plan">{plan.due} to review + {plan.new} new. {plan.reason}</p>}
      <div className={`flip ${flipped ? "flipped" : ""}`} key={card.id}>
        <div className="face front-face">
          <small className="tag">{card.level} · {card.topic}</small>
          <p>{card.front}</p>
        </div>
        <div className="face back-face">
          <small className="tag">{card.level} · {card.topic}</small>
          <p className="muted-front">{card.front}</p>
          <p className="answer">{card.back}</p>
        </div>
        {pop && <span key={pop.id} className="xp-pop">+{pop.xp} XP</span>}
      </div>
      {flipped ? (
        <div className="ratings">
          {RATINGS.map((r) => (
            <button key={r.value} className={`rate r${r.value}`} disabled={busy} onClick={() => void rate(r)}>
              {r.label}<small>{r.value + 1}</small>
            </button>
          ))}
        </div>
      ) : (
        <button className="primary wide" onClick={flip}>Show answer <small>space</small></button>
      )}
    </section>
  );
}
