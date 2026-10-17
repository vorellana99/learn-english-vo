import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseLight, parseStructured, type ChatMessage } from "./claude.js";
import type { Scenario } from "./scenarios.js";

const Idea = z.object({ en: z.string(), es: z.string() });
const Suggestion = z.object({
  level: z.enum(["simple", "medium", "natural"]),
  text: z.string(),
  translation_es: z.string(),
});

/** Step 1: short English ideas with their Spanish meaning. Small enough for the fast model. */
export const IdeasSchema = z.object({ ideas: z.array(Idea) });
/** Steps 2 and 3: a sentence starter and three full answers, each with a translation. */
export const RestSchema = z.object({
  starter: z.string(),
  starter_es: z.string(),
  suggestions: z.array(Suggestion),
});
/** All three steps at once (what the tutor returns together with its reply). */
export const HelpSchema = IdeasSchema.merge(RestSchema);

export type Help = z.infer<typeof HelpSchema>;
export type HelpIdeas = z.infer<typeof IdeasSchema>;
export type HelpRest = z.infer<typeof RestSchema>;

const HELP_INTRO = "For `help`, assume the user must now answer your latest message: ";
const IDEAS_PART =
  "`ideas` has 3-5 short English noun phrases or key phrases of what they could mention (2-5 words each, at the user's level), each with its Spanish meaning in `es`; ";
const REST_PART =
  "`starter` is the first words of an English answer ending in '...' for them to complete, and `starter_es` its Spanish translation; `suggestions` has exactly three English answers in this order - `simple` (1-2 short sentences at the user's CEFR level), `medium` (a bit richer, one level up) and `natural` (how a confident B2 speaker would say it) - each with a Spanish `translation_es`. Write complete, concrete sentences that are ready to say out loud: pick the most likely, believable details for a software developer (for example a job title, a number of years, real technologies or a typical project) and never use placeholders, brackets or blanks. The user can edit the details afterwards.";

/** Prompt fragment used by the tutor, which returns all of the help together with its reply. */
export const HELP_INSTRUCTIONS = HELP_INTRO + IDEAS_PART + REST_PART;

export interface HelpInput {
  scenario: Scenario;
  level: string;
  /** The interviewer's message the user has to answer. */
  question: string;
  history: ChatMessage[];
}

/** Writes the starter and the three answers (steps 2 and 3) with the main model. */
export type Helper = (input: HelpInput) => Promise<HelpRest>;
/** Writes the ideas (step 1) with the fast model. */
export type IdeasHelper = (input: HelpInput) => Promise<HelpIdeas>;

const helperSystem = (input: HelpInput, instructions: string) =>
  [
    input.scenario.roleplay,
    `The user is a Spanish speaker learning English, CEFR level ${input.level}, practicing for tech jobs in the USA.`,
    "Do not continue the roleplay. Only produce help for the user's next answer.",
    instructions,
  ].join("\n");

const helperMessages = ({ history, question }: HelpInput): ChatMessage[] => [
  ...history,
  { role: "assistant", content: question },
  { role: "user", content: "(The user asks for help answering your last message.)" },
];

export function createClaudeHelper(client = new Anthropic()): Helper {
  return (input) =>
    parseStructured(client, {
      system: helperSystem(input, HELP_INTRO + REST_PART),
      messages: helperMessages(input),
      schema: RestSchema,
    });
}

export function createClaudeIdeasHelper(client = new Anthropic()): IdeasHelper {
  return async (input) => {
    const request = { system: helperSystem(input, (HELP_INTRO + IDEAS_PART).trim()), messages: helperMessages(input), schema: IdeasSchema };
    try {
      return await parseLight(client, request);
    } catch (err) {
      // The fast model is an optimization: if it is unavailable or rejects the request, use the main model.
      console.warn("Fast model failed for ideas, retrying with the main model:", err instanceof Error ? err.message : err);
      return parseStructured(client, request);
    }
  };
}
