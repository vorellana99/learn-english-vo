import express from "express";
import type { DB } from "./db.js";
import { initialState, schedule, type Rating } from "./srs.js";
import { levelFor, nextStreak, XP_PER_RATING } from "./progress.js";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

export function createApp(db: DB) {
  const app = express();
  app.use(express.json());

  const profile = () =>
    db.prepare("SELECT xp, streak, last_active AS lastActive FROM profile WHERE id = 1").get() as {
      xp: number;
      streak: number;
      lastActive: string | null;
    };

  app.get("/api/profile", (_req, res) => {
    const p = profile();
    res.json({ ...p, ...levelFor(p.xp), reviewedToday: p.lastActive === today() });
  });

  // New cards (never seen) are introduced up to the limit; due cards come first.
  app.get("/api/session", (req, res) => {
    const newLimit = Math.min(Number(req.query.new ?? 5), 20);
    const due = db
      .prepare(
        `SELECT c.id, c.front, c.back, c.level, c.topic FROM cards c
         JOIN card_state s ON s.card_id = c.id WHERE s.due <= ? ORDER BY s.due`,
      )
      .all(today());
    const fresh = db
      .prepare(
        `SELECT c.id, c.front, c.back, c.level, c.topic FROM cards c
         WHERE c.id NOT IN (SELECT card_id FROM card_state)
         ORDER BY CASE c.level WHEN 'A1' THEN 1 WHEN 'A2' THEN 2 WHEN 'B1' THEN 3 ELSE 4 END, c.id
         LIMIT ?`,
      )
      .all(newLimit);
    res.json({ cards: [...due, ...fresh] });
  });

  app.post("/api/review", (req, res) => {
    const { cardId, rating } = req.body ?? {};
    if (!Number.isInteger(cardId) || ![0, 1, 2, 3].includes(rating)) {
      res.status(400).json({ error: "cardId and rating (0-3) are required" });
      return;
    }
    const card = db.prepare("SELECT id FROM cards WHERE id = ?").get(cardId);
    if (!card) {
      res.status(404).json({ error: "card not found" });
      return;
    }
    const row = db
      .prepare("SELECT ease, interval_days AS intervalDays, reps, lapses FROM card_state WHERE card_id = ?")
      .get(cardId) as typeof initialState | undefined;
    const next = schedule(row ?? initialState, rating as Rating);
    const date = today();
    db.transaction(() => {
      db.prepare(
        `INSERT INTO card_state (card_id, ease, interval_days, reps, lapses, due) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(card_id) DO UPDATE SET ease = excluded.ease, interval_days = excluded.interval_days,
           reps = excluded.reps, lapses = excluded.lapses, due = excluded.due`,
      ).run(cardId, next.ease, next.intervalDays, next.reps, next.lapses, addDays(date, next.intervalDays));
      db.prepare("INSERT INTO reviews (card_id, rating) VALUES (?, ?)").run(cardId, rating);
      const p = profile();
      db.prepare("UPDATE profile SET xp = ?, streak = ?, last_active = ? WHERE id = 1").run(
        p.xp + XP_PER_RATING[rating as Rating],
        nextStreak(p.streak, p.lastActive, date),
        date,
      );
    })();
    const p = profile();
    res.json({ ...p, ...levelFor(p.xp), nextDueInDays: next.intervalDays });
  });

  return app;
}
