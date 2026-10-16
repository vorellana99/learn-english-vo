import { describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { schedule, initialState } from "./srs.js";
import { levelFor, nextStreak } from "./progress.js";

describe("srs", () => {
  it("resets interval on again and grows on good", () => {
    const a = schedule(initialState, 2);
    expect(a.intervalDays).toBe(1);
    const b = schedule(a, 2);
    expect(b.intervalDays).toBe(6);
    expect(schedule(b, 0).intervalDays).toBe(0);
  });
});

describe("progress", () => {
  it("computes level and streak", () => {
    expect(levelFor(1200).level).toBe("A2");
    expect(nextStreak(3, "2026-01-01", "2026-01-02")).toBe(4);
    expect(nextStreak(3, "2026-01-01", "2026-01-05")).toBe(1);
  });
});

describe("api", () => {
  it("serves a session and records a review", async () => {
    const app = createApp(openDb(":memory:"));
    const server = app.listen(0);
    const { port } = server.address() as { port: number };
    const base = `http://127.0.0.1:${port}`;
    const session = await (await fetch(`${base}/api/session`)).json();
    expect(session.cards.length).toBe(5);
    const r = await fetch(`${base}/api/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: session.cards[0].id, rating: 2 }),
    });
    const body = await r.json();
    expect(body.xp).toBe(10);
    expect(body.streak).toBe(1);
    const bad = await fetch(`${base}/api/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: 1, rating: 9 }),
    });
    expect(bad.status).toBe(400);
    server.close();
  });
});

describe("chat api", () => {
  it("stores conversation, mistakes and creates review cards", async () => {
    const db = openDb(":memory:");
    const tutor = async () => ({
      reply: "Nice! Where did you work before?",
      correction: {
        corrected: "I have three years of experience.",
        natural: "I've got three years of experience.",
        explanation_es: "Usa 'have' para experiencia.",
        errors: [{ category: "grammar" as const, original: "I has three years", fixed: "I have three years of experience." }],
      },
    });
    const server = createApp(db, tutor).listen(0);
    const { port } = server.address() as { port: number };
    const post = (body: unknown) =>
      fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const r = await post({ scenarioId: "interview-intro", message: "I has three years" });
    const body = await r.json();
    expect(body.reply).toContain("Where");
    const r2 = await post({ scenarioId: "interview-intro", conversationId: body.conversationId, message: "Again" });
    expect(r2.status).toBe(200);
    expect((await post({ scenarioId: "nope", message: "x" })).status).toBe(400);
    expect((await post({ scenarioId: "interview-intro", conversationId: 999, message: "x" })).status).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS n FROM mistakes").get()).toEqual({ n: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM cards WHERE topic = 'mistakes'").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 5 });
    server.close();
  });
});
