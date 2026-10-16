import express from "express";
import type { DB } from "./db.js";
import { initialState, schedule, type Rating } from "./srs.js";
import { LEVELS, levelFor, nextStreak, XP_PER_RATING } from "./progress.js";
import { buildInsights, buildSession } from "./insights.js";
import { findScenario, scenarios } from "./scenarios.js";
import { createClaudeTutor, type Tutor } from "./tutor.js";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

export function createApp(db: DB, tutor?: Tutor) {
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
    const { n: dueCount } = db.prepare("SELECT COUNT(*) AS n FROM card_state WHERE due <= ?").get(today()) as { n: number };
    res.json({ ...p, ...levelFor(p.xp), levels: LEVELS, dueCount, reviewedToday: p.lastActive === today() });
  });

  // Adaptive session: due cards first, then new cards weighted toward your weak topics and
  // past mistakes, sized by `mode` and by how well the last week went.
  app.get("/api/session", (req, res) => {
    const mode = (["quick", "normal", "long"] as const).find((m) => m === req.query.mode) ?? "normal";
    res.json(buildSession(db, mode, levelFor(profile().xp).level, today()));
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

  app.get("/api/scenarios", (_req, res) => {
    res.json({ scenarios: scenarios.map(({ id, title, description, opener }) => ({ id, title, description, opener })) });
  });

  app.get("/api/mistakes", (_req, res) => {
    res.json({
      byCategory: db
        .prepare("SELECT category, COUNT(*) AS count FROM mistakes GROUP BY category ORDER BY count DESC")
        .all(),
    });
  });

  app.post("/api/chat", async (req, res) => {
    const { scenarioId, conversationId, message } = req.body ?? {};
    const scenario = typeof scenarioId === "string" ? findScenario(scenarioId) : undefined;
    if (!scenario || typeof message !== "string" || !message.trim() || message.length > 1000) {
      res.status(400).json({ error: "valid scenarioId and message (max 1000 chars) are required" });
      return;
    }
    if (!tutor) {
      if (!process.env.ANTHROPIC_API_KEY) {
        res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });
        return;
      }
      tutor = createClaudeTutor();
    }

    let convId: number;
    let history: { role: "user" | "assistant"; content: string }[];
    if (conversationId === undefined) {
      convId = Number(db.prepare("INSERT INTO conversations (scenario_id) VALUES (?)").run(scenario.id).lastInsertRowid);
      history = [{ role: "assistant", content: scenario.opener }];
    } else {
      const conv = db.prepare("SELECT id FROM conversations WHERE id = ? AND scenario_id = ?").get(conversationId, scenario.id);
      if (!conv) {
        res.status(404).json({ error: "conversation not found" });
        return;
      }
      convId = conversationId;
      history = db
        .prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id")
        .all(convId) as typeof history;
      if (!history.length || history[0].role !== "assistant") history.unshift({ role: "assistant", content: scenario.opener });
    }

    try {
      const level = levelFor(profile().xp).level;
      const result = await tutor({ scenario, level, history, message: message.trim() });
      db.transaction(() => {
        const insertMsg = db.prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)");
        if (conversationId === undefined) insertMsg.run(convId, "assistant", scenario.opener);
        insertMsg.run(convId, "user", message.trim());
        insertMsg.run(convId, "assistant", result.reply);
        for (const e of result.correction.errors) {
          db.prepare("INSERT INTO mistakes (category, original, fixed) VALUES (?, ?, ?)").run(e.category, e.original, e.fixed);
          // Each mistake becomes a review card (front: the fixed phrase, back: what was wrong).
          db.prepare("INSERT OR IGNORE INTO cards (front, back, level, topic) VALUES (?, ?, ?, 'mistakes')").run(
            e.fixed,
            `Antes escribiste: "${e.original}" (${e.category})`,
            level,
          );
        }
      })();
      res.json({ conversationId: convId, reply: result.reply, correction: result.correction });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "The tutor is unavailable right now, try again" });
    }
  });

  return app;
}
