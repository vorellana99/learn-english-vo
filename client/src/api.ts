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

export interface Scenario {
  id: string;
  title: string;
  description: string;
  opener: string;
}

export interface Correction {
  corrected: string;
  natural: string;
  explanation_es: string;
  errors: { category: string; original: string; fixed: string }[];
}

export const getScenarios = () => fetch("/api/scenarios").then((r) => json<{ scenarios: Scenario[] }>(r));

export async function postChat(scenarioId: string, message: string, conversationId?: number) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, message, conversationId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as { conversationId: number; reply: string; correction: Correction };
}
