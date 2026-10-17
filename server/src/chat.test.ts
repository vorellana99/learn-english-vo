import { describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import type { Help } from "./help.js";
import type { TutorInput } from "./tutor.js";
import type { Details, DetailsInput } from "./details.js";
import { answerXp } from "./progress.js";

const help: Help = {
  ideas: [
    { en: "your role", es: "tu rol" },
    { en: "years of experience", es: "años de experiencia" },
  ],
  starter: "I have worked as ...",
  starter_es: "He trabajado como ...",
  suggestions: [
    { level: "simple", text: "I am a developer.", translation_es: "Soy desarrollador." },
    { level: "medium", text: "I work as a full stack developer.", translation_es: "Trabajo como desarrollador full stack." },
    { level: "natural", text: "I'm a full stack developer with five years of experience.", translation_es: "Soy desarrollador full stack con cinco años de experiencia." },
  ],
};

const details: Details = {
  alternatives: [
    { level: "simple", text: "I have three years.", translation_es: "Tengo tres años." },
    { level: "medium", text: "I have three years of experience.", translation_es: "Tengo tres años de experiencia." },
    { level: "natural", text: "I've got about three years of hands-on experience.", translation_es: "Tengo unos tres años de experiencia práctica." },
  ],
  vocabulary: [{ text: "hands-on", translation_es: "práctico" }],
  expected_es: "La pregunta pedía tu experiencia.",
  tip_es: "Añade un ejemplo.",
  pronunciation_es: "",
};

const correction = (errors: number, score = 70) => ({
  score,
  corrected: "I have three years of experience.",
  natural: "I've got three years of experience.",
  explanation_es: "Usa 'have'.",
  errors: Array.from({ length: errors }, (_, i) => ({ category: "grammar" as const, original: `bad ${i}`, fixed: `good ${i}` })),
});

async function setup() {
  const db = openDb(":memory:");
  const tutorCalls: TutorInput[] = [];
  const helperCalls: { part: string; question: string }[] = [];
  let summaries = 0;
  const detailCalls: DetailsInput[] = [];
  let nextScore = 70;
  const server = createApp(
    db,
    async (input) => {
      tutorCalls.push(input);
      return { reply: "Nice! Tell me more.", reply_es: "¡Bien! Cuéntame más.", correction: correction(1, nextScore), help: input.noHelp ? undefined : help };
    },
    undefined,
    {
      helper: async (input) => {
        helperCalls.push({ part: "rest", question: input.question });
        return { starter: help.starter, starter_es: help.starter_es, suggestions: help.suggestions };
      },
      ideasHelper: async (input) => {
        helperCalls.push({ part: "ideas", question: input.question });
        return { ideas: help.ideas };
      },
      detailer: async (input) => {
        detailCalls.push(input);
        return details;
      },
      summarizer: async (input) => {
        summaries++;
        return {
          summary_es: "Buen trabajo.",
          rewritten: input.turns.map((t) => ({ question: t.question, question_es: "pregunta", yours: t.answer, better: t.corrected, better_es: "mejor" })),
          new_phrases: [{ text: "I've got three years of experience.", translation_es: "Tengo tres años de experiencia." }],
          tips: ["Sigue así"],
        };
      },
    },
  ).listen(0);
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;
  const post = (path: string, body: unknown) =>
    fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { db, server, base, post, tutorCalls, helperCalls, detailCalls, setScore: (n: number) => (nextScore = n), summaries: () => summaries };
}

describe("reply suggestions", () => {
  it("returns help with each reply and stores how much help was used", async () => {
    const { db, server, post } = await setup();
    const r = await (await post("/api/chat", { scenarioId: "interview-intro", message: "I has three years", helpLevel: 2, fromSuggestion: true })).json();
    expect(r.reply_es).toBe("¡Bien! Cuéntame más.");
    expect(r.help.ideas[0]).toEqual({ en: "your role", es: "tu rol" });
    expect(r.help.suggestions.map((s: { level: string }) => s.level)).toEqual(["simple", "medium", "natural"]);
    await post("/api/chat", { scenarioId: "interview-intro", conversationId: r.conversationId, message: "Second answer", helpLevel: 99 });
    const rows = db.prepare("SELECT help_level AS h, from_suggestion AS f, errors FROM messages WHERE role = 'user' ORDER BY id").all();
    expect(rows).toEqual([
      { h: 2, f: 1, errors: 1 },
      { h: 3, f: 0, errors: 1 }, // out-of-range help level is clamped
    ]);
    server.close();
  });

  it("builds the opener help one step at a time and caches each step", async () => {
    const { server, post, helperCalls } = await setup();
    const ideas1 = await (await post("/api/chat/help", { scenarioId: "standup", part: "ideas" })).json();
    const ideas2 = await (await post("/api/chat/help", { scenarioId: "standup", part: "ideas" })).json();
    expect(ideas1.help).toEqual({ ideas: help.ideas });
    expect(ideas2.help).toEqual(ideas1.help);
    expect(helperCalls.map((c) => c.part)).toEqual(["ideas"]); // the second request came from the cache

    const rest = await (await post("/api/chat/help", { scenarioId: "standup", part: "rest" })).json();
    expect(rest.help.suggestions.map((s: { level: string }) => s.level)).toEqual(["simple", "medium", "natural"]);
    expect(rest.help).not.toHaveProperty("ideas");
    await post("/api/chat/help", { scenarioId: "standup", part: "rest" });
    expect(helperCalls.map((c) => c.part)).toEqual(["ideas", "rest"]);

    expect((await post("/api/chat/help", { scenarioId: "nope", part: "ideas" })).status).toBe(400);
    expect((await post("/api/chat/help", { scenarioId: "standup" })).status).toBe(400);
    expect((await post("/api/chat/help", { scenarioId: "standup", part: "all" })).status).toBe(400);
    expect((await post("/api/chat/help", { scenarioId: "standup", part: "ideas", conversationId: 999 })).status).toBe(404);
    server.close();
  });

  it("asks for help about the latest interviewer message in an ongoing conversation", async () => {
    const { server, post, helperCalls } = await setup();
    const r = await (await post("/api/chat", { scenarioId: "standup", message: "Yesterday I fixed bugs" })).json();
    await post("/api/chat/help", { scenarioId: "standup", conversationId: r.conversationId, part: "ideas" });
    expect(helperCalls[0].question).toBe("Nice! Tell me more.");
    server.close();
  });
});

describe("no-help runs, summary and saved phrases", () => {
  it("skips help in a no-help run and compares it with the previous run", async () => {
    const { server, base, post, tutorCalls, summaries } = await setup();
    const first = await (await post("/api/chat", { scenarioId: "standup", message: "one", helpLevel: 3, fromSuggestion: true })).json();
    await post("/api/chat", { scenarioId: "standup", conversationId: first.conversationId, message: "two", helpLevel: 1 });
    const s1 = await (await post("/api/chat/summary", { conversationId: first.conversationId })).json();
    expect(s1.previous).toBeNull();
    expect(s1.stats).toMatchObject({ messages: 2, mistakes: 2, errorsPerMessage: 1, unaided: 0, noHelpRun: false });
    expect(s1.summary.rewritten.length).toBe(2);

    const second = await (await post("/api/chat", { scenarioId: "standup", message: "again", noHelp: true, helpLevel: 3 })).json();
    expect(second.help).toBeUndefined();
    expect(tutorCalls.at(-1)?.noHelp).toBe(true);
    const s2 = await (await post("/api/chat/summary", { conversationId: second.conversationId })).json();
    expect(s2.stats).toMatchObject({ noHelpRun: true, unaided: 1 });
    expect(s2.previous).toMatchObject({ messages: 2, noHelpRun: false });

    await post("/api/chat/summary", { conversationId: second.conversationId });
    expect(summaries()).toBe(2); // the second request for the same conversation came from storage

    const practiced = await (await fetch(`${base}/api/chat/practiced`)).json();
    expect(practiced.practiced.standup).toBe(2);
    server.close();
  });

  it("rejects summaries for missing or empty conversations", async () => {
    const { server, post, db } = await setup();
    expect((await post("/api/chat/summary", { conversationId: 5 })).status).toBe(404);
    const id = Number(db.prepare("INSERT INTO conversations (scenario_id) VALUES ('standup')").run().lastInsertRowid);
    expect((await post("/api/chat/summary", { conversationId: id })).status).toBe(409);
    server.close();
  });

  it("saves phrases as review cards once", async () => {
    const { server, post, db } = await setup();
    const body = { front: "I've got three years of experience.", back: "Tengo tres años de experiencia." };
    expect((await (await post("/api/phrases", body)).json()).saved).toBe(true);
    expect((await (await post("/api/phrases", body)).json()).saved).toBe(false);
    expect((await post("/api/phrases", { front: "x", back: "" })).status).toBe(400);
    expect(db.prepare("SELECT COUNT(*) AS n FROM cards WHERE topic = 'phrases'").get()).toEqual({ n: 1 });
    server.close();
  });
});

describe("answer scores and details", () => {
  it("returns a clamped score and the message id, and stores the score", async () => {
    const { db, server, post, setScore } = await setup();
    setScore(140);
    const high = await (await post("/api/chat", { scenarioId: "standup", message: "one" })).json();
    expect(high.correction.score).toBe(100);
    expect(high.messageId).toBeGreaterThan(0);
    setScore(-5);
    await post("/api/chat", { scenarioId: "standup", conversationId: high.conversationId, message: "two" });
    expect(db.prepare("SELECT score FROM messages WHERE role = 'user' ORDER BY id").all()).toEqual([{ score: 100 }, { score: 0 }]);
    server.close();
  });

  it("adds the average score to the run stats", async () => {
    const { server, post, setScore } = await setup();
    setScore(80);
    const a = await (await post("/api/chat", { scenarioId: "standup", message: "one" })).json();
    setScore(60);
    await post("/api/chat", { scenarioId: "standup", conversationId: a.conversationId, message: "two" });
    const s = await (await post("/api/chat/summary", { conversationId: a.conversationId })).json();
    expect(s.stats.avgScore).toBe(70);
    server.close();
  });

  it("generates the details of an answer once and answers with the matching question", async () => {
    const { server, post, detailCalls } = await setup();
    const a = await (await post("/api/chat", { scenarioId: "standup", message: "Yesterday I fixed bugs", spoken: true, clarity: 0.82 })).json();
    const b = await (await post("/api/chat", { scenarioId: "standup", conversationId: a.conversationId, message: "Second answer" })).json();

    const first = await (await post("/api/chat/details", { conversationId: a.conversationId, messageId: b.messageId })).json();
    expect(first.details.alternatives.map((x: { level: string }) => x.level)).toEqual(["simple", "medium", "natural"]);
    await post("/api/chat/details", { conversationId: a.conversationId, messageId: b.messageId });
    expect(detailCalls.length).toBe(1); // the second request came from storage
    expect(detailCalls[0]).toMatchObject({ question: "Nice! Tell me more.", answer: "Second answer", spoken: false });

    await post("/api/chat/details", { conversationId: a.conversationId, messageId: a.messageId });
    expect(detailCalls[1]).toMatchObject({ answer: "Yesterday I fixed bugs", spoken: true });
    expect(detailCalls[1].question).toMatch(/standup/i); // the scenario opener
    server.close();
  });

  it("rejects details for unknown answers or answers of another conversation", async () => {
    const { server, post } = await setup();
    const a = await (await post("/api/chat", { scenarioId: "standup", message: "one" })).json();
    const other = await (await post("/api/chat", { scenarioId: "standup", message: "other" })).json();
    expect((await post("/api/chat/details", { conversationId: a.conversationId, messageId: 9999 })).status).toBe(404);
    expect((await post("/api/chat/details", { conversationId: a.conversationId, messageId: other.messageId })).status).toBe(404);
    expect((await post("/api/chat/details", {})).status).toBe(404);
    server.close();
  });
});

describe("XP and progress from answers", () => {
  it("maps scores to XP", () => {
    expect([100, 90, 89, 75, 74, 60, 59, 40, 39, 0].map(answerXp)).toEqual([8, 8, 5, 5, 3, 3, 2, 2, 1, 1]);
  });

  it("awards XP by score, starts the streak and counts the answer as practice", async () => {
    const { server, base, post, setScore } = await setup();
    setScore(95);
    const a = await (await post("/api/chat", { scenarioId: "standup", message: "one" })).json();
    expect(a.xpAwarded).toBe(8);
    setScore(30);
    const b = await (await post("/api/chat", { scenarioId: "standup", conversationId: a.conversationId, message: "two" })).json();
    expect(b.xpAwarded).toBe(1);

    const profile = await (await fetch(`${base}/api/profile`)).json();
    expect(profile.xp).toBe(9);
    expect(profile.streak).toBe(1);
    expect(profile.reviewedToday).toBe(true);

    const insights = await (await fetch(`${base}/api/insights`)).json();
    expect(insights.activeDays.at(-1).reviews).toBe(2);
    server.close();
  });

  it("uses the client's local day for the streak", async () => {
    const { db, server, post } = await setup();
    await post("/api/chat", { scenarioId: "standup", message: "one", tz: -840 });
    const local = new Date(Date.now() + 840 * 60_000).toISOString().slice(0, 10);
    expect(db.prepare("SELECT last_active AS d FROM profile").get()).toEqual({ d: local });
    server.close();
  });

  it("reports conversation scores overall, by mission and the latest answers", async () => {
    const { server, base, post, setScore } = await setup();
    for (const [scenarioId, score] of [["standup", 80], ["standup", 60], ["code-review", 90]] as const) {
      setScore(score);
      await post("/api/chat", { scenarioId, message: `answer ${score}` });
    }
    const c = (await (await fetch(`${base}/api/insights`)).json()).conversation;
    expect(c.answers).toBe(3);
    expect(c.avgScore).toBe(77);
    expect(c.byScenario).toEqual([
      { scenarioId: "standup", title: "Daily standup", answers: 2, avgScore: 70 },
      { scenarioId: "code-review", title: "Code review conversation", answers: 1, avgScore: 90 },
    ]);
    expect(c.recent).toEqual([80, 60, 90]);
    server.close();
  });

  it("reports no conversation scores before any answer", async () => {
    const { server, base } = await setup();
    const c = (await (await fetch(`${base}/api/insights`)).json()).conversation;
    expect(c).toEqual({ answers: 0, avgScore: null, byScenario: [], recent: [] });
    server.close();
  });
});
