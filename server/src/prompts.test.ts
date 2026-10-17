import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createClaudeEvaluator } from "./evaluator.js";
import { createClaudeSummarizer } from "./summary.js";
import { findScenario } from "./scenarios.js";
import { createClaudeDetailer } from "./details.js";
import { createClaudeTutor } from "./tutor.js";

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

  it("tells the detailer to avoid placeholders and to ask about pronunciation only when dictated", async () => {
    const empty = { alternatives: [], vocabulary: [], expected_es: "", tip_es: "", pronunciation_es: "" };
    const base = { scenario: findScenario("standup")!, level: "A2", question: "q", answer: "a", corrected: "a", errors: [] };
    const typed = capture(empty);
    await createClaudeDetailer(typed.client)({ ...base, spoken: false });
    expect(typed.seen[0]).toContain("never use placeholders, brackets or blanks");
    expect(typed.seen[0]).toContain("`pronunciation_es` must be an empty string");
    const dictated = capture(empty);
    await createClaudeDetailer(dictated.client)({ ...base, spoken: true });
    expect(dictated.seen[0]).toContain("mispronounced");
    expect(dictated.seen[0]).not.toContain("must be an empty string");
  });

  it("gives the tutor a calibrated 0-100 scoring rubric", async () => {
    const reply = { reply: "", reply_es: "", correction: { corrected: "", natural: "", explanation_es: "", score: 50, errors: [] } };
    const { client, seen } = capture(reply);
    await createClaudeTutor(client)({ scenario: findScenario("standup")!, level: "A1", history: [], message: "yes", noHelp: true });
    expect(seen[0]).toContain("`score` is a calibrated 0-100 rating");
    expect(seen[0]).toContain("90-100 only for correct, natural and relevant answers");
  });
});
