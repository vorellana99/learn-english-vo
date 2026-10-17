import { describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { shadowingXp } from "./shadowing.js";

describe("shadowing api", () => {
  it("serves sentences only, records attempts once per call and reports hard words", async () => {
    const db = openDb(":memory:");
    const server = createApp(db).listen(0);
    const { port } = server.address() as { port: number };
    const base = `http://127.0.0.1:${port}`;
    const post = (body: unknown) =>
      fetch(`${base}/api/shadowing/result`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    const { phrases } = await (await fetch(`${base}/api/shadowing/session?count=5`)).json();
    expect(phrases.length).toBe(5);
    for (const p of phrases) {
      expect(p.front.trim().split(/\s+/).length).toBeGreaterThanOrEqual(3);
      expect(p.level).toBe("A1"); // a new learner only gets A1 sentences
    }

    expect((await post({ cardId: phrases[0].id, score: "x" })).status).toBe(400);
    expect((await post({ cardId: 99999, score: 80 })).status).toBe(404);
    const r = await (await post({ cardId: phrases[0].id, score: 95.4, missed: ["understand", "", 5, "repeat"] })).json();
    expect(r.xpAwarded).toBe(10);
    expect(r.xp).toBe(10);
    expect(r.streak).toBe(1);
    await post({ cardId: phrases[1].id, score: 40, missed: ["understand"] });

    const insights = await (await fetch(`${base}/api/insights`)).json();
    expect(insights.shadowing.attempts).toBe(2);
    expect(insights.activeDays.at(-1).reviews).toBe(2); // shadowing attempts count as practice
    expect(insights.bestHour).not.toBeNull();
    expect(insights.shadowing.avgScore).toBe(68);
    expect(insights.shadowing.hardWords[0]).toEqual({ word: "understand", count: 2 });

    // Practiced phrases with high scores move to the back of the queue.
    const next = await (await fetch(`${base}/api/shadowing/session?count=3`)).json();
    expect(next.phrases.map((p: { id: number }) => p.id)).not.toContain(phrases[0].id);
    server.close();
  });

  it("maps scores to XP", () => {
    expect([100, 90, 89, 70, 69, 50, 49, 0].map(shadowingXp)).toEqual([10, 10, 6, 6, 3, 3, 1, 1]);
  });
});
