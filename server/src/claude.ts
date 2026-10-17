import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

export const model = () => process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** One structured-output call with server-side refusal fallbacks enabled. */
export async function parseStructured<S extends z.ZodType>(
  client: Anthropic,
  opts: { system: string; messages: ChatMessage[]; schema: S; effort?: "low" | "medium"; maxTokens?: number },
): Promise<z.infer<S>> {
  const response = await client.beta.messages.parse({
    model: model(),
    max_tokens: opts.maxTokens ?? 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    output_config: { effort: opts.effort ?? "low", format: zodOutputFormat(opts.schema) },
    messages: opts.messages,
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Claude could not produce a response");
  }
  return response.parsed_output as z.infer<S>;
}
