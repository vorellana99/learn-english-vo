import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createClaudeEvaluator } from "./evaluator.js";
import { createClaudeSummarizer } from "./summary.js";
import { findScenario } from "./scenarios.js";

/** Records the system prompt of the one request a factory makes. */
function capture(parsed: unknown) {
  const seen: string[] = [];
  const client = {
    beta: {
      messages: {
        parse: async (p: { system: string }) => {
          seen.push(p.system);
          return { stop_reason: "end_turn", parsed_output: parsed };
        },
      },
    },
  } as unknown as Anthropic;
  return { client, seen };
}

describe("model answers are written out in full", () => {
  it("tells the interview evaluator to avoid placeholders", async () => {
    const { client, seen } = capture({
      overall: 70, cefr: "B1",
      scores: { fluency: 1, grammar: 1, vocabulary: 1, structure: 1, professionalism: 1 },
      summary_es: "", strengths: [], improvements: [], mistakes: [], answers: [],
    });
    await createClaudeEvaluator(client)({ type: "behavioral", level: "A2", turns: [{ question: "q", answer: "a", spoken: false }] });
    expect(seen[0]).toContain("never use placeholders, brackets or blanks");
    expect(seen[0]).not.toContain("[X%]");
  });

  it("tells the summarizer to avoid placeholders", async () => {
    const { client, seen } = capture({ summary_es: "", rewritten: [], new_phrases: [], tips: [] });
    await createClaudeSummarizer(client)({
      scenario: findScenario("standup")!,
      level: "A2",
      turns: [{ question: "q", answer: "a", corrected: "a", errors: 0 }],
    });
    expect(seen[0]).toContain("Never use placeholders, brackets or blanks");
    expect(seen[0]).not.toContain("[brackets] for");
  });
});
