import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createClaudeHelper, createClaudeIdeasHelper, HELP_INSTRUCTIONS } from "./help.js";
import { findScenario } from "./scenarios.js";

const input = { scenario: findScenario("standup")!, level: "A1", question: "What did you do yesterday?", history: [] };
const ideas = { ideas: [{ en: "fixing a bug", es: "arreglar un error" }] };
const ok = (parsed: unknown) => ({ stop_reason: "end_turn", parsed_output: parsed });

/** A minimal stand-in for the SDK client that records every request. */
function fakeClient(opts: { light?: () => unknown; main?: () => unknown }) {
  const calls = { light: [] as Record<string, unknown>[], main: [] as Record<string, unknown>[] };
  const client = {
    messages: { parse: async (p: Record<string, unknown>) => (calls.light.push(p), opts.light?.() ?? ok(ideas)) },
    beta: { messages: { parse: async (p: Record<string, unknown>) => (calls.main.push(p), opts.main?.() ?? ok(ideas)) } },
  } as unknown as Anthropic;
  return { client, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ideas helper (fast model)", () => {
  it("uses Haiku with thinking off and low effort, without the refusal-fallback beta", async () => {
    const { client, calls } = fakeClient({});
    expect(await createClaudeIdeasHelper(client)(input)).toEqual(ideas);
    expect(calls.main.length).toBe(0);
    const p = calls.light[0];
    expect(p.model).toBe("claude-haiku-5-5");
    expect(p.thinking).toEqual({ type: "disabled" });
    expect((p.output_config as { effort: string }).effort).toBe("low");
    expect(p).not.toHaveProperty("betas");
    expect(p).not.toHaveProperty("fallbacks");
    expect(p.system).toContain("`ideas`");
    expect(p.system).not.toContain("`suggestions`"); // it only asks for what step 1 needs
  });

  it("lets CLAUDE_FAST_MODEL override the model", async () => {
    vi.stubEnv("CLAUDE_FAST_MODEL", "some-other-model");
    const { client, calls } = fakeClient({});
    await createClaudeIdeasHelper(client)(input);
    expect(calls.light[0].model).toBe("some-other-model");
  });

  it("falls back to the main model if the fast model fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { client, calls } = fakeClient({
      light: () => {
        throw new Error("400 invalid_request_error");
      },
    });
    expect(await createClaudeIdeasHelper(client)(input)).toEqual(ideas);
    expect(calls.main.length).toBe(1);
    expect(calls.main[0].model).toBe("claude-opus-5-5");
    expect(calls.main[0].fallbacks).toBe("default");
  });

  it("falls back when the fast model refuses", async () => {
    const { client, calls } = fakeClient({ light: () => ({ stop_reason: "refusal", parsed_output: null }) });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await createClaudeIdeasHelper(client)(input);
    expect(calls.main.length).toBe(1);
  });
});

describe("starter and answers helper (main model)", () => {
  it("keeps using the main model and asks for the starter and the answers, not the ideas", async () => {
    const rest = { starter: "I ...", starter_es: "Yo ...", suggestions: [] };
    const { client, calls } = fakeClient({ main: () => ok(rest) });
    expect(await createClaudeHelper(client)(input)).toEqual(rest);
    expect(calls.light.length).toBe(0);
    expect(calls.main[0].model).toBe("claude-opus-5-5");
    expect(calls.main[0].system).toContain("`starter`");
    expect(calls.main[0].system).not.toContain("`ideas`");
  });

  it("leaves the tutor's combined help prompt unchanged", () => {
    expect(HELP_INSTRUCTIONS).toContain("`ideas` has 3-5 short English noun phrases");
    expect(HELP_INSTRUCTIONS).toContain("`starter` is the first words");
    expect(HELP_INSTRUCTIONS).toContain("`suggestions` has exactly three English answers");
  });
});
