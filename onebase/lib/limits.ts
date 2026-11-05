import { ConvexError } from "onebase/values";

type Limiter = {
  limit(args: { name: string; key?: string }): Promise<{ ok: boolean; retryAfter?: number }>;
};

/** Takes one token from a per-visitor limit and one from the shared limit. The errors are codes,
 *  and the web app words them in the visitor's language. */
export async function spend(limiter: Limiter, name: "course" | "quiz", owner: string) {
  const own = await limiter.limit({ name, key: owner });
  if (!own.ok) throw new ConvexError({ code: "rate", kind: name, minutes: Math.max(1, Math.ceil((own.retryAfter ?? 0) / 60_000)) });
  const all = await limiter.limit({ name: name === "course" ? "courseAll" : "quizAll" });
  if (!all.ok) throw new ConvexError({ code: "quota", kind: name });
}
