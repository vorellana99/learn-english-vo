import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Scenario } from "./scenarios.js";

export const ERROR_CATEGORIES = ["grammar", "tense", "preposition", "vocabulary", "word-order", "spelling", "other"] as const;

const TutorOutput = z.object({
  reply: z.string(),
  correction: z.object({
    corrected: z.string(),
    natural: z.string(),
    explanation_es: z.string(),
    errors: z.array(
      z.object({
        category: z.enum(ERROR_CATEGORIES),
        original: z.string(),
        fixed: z.string(),
      }),
    ),
  }),
});

export type TutorResult = z.infer<typeof TutorOutput>;

export interface TutorInput {
  scenario: Scenario;
  level: string;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
  /** True when the message came from speech recognition. */
  spoken?: boolean;
}

export type Tutor = (input: TutorInput) => Promise<TutorResult>;

const model = () => process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

export function createClaudeTutor(client = new Anthropic()): Tutor {
  return async ({ scenario, level, history, message, spoken }) => {
    const system = [
      scenario.roleplay,
      `The user is a Spanish speaker learning English, CEFR level ${level}, preparing for tech jobs in the USA.`,
      "Keep your reply short (1-3 sentences) and use simple English matching the user's level. Stay in character and keep the conversation going.",
      spoken
        ? "The user's latest message was dictated with speech recognition: ignore capitalization and punctuation, and treat odd words as possible mispronunciations (mention a likely mispronunciation in explanation_es when it seems clear)."
        : "",
      "Also correct the user's latest message: `corrected` is the minimally fixed sentence, `natural` is how a native speaker would say it, `explanation_es` is a brief explanation in Spanish of the mistakes (empty string if there were none), and `errors` lists each mistake (empty if none). If the message is already correct, return it unchanged in `corrected` and `natural`.",
    ].filter(Boolean).join("\n");

    const response = await client.beta.messages.parse({
      model: model(),
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      output_config: { effort: "low", format: zodOutputFormat(TutorOutput) },
      messages: [...history, { role: "user", content: message }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error("The tutor could not produce a response");
    }
    return response.parsed_output;
  };
}
