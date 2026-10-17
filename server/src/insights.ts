import type { DB } from "./db.js";
import { LEVELS } from "./progress.js";
import { shadowingStats } from "./shadowing.js";

export type Mode = "quick" | "normal" | "long";

const SIZES: Record<Mode, { cap: number; newCards: number }> = {
  quick: { cap: 6, newCards: 3 },
  normal: { cap: 15, newCards: 5 },
  long: { cap: 30, newCards: 8 },
};

const levelRank = (level: string) => LEVELS.findIndex((l) => l.code === level);

export interface TopicStat {
  topic: string;
  reviews: number;
  struggleRate: number; // share of reviews rated again/hard
}

export function topicStats(db: DB): TopicStat[] {
  return db
    .prepare(
      `SELECT c.topic AS topic, COUNT(*) AS reviews,
              AVG(CASE WHEN r.rating <= 1 THEN 1.0 ELSE 0.0 END) AS struggleRate
       FROM reviews r JOIN cards c ON c.id = r.card_id
       GROUP BY c.topic`,
    )
    .all() as TopicStat[];
}

/** Share of "again" ratings over the last 7 days, or null when there is too little data. */
export function recentAgainRate(db: DB): number | null {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN rating = 0 THEN 1 ELSE 0 END) AS again
       FROM reviews WHERE reviewed_at >= datetime('now', '-7 days')`,
    )
    .get() as { n: number; again: number | null };
  return row.n >= 10 ? (row.again ?? 0) / row.n : null;
}

export function buildSession(db: DB, mode: Mode, level: string, today: string) {
  const { cap, newCards } = SIZES[mode];
  const again = recentAgainRate(db);
  let newLimit = newCards;
  let reason = "Balanced session.";
  if (again !== null && again > 0.35) {
    newLimit = Math.max(1, newCards - 2);
    reason = "You've been missing a lot lately, so fewer new cards and more repetition.";
  } else if (again !== null && again < 0.1) {
    newLimit = newCards + 2;
    reason = "You've been doing great, so a few extra new cards.";
  }

  const due = db
    .prepare(
      `SELECT c.id, c.front, c.back, c.level, c.topic FROM cards c
       JOIN card_state s ON s.card_id = c.id WHERE s.due <= ?
       ORDER BY s.lapses DESC, s.due LIMIT ?`,
    )
    .all(today, cap) as Card[];

  const room = Math.max(0, Math.min(newLimit, cap - due.length));
  const struggle = new Map(topicStats(db).map((t) => [t.topic, t.struggleRate]));
  const weight = (c: Card) => (c.topic === "mistakes" ? 2 : c.topic === "phrases" ? 1.5 : 0) + (struggle.get(c.topic) ?? 0);
  const maxRank = Math.max(0, levelRank(level));

  const fresh = (
    db
      .prepare(
        `SELECT id, front, back, level, topic FROM cards
         WHERE id NOT IN (SELECT card_id FROM card_state) ORDER BY id`,
      )
      .all() as Card[]
  ).sort((a, b) => {
    // Cards from your level or below first; the next level only fills gaps.
    const over = Number(levelRank(a.level) > maxRank) - Number(levelRank(b.level) > maxRank);
    return over || weight(b) - weight(a) || levelRank(a.level) - levelRank(b.level) || a.id - b.id;
  });

  const picked = fresh.slice(0, room);
  return { cards: [...due, ...picked], plan: { mode, due: due.length, new: picked.length, reason } };
}

export interface Card {
  id: number;
  front: string;
  back: string;
  level: string;
  topic: string;
}

/** `tzOffsetMin` is minutes behind UTC as returned by Date#getTimezoneOffset. */
export function buildInsights(db: DB, tzOffsetMin: number) {
  const shift = (utcHour: number) => (((utcHour - tzOffsetMin / 60) % 24) + 24) % 24;

  const hourRows = db
    .prepare(
      `SELECT CAST(strftime('%H', t) AS INTEGER) AS hour, COUNT(*) AS n FROM (
         SELECT reviewed_at AS t FROM reviews
         UNION ALL SELECT created_at FROM shadow_attempts
         UNION ALL SELECT created_at FROM messages WHERE role = 'user'
       ) GROUP BY hour`,
    )
    .all() as { hour: number; n: number }[];
  const hours = new Array<number>(24).fill(0);
  for (const r of hourRows) hours[Math.floor(shift(r.hour))] += r.n;
  const best = Math.max(...hours);
  const bestHour = best > 0 ? hours.indexOf(best) : null;

  // Group by the viewer's local calendar day (SQLite date modifiers take "+N minutes").
  const localShift = `${-tzOffsetMin} minutes`;
  const days = db
    .prepare(
      `SELECT date(t, ?) AS day, COUNT(*) AS reviews FROM (
         SELECT reviewed_at AS t FROM reviews UNION ALL SELECT created_at FROM shadow_attempts
       ) WHERE t >= datetime('now', '-15 days') GROUP BY day ORDER BY day`,
    )
    .all(localShift) as { day: string; reviews: number }[];

  const counts = db
    .prepare(
      `SELECT COUNT(*) AS learned,
              COALESCE(SUM(CASE WHEN interval_days >= 21 THEN 1 ELSE 0 END), 0) AS mastered
       FROM card_state WHERE reps > 0`,
    )
    .get() as { learned: number; mastered: number };

  return {
    ...counts,
    totalCards: (db.prepare("SELECT COUNT(*) AS n FROM cards").get() as { n: number }).n,
    weakCategories: db
      .prepare(
        `SELECT category, COUNT(*) AS count FROM mistakes
         WHERE created_at >= datetime('now', '-30 days') GROUP BY category ORDER BY count DESC LIMIT 5`,
      )
      .all(),
    weakTopics: topicStats(db)
      .filter((t) => t.reviews >= 3)
      .sort((a, b) => b.struggleRate - a.struggleRate)
      .slice(0, 3),
    bestHour,
    activeDays: days,
    shadowing: shadowingStats(db),
  };
}
