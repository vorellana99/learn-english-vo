import { describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import type { Help } from "./help.js";
import type { TutorInput } from "./tutor.js";

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
    { level: "natural", text: "I'm a full stack developer with [number] years of experience.", translation_es: "Soy desarrollador full stack con [número] años de experiencia." },
  ],
};

const correction = (errors: number) => ({
  corrected: "I have three years of experience.",
  natural: "I've got three years of experience.",
  explanation_es: "Usa 'have'.",
  errors: Array.from({ length: errors }, (_, i) => ({ category: "grammar" as const, original: `bad ${i}`, fixed: `good ${i}` })),
});

async function setup() {
  const db = openDb(":memory:");
  const tutorCalls: TutorInput[] = [];
  const helperCalls: { question: string }[] = [];
  let summaries = 0;
  const server = createApp(
    db,
    async (input) => {
      tutorCalls.push(input);
      return { reply: "Nice! Tell me more.", reply_es: "¡Bien! Cuéntame más.", correction: correction(1), help: input.noHelp ? undefined : help };
    },
    undefined,
    {
      helper: async (input) => {
        helperCalls.push({ question: input.question });
        return help;
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
  return { db, server, base, post, tutorCalls, helperCalls, summaries: () => summaries };
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

  it("builds opener help once per scenario and level, then serves it from the cache", async () => {
    const { server, post, helperCalls } = await setup();
    const a = await (await post("/api/chat/help", { scenarioId: "standup" })).json();
    const b = await (await post("/api/chat/help", { scenarioId: "standup" })).json();
    expect(a.help).toEqual(b.help);
    expect(helperCalls.length).toBe(1);
    expect((await post("/api/chat/help", { scenarioId: "nope" })).status).toBe(400);
    expect((await post("/api/chat/help", { scenarioId: "standup", conversationId: 999 })).status).toBe(404);
    server.close();
  });

  it("asks for help about the latest interviewer message in an ongoing conversation", async () => {
    const { server, post, helperCalls } = await setup();
    const r = await (await post("/api/chat", { scenarioId: "standup", message: "Yesterday I fixed bugs" })).json();
    await post("/api/chat/help", { scenarioId: "standup", conversationId: r.conversationId });
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
