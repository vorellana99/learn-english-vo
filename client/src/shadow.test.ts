import { describe, expect, it } from "vitest";
import { compare, missedWords } from "./shadow";

describe("compare", () => {
  it("scores an exact repetition at 100, ignoring case, punctuation and apostrophes", () => {
    const c = compare("I'm learning English.", "im LEARNING english");
    expect(c.score).toBe(100);
    expect(c.words.every((w) => w.ok)).toBe(true);
  });

  it("flags skipped words without shifting the rest", () => {
    const c = compare("Can you repeat that, please?", "can you that please");
    expect(c.words.map((w) => w.ok)).toEqual([true, true, false, true, true]);
    expect(c.score).toBe(80);
    expect(missedWords(c)).toEqual(["repeat"]);
  });

  it("penalizes added words, up to 15 points", () => {
    expect(compare("Good morning", "well good morning everyone").score).toBe(90);
    expect(compare("Hi", "hi a b c d e f g").score).toBe(85);
  });

  it("handles empty speech and repeated words", () => {
    expect(compare("Thank you very much", "").score).toBe(0);
    const c = compare("very very good", "very good");
    expect(c.matched).toBe(2);
    expect(c.words.filter((w) => w.ok).length).toBe(2);
  });
});
