import express from "express";
import type { DB } from "./db.js";
import { initialState, schedule, type Rating } from "./srs.js";
import { LEVELS, levelFor, nextStreak, XP_PER_RATING } from "./progress.js";
import { buildInsights, buildSession } from "./insights.js";
import { scenarios } from "./scenarios.js";
import type { Tutor } from "./tutor.js";
import type { Helper, IdeasHelper } from "./help.js";
import type { Detailer } from "./details.js";
import type { Summarizer } from "./summary.js";
import { mountChat } from "./chatRoutes.js";
import type { Evaluator } from "./evaluator.js";
import { mountInterviews } from "./interviewRoutes.js";
import { mountShadowing } from "./shadowing.js";

// `tz` is the client's Date#getTimezoneOffset (minutes behind UTC), so days roll over at local midnight.
const tzOf = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? n : 0;
};
const today = (tz = 0) => new Date(Date.now() - tz * 60_000).toISOString().slice(0, 10);
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

export function createApp(db: DB, tutor?: Tutor, evaluator?: Evaluator, extras: { helper?: Helper; ideasHelper?: IdeasHelper; summarizer?: Summarizer; detailer?: Detailer } = {}) {
  const app = express();
  app.use(express.json());

  const profile = () =>
    db.prepare("SELECT xp, streak, last_active AS lastActive FROM profile WHERE id = 1").get() as {
      xp: number;
      streak: number;
      lastActive: string | null;
    };

  app.get("/api/profile", (req, res) => {
    const date = today(tzOf(req.query.tz));
    const p = profile();
    const { n: dueCount } = db.prepare("SELECT COUNT(*) AS n FROM card_state WHERE due <= ?").get(date) as { n: number };
    res.json({ ...p, ...levelFor(p.xp), levels: LEVELS, dueCount, reviewedToday: p.lastActive === date });
  });

  // Adaptive session: due cards first, then new cards weighted toward your weak topics and
  // past mistakes, sized by `mode` and by how well the last week went.
  app.get("/api/session", (req, res) => {
    const mode = (["quick", "normal", "long"] as const).find((m) => m === req.query.mode) ?? "normal";
    res.json(buildSession(db, mode, levelFor(profile().xp).level, today(tzOf(req.query.tz))));
  });

  app.get("/api/insights", (req, res) => {
    const tz = Number(req.query.tz ?? 0);
    res.json(buildInsights(db, Number.isFinite(tz) ? tz : 0));
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
    const date = today(tzOf(req.body?.tz));
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

  app.get("/api/scenarios", (_req, res) => {
    res.json({ scenarios: scenarios.map(({ id, title, description, opener, opener_es }) => ({ id, title, description, opener, opener_es })) });
  });

  app.get("/api/mistakes", (_req, res) => {
    res.json({
      byCategory: db
        .prepare("SELECT category, COUNT(*) AS count FROM mistakes GROUP BY category ORDER BY count DESC")
        .all(),
    });
  });

  mountChat(app, db, { tutor, ...extras }, today, tzOf);
  mountInterviews(app, db, today, tzOf, evaluator);
  mountShadowing(app, db, today, tzOf);

  return app;
}
