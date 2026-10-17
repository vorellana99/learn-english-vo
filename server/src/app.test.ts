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
    expect(session.plan.mode).toBe("normal");
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
    const seen: (boolean | undefined)[] = [];
    const tutor = async (input: { spoken?: boolean }) => {
      seen.push(input.spoken);
      return {
      reply: "Nice! Where did you work before?",
      reply_es: "¡Bien! ¿Dónde trabajaste antes?",
      correction: {
        corrected: "I have three years of experience.",
        natural: "I've got three years of experience.",
        explanation_es: "Usa 'have' para experiencia.",
        score: 62,
        errors: [{ category: "grammar" as const, original: "I has three years", fixed: "I have three years of experience." }],
      },
    };
    };
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
    const r2 = await post({ scenarioId: "interview-intro", conversationId: body.conversationId, message: "Again", spoken: true });
    expect(seen).toEqual([false, true]);
    expect(r2.status).toBe(200);
    expect((await post({ scenarioId: "nope", message: "x" })).status).toBe(400);
    expect((await post({ scenarioId: "interview-intro", conversationId: 999, message: "x" })).status).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS n FROM mistakes").get()).toEqual({ n: 2 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM cards WHERE topic = 'mistakes'").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM messages").get()).toEqual({ n: 5 });
    server.close();
  });
});

describe("adaptive session and insights", () => {
  it("prioritizes mistake cards, respects level and mode size, and reports insights", async () => {
    const db = openDb(":memory:");
    db.prepare("INSERT INTO cards (front, back, level, topic) VALUES ('I has','x','A1','mistakes')").run();
    const server = createApp(db).listen(0);
    const { port } = server.address() as { port: number };
    const get = async (path: string) => (await fetch(`http://127.0.0.1:${port}${path}`)).json();

    const quick = await get("/api/session?mode=quick");
    expect(quick.cards.length).toBe(3);
    expect(quick.cards[0].topic).toBe("mistakes");
    expect(quick.cards.every((c: { level: string }) => c.level === "A1")).toBe(true);
    expect((await get("/api/session?mode=long")).plan.new).toBe(8);

    // A week of failures shrinks the number of new cards.
    const ids = quick.cards.map((c: { id: number }) => c.id);
    const ins = db.prepare("INSERT INTO reviews (card_id, rating) VALUES (?, 0)");
    for (let i = 0; i < 12; i++) ins.run(ids[0]);
    expect((await get("/api/session?mode=normal")).plan.new).toBe(3);

    db.prepare("INSERT INTO mistakes (category, original, fixed) VALUES ('tense','a','b')").run();
    const insights = await get("/api/insights");
    expect(insights.weakCategories[0].category).toBe("tense");
    expect(insights.weakTopics[0].topic).toBe("mistakes");
    expect(insights.bestHour).not.toBeNull();
    expect(insights.activeDays.at(-1).reviews).toBe(12);
    const profile = await get("/api/profile");
    expect(profile.levels.length).toBe(4);
    expect(profile.dueCount).toBe(0);
    server.close();
  });
});

describe("local day handling", () => {
  it("rolls the streak day over at the client's local midnight", async () => {
    const db = openDb(":memory:");
    const server = createApp(db).listen(0);
    const { port } = server.address() as { port: number };
    const base = `http://127.0.0.1:${port}`;
    const review = (tz: number) =>
      fetch(`${base}/api/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId: 1, rating: 2, tz }),
      });
    await review(-840); // UTC+14: local date is the day after UTC (or the same later in the day)
    const localDate = new Date(Date.now() + 840 * 60_000).toISOString().slice(0, 10);
    expect(db.prepare("SELECT last_active AS d FROM profile").get()).toEqual({ d: localDate });
    const profile = await (await fetch(`${base}/api/profile?tz=-840`)).json();
    expect(profile.reviewedToday).toBe(true);
    server.close();
  });
});
