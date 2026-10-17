import express from "express";
import type { DB } from "./db.js";
import { LEVELS, levelFor, nextStreak } from "./progress.js";

const MIN_WORDS = 3;
const MAX_WORDS = 14;

export const shadowingXp = (score: number) => (score >= 90 ? 10 : score >= 70 ? 6 : score >= 50 ? 3 : 1);

interface PhraseRow {
  id: number;
  front: string;
  back: string;
  level: string;
  topic: string;
  best: number | null;
}

const wordCount = (s: string) => s.trim().split(/\s+/).length;
const levelRank = (level: string) => LEVELS.findIndex((l) => l.code === level);

export function mountShadowing(app: express.Express, db: DB, today: (tz: number) => string, tzOf: (v: unknown) => number) {
  const profile = () => db.prepare("SELECT xp, streak, last_active AS lastActive FROM profile WHERE id = 1").get() as { xp: number; streak: number; lastActive: string | null };

  // Sentences you have never shadowed (or scored worst on) first, from your level or below.
  app.get("/api/shadowing/session", (req, res) => {
    const count = Math.max(1, Math.min(10, Number(req.query.count) || 5));
    const maxRank = Math.max(0, levelRank(levelFor(profile().xp).level));
    const rows = (
      db
        .prepare(
          `SELECT c.id, c.front, c.back, c.level, c.topic,
                  (SELECT MAX(score) FROM shadow_attempts a WHERE a.card_id = c.id) AS best
           FROM cards c`,
        )
        .all() as PhraseRow[]
    ).filter((r) => wordCount(r.front) >= MIN_WORDS && wordCount(r.front) <= MAX_WORDS);

    const rnd = new Map(rows.map((r) => [r.id, Math.random()]));
    rows.sort((a, b) => {
      const over = Number(levelRank(a.level) > maxRank) - Number(levelRank(b.level) > maxRank);
      return over || (a.best ?? -1) - (b.best ?? -1) || rnd.get(a.id)! - rnd.get(b.id)!;
    });
    res.json({ phrases: rows.slice(0, count) });
  });

  app.post("/api/shadowing/result", (req, res) => {
    const { cardId, score, missed } = req.body ?? {};
    if (!Number.isInteger(cardId) || typeof score !== "number" || !Number.isFinite(score)) {
      res.status(400).json({ error: "cardId and score are required" });
      return;
    }
    if (!db.prepare("SELECT id FROM cards WHERE id = ?").get(cardId)) {
      res.status(404).json({ error: "card not found" });
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    const words = (Array.isArray(missed) ? missed : [])
      .filter((w): w is string => typeof w === "string" && w.length > 0 && w.length <= 40)
      .slice(0, 20);
    const xpAwarded = shadowingXp(clamped);
    const date = today(tzOf(req.body?.tz));
    db.transaction(() => {
      db.prepare("INSERT INTO shadow_attempts (card_id, score, missed) VALUES (?, ?, ?)").run(cardId, clamped, JSON.stringify(words));
      const p = profile();
      db.prepare("UPDATE profile SET xp = ?, streak = ?, last_active = ? WHERE id = 1").run(
        p.xp + xpAwarded,
        nextStreak(p.streak, p.lastActive, date),
        date,
      );
    })();
    const p = profile();
    res.json({ xpAwarded, ...p, ...levelFor(p.xp) });
  });
}

/** Aggregates for the dashboard: how often you shadow, how well, and which words you miss most. */
export function shadowingStats(db: DB) {
  const row = db.prepare("SELECT COUNT(*) AS attempts, AVG(score) AS avg FROM shadow_attempts").get() as { attempts: number; avg: number | null };
  const recent = db.prepare("SELECT missed FROM shadow_attempts ORDER BY id DESC LIMIT 200").all() as { missed: string }[];
  const counts = new Map<string, number>();
  for (const r of recent) for (const w of JSON.parse(r.missed) as string[]) counts.set(w, (counts.get(w) ?? 0) + 1);
  const hardWords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([word, count]) => ({ word, count }));
  return { attempts: row.attempts, avgScore: row.avg === null ? null : Math.round(row.avg), hardWords };
}
