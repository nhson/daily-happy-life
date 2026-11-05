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
  const call = async (model: string, content: string) => {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": appUrl() ?? "https://daily-happy-life.vercel.app",
        "X-Title": "daily-happy-life",
      },
      // One user message: some free models (Gemma) take no system role. Reasoning models get room
      // to answer and are asked to keep their thinking short and out of the reply.
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        temperature: 0.6,
        max_tokens: 2000,
        reasoning: { effort: "low", exclude: true },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    // OpenRouter's error body says why (rate limit, data policy, model gone); it never contains the key.
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { model?: string; choices?: { message?: { content?: string | null } }[] };
    return { text: body.choices?.[0]?.message?.content ?? "", model: body.model ?? model };
  };
  return {
    // Each model in turn until one answers with something that looks like JSON.
    async review({ system, user }) {
      const content = `${system}\n\nThe week (JSON):\n${user}`;
      const why: string[] = [];
      for (const model of models) {
        try {
          const answer = await call(model, content);
          if (answer.text.includes("{")) return answer;
          why.push(`${model}: no JSON (${answer.text.length} chars)`);
        } catch (e) {
          why.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      throw new Error(why.join(" | "));
    },
  };
}
