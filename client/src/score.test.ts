import { describe, expect, it } from "vitest";
import { clampScore, scoreBand } from "./score";

describe("scoreBand", () => {
  it("maps scores to five color levels at the boundaries", () => {
    const keys = [100, 90, 89, 75, 74, 60, 59, 40, 39, 0].map((n) => scoreBand(n).key);
    expect(keys).toEqual(["excellent", "excellent", "good", "good", "fair", "fair", "improve", "improve", "practice", "practice"]);
  });

  it("clamps and rounds out-of-range values", () => {
    expect(clampScore(140)).toBe(100);
    expect(clampScore(-3)).toBe(0);
    expect(clampScore(84.6)).toBe(85);
    expect(clampScore(Number.NaN)).toBe(0);
    expect(scoreBand(250).key).toBe("excellent");
  });

  it("gives every level its own color", () => {
    const colors = [95, 80, 65, 50, 10].map((n) => scoreBand(n).color);
    expect(new Set(colors).size).toBe(5);
  });
});
