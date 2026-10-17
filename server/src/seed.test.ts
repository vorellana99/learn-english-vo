import { describe, expect, it } from "vitest";
import { seedCards } from "./seed.js";
import { scenarios } from "./scenarios.js";
import { interviewTypes, questionEs } from "./interviews.js";

describe("content", () => {
  it("has no duplicate cards and covers every level", () => {
    const fronts = seedCards.map((s) => s.front);
    expect(new Set(fronts).size).toBe(fronts.length);
    for (const level of ["A1", "A2", "B1", "B2"]) {
      expect(seedCards.filter((s) => s.level === level).length).toBeGreaterThanOrEqual(40);
    }
    expect(seedCards.every((s) => s.front.trim() && s.back.trim())).toBe(true);
  });

  it("has unique scenario ids with level hints", () => {
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length);
    expect(scenarios.length).toBeGreaterThanOrEqual(10);
  });

  it("has a Spanish translation for every scenario opener and interview question", () => {
    for (const s of scenarios) expect(s.opener_es.trim(), s.id).not.toBe("");
    for (const t of interviewTypes) for (const q of t.questions) expect(questionEs(q), q).not.toBe("");
  });
});
