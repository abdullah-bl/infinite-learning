// Embeddings for finding courses by meaning. A free multilingual model: "reinforcement
// learning" and «التعلم التعزيزي» land near each other. The vector index in schema.ts is sized
// for it (2048), so a different OPENROUTER_EMBED_MODEL must have the same size.
export const EMBED_MODEL = () => process.env.OPENROUTER_EMBED_MODEL ?? "nvidia/nemotron-3-embed-1b:free";

export async function embed(text: string): Promise<number[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("no_key");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${process.env.OPENROUTER_URL ?? "https://openrouter.ai/api/v1"}/embeddings`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL(), input: [text.slice(0, 2000)] }),
    });
    const body = (await res.json().catch(() => null)) as { data?: { embedding: number[] }[] } | null;
    const vector = body?.data?.[0]?.embedding;
    if (!res.ok || !vector) throw new Error(`embedding failed (${res.status})`);
    return vector;
  } finally {
    clearTimeout(timer);
  }
}
