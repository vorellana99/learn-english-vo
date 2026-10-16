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
