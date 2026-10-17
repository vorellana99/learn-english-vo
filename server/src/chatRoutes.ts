import express from "express";
import type { DB } from "./db.js";
import type { ChatMessage } from "./claude.js";
import { createClaudeDetailer, type Detailer } from "./details.js";
import { createClaudeHelper, createClaudeIdeasHelper, type HelpIdeas, type HelpRest, type Helper, type IdeasHelper } from "./help.js";
import { levelFor } from "./progress.js";
import { findScenario } from "./scenarios.js";
import { createClaudeSummarizer, type Summarizer } from "./summary.js";
import { createClaudeTutor, type Tutor } from "./tutor.js";

export interface ChatDeps {
  tutor?: Tutor;
  /** Step 2 and 3 of the help ladder (starter and full answers). */
  helper?: Helper;
  /** Step 1 of the help ladder (ideas), meant for a fast model. */
  ideasHelper?: IdeasHelper;
  summarizer?: Summarizer;
  /** Extra feedback on one answer (alternatives, vocabulary, tips), requested when the details panel opens. */
  detailer?: Detailer;
}

interface MessageRow {
  role: "user" | "assistant";
  content: string;
  helpLevel: number;
  fromSuggestion: number;
  errors: number | null;
  correction: string | null;
  score: number | null;
}

export interface RunStats {
  messages: number;
  mistakes: number;
  errorsPerMessage: number;
  /** Answers written without opening any hint or using a suggestion. */
  unaided: number;
  /** Average of the 0-100 scores the tutor gave, or null when there are none. */
  avgScore: number | null;
  noHelpRun: boolean;
}

const MAX_MESSAGE = 1000;

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

