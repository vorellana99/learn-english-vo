export const LEVELS = [
  { code: "A1", minXp: 0 },
  { code: "A2", minXp: 1000 },
  { code: "B1", minXp: 3000 },
  { code: "B2", minXp: 7000 },
] as const;

export const XP_PER_RATING = [2, 5, 10, 15] as const;

/** XP for one answer in a conversation mission, from its 0-100 score. */
export const answerXp = (score: number) => (score >= 90 ? 8 : score >= 75 ? 5 : score >= 60 ? 3 : score >= 40 ? 2 : 1);

export function levelFor(xp: number) {
  let idx = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.minXp) idx = i;
  });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1];
  return {
    level: current.code,
    nextLevel: next?.code ?? null,
    xpIntoLevel: xp - current.minXp,
    xpForNext: next ? next.minXp - current.minXp : null,
  };
}

/** Streak after activity on `today`; dates are YYYY-MM-DD. */
export function nextStreak(streak: number, lastActive: string | null, today: string): number {
  if (lastActive === today) return streak;
  if (lastActive) {
    const diff = (Date.parse(today) - Date.parse(lastActive)) / 86_400_000;
    if (diff === 1) return streak + 1;
  }
  return 1;
}
