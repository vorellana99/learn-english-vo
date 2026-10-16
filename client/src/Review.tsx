import { useEffect, useState } from "react";
import { getSession, postReview, type Card, type Profile } from "./api";

const RATINGS = [
  { value: 0, label: "Again" },
  { value: 1, label: "Hard" },
  { value: 2, label: "Good" },
  { value: 3, label: "Easy" },
];

export function Review({ onProgress, onDone }: { onProgress: (p: Profile) => void; onDone: () => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((s) => setCards(s.cards)).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!cards) return <p>Loading…</p>;
  if (index >= cards.length) {
    return (
      <div className="card">
        <p>{cards.length ? "Session complete! 🎉" : "Nothing to review right now."}</p>
        <button className="primary" onClick={onDone}>Back to dashboard</button>
      </div>
    );
  }

  const card = cards[index];
  const rate = async (rating: number) => {
    try {
      onProgress(await postReview(card.id, rating));
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="card">
      <small>{index + 1} / {cards.length} · {card.level} · {card.topic}</small>
      <p className="front">{card.front}</p>
      {flipped ? (
        <>
          <p className="back">{card.back}</p>
          <div className="ratings">
            {RATINGS.map((r) => (
              <button key={r.value} onClick={() => rate(r.value)}>{r.label}</button>
            ))}
          </div>
        </>
      ) : (
        <button className="primary" onClick={() => setFlipped(true)}>Show answer</button>
      )}
    </div>
  );
}
