import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseStructured, type ChatMessage } from "./claude.js";
import type { Scenario } from "./scenarios.js";

export const HelpSchema = z.object({
  /** Ideas of what to mention, in Spanish (hint 1). */
  keywords_es: z.array(z.string()),
  /** The beginning of an English answer the user can complete (hint 2). */
  starter: z.string(),
  /** Three full answers at increasing difficulty (hint 3). */
  suggestions: z.array(
    z.object({
      level: z.enum(["simple", "medium", "natural"]),
      text: z.string(),
      translation_es: z.string(),
    }),
  ),
});

export type Help = z.infer<typeof HelpSchema>;

/** Prompt fragment shared by the tutor (help for the next question) and the standalone helper. */
export const HELP_INSTRUCTIONS =
  "For `help`, assume the user must now answer your latest message: `keywords_es` has 3-5 short ideas in Spanish of what they could mention; `starter` is the first words of an English answer ending in '...' for them to complete; `suggestions` has exactly three English answers in this order - `simple` (1-2 short sentences at the user's CEFR level), `medium` (a bit richer, one level up) and `natural` (how a confident B2 speaker would say it) - each with a Spanish `translation_es`. Make them believable for a software developer and put personal facts the user must fill in inside [brackets], for example [your role] or [number] years.";

export interface HelpInput {
  scenario: Scenario;
  level: string;
  /** The interviewer's message the user has to answer. */
  question: string;
  history: ChatMessage[];
}

export type Helper = (input: HelpInput) => Promise<Help>;

export function createClaudeHelper(client = new Anthropic()): Helper {
  return ({ scenario, level, question, history }) =>
    parseStructured(client, {
      system: [
        scenario.roleplay,
        `The user is a Spanish speaker learning English, CEFR level ${level}, practicing for tech jobs in the USA.`,
        "Do not continue the roleplay. Only produce help for the user's next answer.",
        HELP_INSTRUCTIONS,
      ].join("\n"),
      messages: [
        ...history,
        { role: "assistant", content: question },
        { role: "user", content: "(The user asks for help answering your last message.)" },
      ],
      schema: HelpSchema,
    });
}
