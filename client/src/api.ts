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
  shadowing: { attempts: number; avgScore: number | null; hardWords: { word: string; count: number }[] };
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
  opener_es: string;
}

export interface Correction {
  corrected: string;
  natural: string;
  explanation_es: string;
  errors: { category: string; original: string; fixed: string }[];
}

export const getScenarios = () => fetch("/api/scenarios").then((r) => json<{ scenarios: Scenario[] }>(r));

export interface Suggestion {
  level: "simple" | "medium" | "natural";
  text: string;
  translation_es: string;
}

export interface Help {
  ideas: { en: string; es: string }[];
  starter: string;
  starter_es: string;
  suggestions: Suggestion[];
}

export interface ChatOptions {
  conversationId?: number;
  spoken?: boolean;
  /** Most help revealed for the question being answered: 0 none, 1 ideas, 2 starter, 3 full answers. */
  helpLevel?: number;
  fromSuggestion?: boolean;
  noHelp?: boolean;
}

export async function postChat(scenarioId: string, message: string, opts: ChatOptions = {}) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId, message, ...opts }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as { conversationId: number; reply: string; reply_es: string; correction: Correction; help?: Help };
}

export interface RunStats {
  messages: number;
  mistakes: number;
  errorsPerMessage: number;
  unaided: number;
  noHelpRun: boolean;
}

export interface MissionSummary {
  summary: {
    summary_es: string;
    /** Translations are optional because summaries stored before they existed do not have them. */
    rewritten: { question: string; question_es?: string; yours: string; better: string; better_es?: string }[];
    new_phrases: { text: string; translation_es: string }[];
    tips: string[];
  };
  stats: RunStats;
  previous: RunStats | null;
}

export interface InterviewType {
  id: string;
  title: string;
  description: string;
}

export interface Report {
  overall: number;
  cefr: string;
  scores: { fluency: number; grammar: number; vocabulary: number; structure: number; professionalism: number };
  summary_es: string;
  strengths: string[];
  improvements: string[];
  mistakes: { category: string; original: string; fixed: string }[];
  answers: { question: string; feedback_es: string; better_answer: string }[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
  return data as T;
}

export const getInterviewTypes = () => fetch("/api/interview/types").then((r) => json<{ types: InterviewType[] }>(r));
export const getInterviewHistory = () =>
  fetch("/api/interview/history").then((r) => json<{ history: { id: number; type: string; overall: number; finishedAt: string }[]; best: number | null }>(r));
export const startInterview = (type: string) =>
  post<{ interviewId: number; index: number; total: number; question: string; question_es: string }>("/api/interview/start", { type });
export const answerInterview = (id: number, answer: string, spoken: boolean) =>
  post<{ done: boolean; index: number; total: number; question?: string; question_es?: string }>(`/api/interview/${id}/answer`, { answer, spoken });
export const finishInterview = (id: number) =>
  post<{ report: Report; xpAwarded: number } & Profile>(`/api/interview/${id}/finish`, { tz: new Date().getTimezoneOffset() });

export interface Phrase {
  id: number;
  front: string;
  back: string;
  level: string;
  topic: string;
  best: number | null;
}

export const getShadowingSession = (count = 5) =>
  fetch(`/api/shadowing/session?count=${count}`).then((r) => json<{ phrases: Phrase[] }>(r));
export const postShadowingResult = (cardId: number, score: number, missed: string[]) =>
  post<{ xpAwarded: number } & Profile>("/api/shadowing/result", { cardId, score, missed, tz: new Date().getTimezoneOffset() });

export const getHelp = (scenarioId: string, conversationId?: number) =>
  post<{ help: Help }>("/api/chat/help", { scenarioId, conversationId });
export const getMissionSummary = (conversationId: number) => post<MissionSummary>("/api/chat/summary", { conversationId });
export const getPracticed = () => fetch("/api/chat/practiced").then((r) => json<{ practiced: Record<string, number> }>(r));
export const savePhrase = (front: string, back: string) => post<{ saved: boolean }>("/api/phrases", { front, back });
