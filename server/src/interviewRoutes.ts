import express from "express";
import type { DB } from "./db.js";
import { createClaudeEvaluator, normalizeReport, type Evaluator, type Report } from "./evaluator.js";
import { findInterviewType, interviewTypes, pickQuestions } from "./interviews.js";
import { levelFor, nextStreak } from "./progress.js";

const MAX_ANSWER = 2000;

interface Turn {
  idx: number;
  question: string;
  answer: string | null;
  spoken: number;
}

export function xpForScore(overall: number) {
  return 50 + Math.round(overall * 1.5);
}

export function mountInterviews(app: express.Express, db: DB, today: (tz: number) => string, tzOf: (v: unknown) => number, evaluator?: Evaluator) {
  const profile = () => db.prepare("SELECT xp, streak, last_active AS lastActive FROM profile WHERE id = 1").get() as { xp: number; streak: number; lastActive: string | null };
  const turnsOf = (id: number) =>
    db.prepare("SELECT idx, question, answer, spoken FROM interview_turns WHERE interview_id = ? ORDER BY idx").all(id) as Turn[];
  const interviewOf = (id: number) =>
    db.prepare("SELECT id, type, status, report, xp_awarded AS xpAwarded FROM interviews WHERE id = ?").get(id) as
      | { id: number; type: string; status: string; report: string | null; xpAwarded: number | null }
      | undefined;

  app.get("/api/interview/types", (_req, res) => {
    res.json({ types: interviewTypes.map(({ id, title, description }) => ({ id, title, description })) });
  });

  app.get("/api/interview/history", (_req, res) => {
    const rows = db
      .prepare("SELECT id, type, overall, finished_at AS finishedAt FROM interviews WHERE status = 'completed' ORDER BY id DESC LIMIT 10")
      .all() as { id: number; type: string; overall: number; finishedAt: string }[];
    res.json({ history: rows, best: rows.length ? Math.max(...rows.map((r) => r.overall)) : null });
  });

  app.post("/api/interview/start", (req, res) => {
    const type = typeof req.body?.type === "string" ? findInterviewType(req.body.type) : undefined;
    if (!type) {
      res.status(400).json({ error: "valid interview type is required" });
      return;
    }
    const questions = pickQuestions(type);
    const id = db.transaction(() => {
      const interviewId = Number(db.prepare("INSERT INTO interviews (type) VALUES (?)").run(type.id).lastInsertRowid);
      const ins = db.prepare("INSERT INTO interview_turns (interview_id, idx, question) VALUES (?, ?, ?)");
      questions.forEach((q, i) => ins.run(interviewId, i, q));
      return interviewId;
    })();
    res.json({ interviewId: id, index: 0, total: questions.length, question: questions[0] });
  });

  app.post("/api/interview/:id/answer", (req, res) => {
    const id = Number(req.params.id);
    const answer = typeof req.body?.answer === "string" ? req.body.answer.trim() : "";
    if (!answer || answer.length > MAX_ANSWER) {
      res.status(400).json({ error: `answer is required (max ${MAX_ANSWER} chars)` });
      return;
    }
    const interview = interviewOf(id);
    if (!interview) {
      res.status(404).json({ error: "interview not found" });
      return;
    }
    if (interview.status !== "active") {
      res.status(409).json({ error: "interview already finished" });
      return;
    }
    const turns = turnsOf(id);
    const current = turns.find((t) => t.answer === null);
    if (!current) {
      res.status(409).json({ error: "all questions answered, finish the interview" });
      return;
    }
    db.prepare("UPDATE interview_turns SET answer = ?, spoken = ? WHERE interview_id = ? AND idx = ?").run(
      answer,
      req.body?.spoken === true ? 1 : 0,
      id,
      current.idx,
    );
    const next = turns.find((t) => t.idx === current.idx + 1);
    res.json(
      next
        ? { done: false, index: next.idx, total: turns.length, question: next.question }
        : { done: true, index: turns.length, total: turns.length },
    );
  });

  app.post("/api/interview/:id/finish", async (req, res) => {
    const id = Number(req.params.id);
    const interview = interviewOf(id);
    if (!interview) {
      res.status(404).json({ error: "interview not found" });
      return;
    }
    const sendResult = (report: Report, xpAwarded: number) => {
      const p = profile();
      res.json({ report, xpAwarded, xp: p.xp, ...levelFor(p.xp) });
    };
    if (interview.status === "completed" && interview.report) {
      sendResult(JSON.parse(interview.report) as Report, interview.xpAwarded ?? 0);
      return;
    }
    const turns = turnsOf(id);
    if (turns.some((t) => t.answer === null)) {
      res.status(409).json({ error: "answer every question before finishing" });
      return;
    }
    if (!evaluator) {
      if (!process.env.ANTHROPIC_API_KEY) {
        res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });
        return;
      }
      evaluator = createClaudeEvaluator();
    }
    try {
      const level = levelFor(profile().xp).level;
      const report = normalizeReport(
        await evaluator({
          type: interview.type,
          level,
          turns: turns.map((t) => ({ question: t.question, answer: t.answer!, spoken: t.spoken === 1 })),
        }),
      );
      const xpAwarded = xpForScore(report.overall);
      const date = today(tzOf(req.body?.tz));
      const saved = db.transaction(() => {
        const done = db
          .prepare("UPDATE interviews SET status = 'completed', overall = ?, report = ?, xp_awarded = ?, finished_at = datetime('now') WHERE id = ? AND status = 'active'")
          .run(report.overall, JSON.stringify(report), xpAwarded, id);
        if (done.changes !== 1) return false; // a concurrent finish already awarded the XP
        const p = profile();
        db.prepare("UPDATE profile SET xp = ?, streak = ?, last_active = ? WHERE id = 1").run(
          p.xp + xpAwarded,
          nextStreak(p.streak, p.lastActive, date),
          date,
        );
        for (const m of report.mistakes) {
          db.prepare("INSERT INTO mistakes (category, original, fixed) VALUES (?, ?, ?)").run(m.category, m.original, m.fixed);
          db.prepare("INSERT OR IGNORE INTO cards (front, back, level, topic) VALUES (?, ?, ?, 'mistakes')").run(
            m.fixed,
            `Antes escribiste: "${m.original}" (${m.category})`,
            level,
          );
        }
        return true;
      })();
      if (!saved) {
        const again = interviewOf(id)!;
        sendResult(JSON.parse(again.report!) as Report, again.xpAwarded ?? 0);
        return;
      }
      sendResult(report, xpAwarded);
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "The evaluator is unavailable right now, try again" });
    }
  });
}
