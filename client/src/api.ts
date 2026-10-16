export interface Profile {
  xp: number;
  streak: number;
  level: string;
  nextLevel: string | null;
  xpIntoLevel: number;
  xpForNext: number | null;
  reviewedToday?: boolean;
}

export interface Card {
  id: number;
  front: string;
  back: string;
  level: string;
  topic: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const getProfile = () => fetch("/api/profile").then((r) => json<Profile>(r));
export const getSession = () => fetch("/api/session").then((r) => json<{ cards: Card[] }>(r));
export const postReview = (cardId: number, rating: number) =>
  fetch("/api/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId, rating }),
  }).then((r) => json<Profile>(r));
