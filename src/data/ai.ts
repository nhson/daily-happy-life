import "server-only";
import { appUrl } from "./push-services";
import type { Reviewer } from "./weekly-review";

/**
 * The Weekly Review's AI: a free model on OpenRouter (owner's choice, 2026-11-05). OpenRouter tries
 * the models in order; `OPENROUTER_MODEL` puts another one first. Null until OPENROUTER_API_KEY is set.
 */
export const FREE_MODELS = ["google/gemma-4-31b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "openrouter/free"];

export function openRouterReviewer(): Reviewer | null {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  const first = process.env.OPENROUTER_MODEL;
  const models = (first ? [first, ...FREE_MODELS.filter((m) => m !== first)] : FREE_MODELS).slice(0, 3);
  return {
    async review({ system, user }) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": appUrl() ?? "https://daily-happy-life.vercel.app",
          "X-Title": "daily-happy-life",
        },
        // One user message: some free models (Gemma) take no system role.
        body: JSON.stringify({
          models,
          messages: [{ role: "user", content: `${system}\n\nThe week (JSON):\n${user}` }],
          temperature: 0.6,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
      const body = (await res.json()) as { model?: string; choices?: { message?: { content?: string } }[] };
      return { text: body.choices?.[0]?.message?.content ?? "", model: body.model ?? models[0] };
    },
  };
}
