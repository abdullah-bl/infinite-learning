// OpenRouter's free models, tried in order: OpenRouter moves to the next when one is rate
// limited or down. These answer straight away and write well. Free models come and go, so
// override with OPENROUTER_MODELS (comma separated, at most three) when these stop answering.
const DEFAULT_MODELS = [
  "xingchen-agi/xing4.0-29b-a4b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

/** Any free model that is up. Often a reasoning model that thinks for minutes first, so it is
 *  only asked when the preferred ones are all busy. */
export const LAST_RESORT = ["openrouter/free"];

/** A finished answer whose JSON didn't parse, usually because it was cut off. */
export class BrokenAnswer extends Error {
  constructor(
    readonly text: string,
    readonly model: string,
  ) {
    super("bad_json");
  }
}

export function preferredModels() {
  const configured = (process.env.OPENROUTER_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  // OpenRouter accepts at most three fallbacks in `models`.
  return (configured.length > 0 ? configured : DEFAULT_MODELS).slice(0, 3);
}

type ChatResult = { json: unknown; model: string };

/** What has arrived so far: the answer, how much the model has thought, and which model it is. */
export type Update = { text: string; thought: number; model: string };

// Free models can sit in a queue or think for a while before the first word, so the limit is on
// silence, not on the whole answer: give up after a minute with no bytes, or five minutes in all.
const IDLE_MS = 60_000;
const TOTAL_MS = 300_000;

/** Ask OpenRouter for a JSON object, streamed. `onUpdate` hears about the answer and the
 *  model's thinking as they arrive.
 *  When the models fail it throws an Error whose message is a short code (no_key, timeout,
 *  unreachable, models_busy, provider, empty, bad_json) that the web app words in the visitor's
 *  language. */
export async function chatJson(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  models?: string[];
  onUpdate?: (update: Update) => void;
}): Promise<ChatResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("no_key");

  const list = opts.models ?? preferredModels();
  const controller = new AbortController();
  const total = setTimeout(() => controller.abort(), TOTAL_MS);
  let idle = setTimeout(() => controller.abort(), IDLE_MS);
  const alive = () => {
    clearTimeout(idle);
    idle = setTimeout(() => controller.abort(), IDLE_MS);
  };

  try {
    let res: Response;
    try {
      res = await fetch(`${process.env.OPENROUTER_URL ?? "https://openrouter.ai/api/v1"}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL ?? "https://infinite-learning.fly.dev",
          "X-Title": "Infinite Learning",
        },
        body: JSON.stringify({
          // `models` lets OpenRouter fall back to the next one on errors and rate limits.
          models: list,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          temperature: opts.temperature ?? 0.6,
          max_tokens: opts.maxTokens ?? 4000,
          response_format: { type: "json_object" },
          // Reasoning models think less, so the answer starts sooner. The thinking still streams,
          // so the page can show that something is happening.
          reasoning: { effort: "low" },
          stream: true,
        }),
      });
    } catch {
      throw new Error(controller.signal.aborted ? "timeout" : "unreachable");
    }

    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      console.error("OpenRouter error", res.status, body?.error?.message);
      throw new Error(res.status === 429 ? "models_busy" : "provider");
    }

    // Server-sent events: `data: {json}` lines, `: comment` keep-alives, and `data: [DONE]`.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let model = list[0];
    let finish = "";
    let thought = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        alive();
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          let chunk: {
            model?: string;
            error?: { code?: number; message?: string };
            choices?: { delta?: { content?: string | null; reasoning?: string | null }; finish_reason?: string | null }[];
          };
          try {
            chunk = JSON.parse(data);
          } catch {
            continue;
          }
          if (chunk.error) {
            console.error("OpenRouter stream error", chunk.error.code, chunk.error.message);
            throw new Error(chunk.error.code === 429 ? "models_busy" : "provider");
          }
          if (chunk.model) model = chunk.model;
          if (chunk.choices?.[0]?.finish_reason) finish = chunk.choices[0].finish_reason;
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) text += delta.content;
          if (delta?.reasoning) thought += delta.reasoning.length;
          if (delta?.content || delta?.reasoning) opts.onUpdate?.({ text, thought, model });
        }
      }
    } catch (err) {
      if (controller.signal.aborted) throw new Error("timeout");
      throw err;
    }

    if (!text.trim()) {
      console.error(`empty answer from ${model} (finish: ${finish || "none"}, thought ${thought} chars)`);
      throw new Error("empty");
    }
    try {
      return { json: parseJson(text), model };
    } catch {
      console.error(`broken JSON from ${model} (finish: ${finish || "none"}, ${text.length} chars)`);
      throw new BrokenAnswer(text, model);
    }
  } finally {
    clearTimeout(total);
    clearTimeout(idle);
  }
}

/** Models sometimes wrap JSON in fences or <think> blocks; pull the object out. */
export function parseJson(raw: string): unknown {
  const text = raw.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/gi, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("bad_json");
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("bad_json");
  }
}