export function mountChat(app: express.Express, db: DB, deps: ChatDeps = {}) {
  let { tutor, helper, ideasHelper, summarizer, detailer } = deps;

  const level = () => levelFor((db.prepare("SELECT xp FROM profile WHERE id = 1").get() as { xp: number }).xp).level;

  /** Returns the injected dependency, or builds the Claude one (replying 503 when there is no API key). */
  function resolve<T>(current: T | undefined, make: () => T, res: express.Response): T | null {
    if (current) return current;
    if (!process.env.ANTHROPIC_API_KEY) {
      res.status(503).json({ error: "ANTHROPIC_API_KEY is not configured on the server" });
      return null;
    }
    return make();
  }

  const messagesOf = (convId: number) =>
    db
      .prepare(
        `SELECT role, content, help_level AS helpLevel, from_suggestion AS fromSuggestion, errors, correction, score
         FROM messages WHERE conversation_id = ? ORDER BY id`,
      )
      .all(convId) as MessageRow[];

  const statsOf = (convId: number): RunStats | null => {
    const user = messagesOf(convId).filter((m) => m.role === "user");
    if (!user.length) return null;
    const mistakes = user.reduce((n, m) => n + (m.errors ?? 0), 0);
    const conv = db.prepare("SELECT no_help AS noHelp FROM conversations WHERE id = ?").get(convId) as { noHelp: number };
    const scores = user.map((m) => m.score).filter((n): n is number => n !== null);
    return {
      messages: user.length,
      mistakes,
      errorsPerMessage: Math.round((mistakes / user.length) * 100) / 100,
      unaided: user.filter((m) => m.helpLevel === 0 && m.fromSuggestion === 0).length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      noHelpRun: conv.noHelp === 1,
    };
  };

  app.post("/api/chat", async (req, res) => {
    const { scenarioId, conversationId, message, spoken, clarity, helpLevel, fromSuggestion, noHelp } = req.body ?? {};
    const scenario = typeof scenarioId === "string" ? findScenario(scenarioId) : undefined;
    if (!scenario || typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE) {
      res.status(400).json({ error: `valid scenarioId and message (max ${MAX_MESSAGE} chars) are required` });
      return;
    }
    const t = resolve(tutor, () => (tutor = createClaudeTutor()), res);
    if (!t) return;

    let convId: number;
    let history: ChatMessage[];
    let noHelpRun: boolean;
    if (conversationId === undefined) {
      noHelpRun = noHelp === true;
      convId = Number(
        db.prepare("INSERT INTO conversations (scenario_id, no_help) VALUES (?, ?)").run(scenario.id, noHelpRun ? 1 : 0).lastInsertRowid,
      );
      history = [{ role: "assistant", content: scenario.opener }];
    } else {
      const conv = db
        .prepare("SELECT id, no_help AS noHelp FROM conversations WHERE id = ? AND scenario_id = ?")
        .get(conversationId, scenario.id) as { id: number; noHelp: number } | undefined;
      if (!conv) {
        res.status(404).json({ error: "conversation not found" });
        return;
      }
      convId = conversationId;
      noHelpRun = conv.noHelp === 1;
      history = messagesOf(convId).map(({ role, content }) => ({ role, content }));
      if (!history.length || history[0].role !== "assistant") history.unshift({ role: "assistant", content: scenario.opener });
    }

    try {
      const lvl = level();
      const result = await t({ scenario, level: lvl, history, message: message.trim(), spoken: spoken === true, noHelp: noHelpRun });
      const help = noHelpRun ? undefined : result.help;
      const hint = Number.isInteger(helpLevel) ? Math.max(0, Math.min(3, helpLevel)) : 0;
      const correction = { ...result.correction, score: clampScore(result.correction.score) };
      const heardClarity = spoken === true && typeof clarity === "number" && clarity >= 0 && clarity <= 1 ? clarity : null;
      const messageId = db.transaction(() => {
        if (conversationId === undefined) {
          db.prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)").run(convId, scenario.opener);
        }
        const inserted = db
          .prepare(
            `INSERT INTO messages (conversation_id, role, content, help_level, from_suggestion, errors, correction, score, spoken, clarity)
             VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            convId,
            message.trim(),
            noHelpRun ? 0 : hint,
            !noHelpRun && fromSuggestion === true ? 1 : 0,
            correction.errors.length,
            JSON.stringify(correction),
            correction.score,
            spoken === true ? 1 : 0,
            heardClarity,
          );
        db.prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, 'assistant', ?)").run(convId, result.reply);
        for (const e of result.correction.errors) {
          db.prepare("INSERT INTO mistakes (category, original, fixed) VALUES (?, ?, ?)").run(e.category, e.original, e.fixed);
          // Each mistake becomes a review card (front: the fixed phrase, back: what was wrong).
          db.prepare("INSERT OR IGNORE INTO cards (front, back, level, topic) VALUES (?, ?, ?, 'mistakes')").run(
            e.fixed,
            `Antes escribiste: "${e.original}" (${e.category})`,
            lvl,
          );
        }
        return Number(inserted.lastInsertRowid);
      })();
      res.json({ conversationId: convId, messageId, reply: result.reply, reply_es: result.reply_es, correction, help });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "The tutor is unavailable right now, try again" });
    }
  });

  // Help for the question currently on screen, one step at a time: `part` is "ideas" (fast model) or "rest" (starter and
  // full answers). Opening-question help is cached per scenario, level and part.
  app.post("/api/chat/help", async (req, res) => {
    const { scenarioId, conversationId, part } = req.body ?? {};
    const scenario = typeof scenarioId === "string" ? findScenario(scenarioId) : undefined;
    if (!scenario || (part !== "ideas" && part !== "rest")) {
      res.status(400).json({ error: 'valid scenarioId and part ("ideas" or "rest") are required' });
      return;
    }
    let question = scenario.opener;
    let history: ChatMessage[] = [];
    if (conversationId !== undefined) {
      const conv = db.prepare("SELECT id FROM conversations WHERE id = ? AND scenario_id = ?").get(conversationId, scenario.id);
      if (!conv) {
        res.status(404).json({ error: "conversation not found" });
        return;
      }
      const all = messagesOf(conversationId).map(({ role, content }) => ({ role, content }));
      if (all.length && all[all.length - 1].role === "assistant") {
        question = all[all.length - 1].content;
        history = all.slice(0, -1);
      }
    }
    const lvl = level();
    const cacheKey = `v4:${scenario.id}:${lvl}:${part}`; // bump the prefix when the help shape changes
    const isOpener = question === scenario.opener && history.length === 0;
    if (isOpener) {
      const cached = db.prepare("SELECT json FROM help_cache WHERE key = ?").get(cacheKey) as { json: string } | undefined;
      if (cached) {
        res.json({ help: JSON.parse(cached.json) as HelpIdeas | HelpRest });
        return;
      }
    }
    const input = { scenario, level: lvl, question, history };
    let help: HelpIdeas | HelpRest;
    try {
      if (part === "ideas") {
        const h = resolve(ideasHelper, () => (ideasHelper = createClaudeIdeasHelper()), res);
        if (!h) return;
        help = await h(input);
      } else {
        const h = resolve(helper, () => (helper = createClaudeHelper()), res);
        if (!h) return;
        help = await h(input);
      }
      if (isOpener) db.prepare("INSERT OR REPLACE INTO help_cache (key, json) VALUES (?, ?)").run(cacheKey, JSON.stringify(help));
      res.json({ help });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Help is unavailable right now, try again" });
    }
  });

  // Extra feedback on one answer of yours, requested when its details panel is opened. Generated once, then stored.
  app.post("/api/chat/details", async (req, res) => {
    const convId = Number(req.body?.conversationId);
    const messageId = Number(req.body?.messageId);
    const row = db
      .prepare(
        `SELECT m.id, m.content, m.correction, m.spoken, c.scenario_id AS scenarioId FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE m.id = ? AND m.conversation_id = ? AND m.role = 'user'`,
      )
      .get(messageId, convId) as { id: number; content: string; correction: string | null; spoken: number; scenarioId: string } | undefined;
    const scenario = row ? findScenario(row.scenarioId) : undefined;
    if (!row || !scenario) {
      res.status(404).json({ error: "answer not found" });
      return;
    }
    const cached = db.prepare("SELECT json FROM message_details WHERE message_id = ?").get(row.id) as { json: string } | undefined;
    if (cached) {
      res.json({ details: JSON.parse(cached.json) });
      return;
    }
    const d = resolve(detailer, () => (detailer = createClaudeDetailer()), res);
    if (!d) return;
    try {
      const before = db
        .prepare("SELECT content FROM messages WHERE conversation_id = ? AND id < ? AND role = 'assistant' ORDER BY id DESC LIMIT 1")
        .get(convId, row.id) as { content: string } | undefined;
      const correction = row.correction
        ? (JSON.parse(row.correction) as { corrected: string; errors: { category: string; original: string; fixed: string }[] })
        : { corrected: row.content, errors: [] };
      const details = await d({
        scenario,
        level: level(),
        question: before?.content ?? scenario.opener,
        answer: row.content,
        corrected: correction.corrected,
        errors: correction.errors,
        spoken: row.spoken === 1,
      });
      db.prepare("INSERT OR REPLACE INTO message_details (message_id, json) VALUES (?, ?)").run(row.id, JSON.stringify(details));
      res.json({ details });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "Details are unavailable right now, try again" });
    }
  });

  // Summary of a finished practice conversation. Generated once, then stored.
  app.post("/api/chat/summary", async (req, res) => {
    const convId = Number(req.body?.conversationId);
    const conv = db.prepare("SELECT id, scenario_id AS scenarioId FROM conversations WHERE id = ?").get(convId) as
      | { id: number; scenarioId: string }
      | undefined;
    const scenario = conv ? findScenario(conv.scenarioId) : undefined;
    if (!conv || !scenario) {
      res.status(404).json({ error: "conversation not found" });
      return;
    }
    const stats = statsOf(convId);
    if (!stats) {
      res.status(409).json({ error: "answer at least one question first" });
      return;
    }
    const previousRow = db
      .prepare(
        `SELECT c.id FROM conversations c WHERE c.scenario_id = ? AND c.id < ?
         AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user')
         ORDER BY c.id DESC LIMIT 1`,
      )
      .get(scenario.id, convId) as { id: number } | undefined;
    const previous = previousRow ? statsOf(previousRow.id) : null;

    const cached = db.prepare("SELECT json FROM conversation_summaries WHERE conversation_id = ?").get(convId) as { json: string } | undefined;
    if (cached) {
      res.json({ summary: JSON.parse(cached.json), stats, previous });
      return;
    }
    const s = resolve(summarizer, () => (summarizer = createClaudeSummarizer()), res);
    if (!s) return;
    try {
      const turns: { question: string; answer: string; corrected: string; errors: number }[] = [];
      let question = scenario.opener;
      for (const m of messagesOf(convId)) {
        if (m.role === "assistant") question = m.content;
        else {
          const fix = m.correction ? (JSON.parse(m.correction) as { corrected: string }).corrected : m.content;
          turns.push({ question, answer: m.content, corrected: fix, errors: m.errors ?? 0 });
        }
      }
      const summary = await s({ scenario, level: level(), turns });
      db.prepare("INSERT OR REPLACE INTO conversation_summaries (conversation_id, json) VALUES (?, ?)").run(convId, JSON.stringify(summary));
      res.json({ summary, stats, previous });
    } catch (err) {
      console.error(err);
      res.status(502).json({ error: "The summary is unavailable right now, try again" });
    }
  });

  // Scenarios you have practiced, to offer a "retry without help" run.
  app.get("/api/chat/practiced", (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.scenario_id AS scenarioId, COUNT(*) AS runs FROM conversations c
         WHERE EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user')
         GROUP BY c.scenario_id`,
      )
      .all() as { scenarioId: string; runs: number }[];
    res.json({ practiced: Object.fromEntries(rows.map((r) => [r.scenarioId, r.runs])) });
  });

  // Saves a phrase from a suggestion, a better answer or a summary as a review card.
  app.post("/api/phrases", (req, res) => {
    const front = typeof req.body?.front === "string" ? req.body.front.trim() : "";
    const back = typeof req.body?.back === "string" ? req.body.back.trim() : "";
    if (front.length < 2 || front.length > 240 || back.length < 1 || back.length > 240) {
      res.status(400).json({ error: "front and back are required (max 240 chars)" });
      return;
    }
    const added = db.prepare("INSERT OR IGNORE INTO cards (front, back, level, topic) VALUES (?, ?, ?, 'phrases')").run(front, back, level());
    res.json({ saved: added.changes === 1 });
  });
}
