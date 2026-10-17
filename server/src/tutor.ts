import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseStructured, type ChatMessage } from "./claude.js";
import { HELP_INSTRUCTIONS, HelpSchema, type Help } from "./help.js";
import type { Scenario } from "./scenarios.js";

export const ERROR_CATEGORIES = ["grammar", "tense", "preposition", "vocabulary", "word-order", "spelling", "other"] as const;

const Base = z.object({
  reply: z.string(),
  /** Spanish translation of `reply`, shown behind the translate button. */
  reply_es: z.string(),
  correction: z.object({
    corrected: z.string(),
    natural: z.string(),
    explanation_es: z.string(),
    /** 0-100 rating of the user's message (the server clamps it). */
    score: z.number(),
    errors: z.array(
      z.object({
        category: z.enum(ERROR_CATEGORIES),
        original: z.string(),
        fixed: z.string(),
      }),
    ),
  }),
});
const WithHelp = Base.extend({ help: HelpSchema });

export type TutorResult = z.infer<typeof Base> & { help?: Help };

export interface TutorInput {
  scenario: Scenario;
  level: string;
  history: ChatMessage[];
  message: string;
  /** True when the message came from speech recognition. */
  spoken?: boolean;
  /** "No safety net" runs skip generating help for the next question. */
  noHelp?: boolean;
}

export type Tutor = (input: TutorInput) => Promise<TutorResult>;

export function createClaudeTutor(client = new Anthropic()): Tutor {
  return ({ scenario, level, history, message, spoken, noHelp }) => {
    const system = [
      scenario.roleplay,
      `The user is a Spanish speaker learning English, CEFR level ${level}, preparing for tech jobs in the USA.`,
      "Keep your reply short (1-3 sentences) and use simple English matching the user's level. Stay in character and keep the conversation going. Put a faithful Spanish translation of your reply in `reply_es`.",
      spoken
        ? "The user's latest message was dictated with speech recognition: ignore capitalization and punctuation, and treat odd words as possible mispronunciations (mention a likely mispronunciation in explanation_es when it seems clear)."
        : "",
      "Also correct the user's latest message: `corrected` is the minimally fixed sentence, `natural` is how a native speaker would say it, `explanation_es` is a brief explanation in Spanish of the mistakes (empty string if there were none), and `errors` lists each mistake (empty if none). If the message is already correct, return it unchanged in `corrected` and `natural`. `score` is a calibrated 0-100 rating of that message covering grammar, vocabulary, naturalness and whether it really answers what was asked: 90-100 only for correct, natural and relevant answers; 75-89 minor issues; 60-74 understandable but with several errors or unnatural; 40-59 hard to follow or only partly relevant; below 40 mostly incorrect or off-topic. A correct one-word reply that does not really answer should stay at about 60 or lower.",
      noHelp ? "" : HELP_INSTRUCTIONS,
    ]
      .filter(Boolean)
      .join("\n");

    return parseStructured(client, {
      system,
      messages: [...history, { role: "user", content: message }],
      schema: noHelp ? Base : WithHelp,
      maxTokens: 6000,
    });
  };
}
