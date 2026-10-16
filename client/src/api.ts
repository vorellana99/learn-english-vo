export interface Profile {
  xp: number;
  streak: number;
  level: string;
  nextLevel: string | null;
  xpIntoLevel: number;
  xpForNext: number | null;
  reviewedToday?: boolean;
  dueCount?: number;
  levels?: { code: string; minXp: number }[];
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

const tz = () => new Date().getTimezoneOffset();

export const getProfile = () => fetch(`/api/profile?tz=${tz()}`).then((r) => json<Profile>(r));
export type Mode = "quick" | "normal" | "long";
export interface Plan {
  mode: Mode;
  due: number;
  new: number;
  reason: string;
}
export const getSession = (mode: Mode) =>
  fetch(`/api/session?mode=${mode}&tz=${tz()}`).then((r) => json<{ cards: Card[]; plan: Plan }>(r));

export interface Insights {
  learned: number;
  mastered: number;
  totalCards: number;
  weakCategories: { category: string; count: number }[];
  weakTopics: { topic: string; reviews: number; struggleRate: number }[];
  bestHour: number | null;
  activeDays: { day: string; reviews: number }[];
}
export const getInsights = () =>
  fetch(`/api/insights?tz=${tz()}`).then((r) => json<Insights>(r));
export const postReview = (cardId: number, rating: number) =>
  fetch("/api/review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId, rating, tz: tz() }),
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

export async function postChat(scenarioId: string, message: string, conversationId?: number, spoken = false) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, message, conversationId, spoken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as { conversationId: number; reply: string; correction: Correction };
}
