import { describe, expect, it } from "vitest";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { pickQuestions, findInterviewType, QUESTIONS_PER_INTERVIEW } from "./interviews.js";
import { normalizeReport, type Report } from "./evaluator.js";
import { xpForScore } from "./interviewRoutes.js";

const report: Report = {
  overall: 140, // out of range on purpose: must be clamped
  cefr: "A2",
  scores: { fluency: 55, grammar: 48, vocabulary: 60, structure: 40, professionalism: 70 },
  summary_es: "Buen inicio.",
  strengths: ["Claridad"],
  improvements: ["Usa STAR"],
  mistakes: [{ category: "tense", original: "I work there yesterday", fixed: "I worked there yesterday" }],
  answers: [{ question: "q", feedback_es: "ok", better_answer: "I worked there for two years." }],
};

describe("interview questions", () => {
  it("opens with an intro and picks a fixed number of unique questions", () => {
    for (const id of ["behavioral", "technical-talk", "system-design", "hr-screen", "mixed"]) {
      const qs = pickQuestions(findInterviewType(id)!);
      expect(qs.length).toBe(QUESTIONS_PER_INTERVIEW);
      expect(new Set(qs).size).toBe(qs.length);
    }
    expect(pickQuestions(findInterviewType("mixed")!)[0]).toMatch(/yourself/);
  });
});

describe("interview api", () => {
  it("runs an interview end to end and awards XP once", async () => {
    const db = openDb(":memory:");
    let evaluations = 0;
    const evaluator = async (input: { turns: { spoken: boolean }[] }) => {
      evaluations++;
      expect(input.turns.length).toBe(QUESTIONS_PER_INTERVIEW);
      expect(input.turns[0].spoken).toBe(true);
      return report;
    };
    const server = createApp(db, undefined, evaluator).listen(0);
    const { port } = server.address() as { port: number };
    const base = `http://127.0.0.1:${port}`;
    const post = (path: string, body: unknown) =>
      fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    expect((await post("/api/interview/start", { type: "nope" })).status).toBe(400);
    const start = await (await post("/api/interview/start", { type: "behavioral" })).json();
    expect(start.total).toBe(QUESTIONS_PER_INTERVIEW);

    expect((await post(`/api/interview/${start.interviewId}/finish`, {})).status).toBe(409);
    expect((await post(`/api/interview/${start.interviewId}/answer`, { answer: "  " })).status).toBe(400);

    let last: { done: boolean } = { done: false };
    for (let i = 0; i < QUESTIONS_PER_INTERVIEW; i++) {
      last = await (await post(`/api/interview/${start.interviewId}/answer`, { answer: `Answer ${i}`, spoken: i === 0 })).json();
    }
    expect(last.done).toBe(true);
    expect((await post(`/api/interview/${start.interviewId}/answer`, { answer: "extra" })).status).toBe(409);

    const [a, b] = await Promise.all([
      post(`/api/interview/${start.interviewId}/finish`, {}).then((r) => r.json()),
      post(`/api/interview/${start.interviewId}/finish`, {}).then((r) => r.json()),
    ]);
    expect(a.report.overall).toBe(100);
    expect(b.xpAwarded).toBe(xpForScore(100));
    const again = await (await post(`/api/interview/${start.interviewId}/finish`, {})).json();
    expect(again.xp).toBe(xpForScore(100)); // awarded exactly once
    expect(db.prepare("SELECT COUNT(*) AS n FROM cards WHERE topic = 'mistakes'").get()).toEqual({ n: 1 });
    expect(evaluations).toBeGreaterThanOrEqual(1);

    const history = await (await fetch(`${base}/api/interview/history`)).json();
    expect(history.best).toBe(100);
    server.close();
  });

  it("normalizes scores", () => {
    expect(normalizeReport(report).overall).toBe(100);
  });
});
