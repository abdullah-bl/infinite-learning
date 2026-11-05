import { v } from "onebase/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { BrokenAnswer, chatJson, LAST_RESORT, preferredModels, type Update } from "./lib/openrouter";
import { readProgress, wholeLessons } from "./lib/progress";
import { normalise } from "./lib/topic";
import { conceptsPrompt, coursePrompt, quizPrompt, systemPrompt } from "./lib/prompts";

const text = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");

/** The offered idea a model meant: the same after folding letters and punctuation, or nearly the
 *  same (one word differs at its end, as in «مغناطيات» for «مغناطيسية»). */
export function matchIdea(said: string, offered: string[]): string | undefined {
  const a = normalise(said);
  if (!a) return undefined;
  for (const o of offered) if (normalise(o) === a) return o;
  const aw = a.split(" ");
  for (const o of offered) {
    const ow = normalise(o).split(" ");
    if (ow.length !== aw.length) continue;
    let close = 0;
    for (let i = 0; i < ow.length; i++) if (ow[i] === aw[i] || (ow[i].length > 3 && aw[i].slice(0, 4) === ow[i].slice(0, 4))) close++;
    if (close === ow.length) return o;
  }
  return undefined;
}

/** A lesson's key ideas as the model named them: short, distinct, at most four. */
export function concepts(x: unknown): string[] {
  const out: string[] = [];
  for (const c of Array.isArray(x) ? x : []) {
    const clean = text(c, 60).replace(/[.:;]+$/, "");
    if (clean && clean.split(/\s+/).length <= 6 && !out.some((o) => o.toLowerCase() === clean.toLowerCase())) out.push(clean);
    if (out.length === 4) break;
  }
  return out;
}

/** Three tries. The preferred models twice, a few seconds apart, since their upstream rate limits
 *  usually clear quickly. Then any free model that is up, which may be a slow reasoning one: better
 *  late than a failed course. */
async function tries<T>(run: (models: string[], attempt: number) => Promise<T>): Promise<T> {
  const plan = [preferredModels(), preferredModels(), LAST_RESORT];
  for (let i = 0; ; i++) {
    try {
      return await run(plan[i], i + 1);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "no_key" || i === plan.length - 1) throw err;
      console.error(`model attempt ${i + 1} failed (${code}), trying again`);
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

export const generateCourse = internalAction({
  args: {
    course: v.id("courses"),
    topic: v.string(),
    language: v.string(),
    level: v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced")),
    lessons: v.number(),
    // for a rewrite: what learners said was wrong with the last version
    avoid: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { course, topic, language, level, lessons, avoid, note }) => {
    // At most one progress write in flight, and at most one a second.
    let sent = 0;
    let inFlight: Promise<unknown> | null = null;
    const report = (update: Update, attempt: number, force = false) => {
      if (inFlight || (!force && Date.now() - sent < 1000)) return;
      sent = Date.now();
      inFlight = ctx
        .runMutation(internal.courses.progress, {
          course,
          ...readProgress(update.text),
          model: update.model,
          thought: update.thought,
          attempt,
        })
        .catch((err) => console.error("progress write failed:", err))
        .finally(() => (inFlight = null));
    };
    try {
      // what this learner already knows, so a new course can build on it
      const learner = await ctx.runQuery(internal.graph.forPrompt, { course });
      const { data, model } = await tries(async (models, attempt) => {
        // a new try starts from nothing, and the page says so
        await inFlight;
        if (attempt > 1) report({ text: "", thought: 0, model: models[0] }, attempt, true);
        let answer: { json: unknown; model: string };
        try {
          answer = await chatJson({
            system: systemPrompt(language),
            user: coursePrompt(topic, level, lessons, { avoid, note, ...learner }),
            maxTokens: 16000,
            models,
            onUpdate: (update) => report(update, attempt),
          });
        } catch (err) {
          // cut off part-way: keep the lessons that arrived whole, if there are any
          if (!(err instanceof BrokenAnswer)) throw err;
          const kept = wholeLessons(err.text);
          if (kept.lessons.length === 0) throw err;
          answer = { json: { title: kept.title, description: "", lessons: kept.lessons, nextTopics: [] }, model: err.model };
        }
        const got = answer.json as { lessons?: unknown };
        // an answer with no usable lessons is as good as no answer
        if (!Array.isArray(got.lessons) || got.lessons.length === 0) throw new Error("no_lessons");
        return { data: answer.json, model: answer.model };
      });
      await inFlight; // so a late progress write can't land after the course is finished
      const parsed = data as { title?: unknown; description?: unknown; lessons?: unknown; nextTopics?: unknown };

      const out: { title: string; content: string; concepts: string[] }[] = [];
      for (const item of Array.isArray(parsed.lessons) ? parsed.lessons : []) {
        const title = text((item as { title?: unknown })?.title, 120);
        const content = text((item as { content?: unknown })?.content, 8000);
        if (title && content.length > 80) out.push({ title, content, concepts: concepts((item as { concepts?: unknown }).concepts) });
      }
      if (out.length === 0) throw new Error("no_lessons");

      const nextTopics: string[] = [];
      for (const t of Array.isArray(parsed.nextTopics) ? parsed.nextTopics : []) {
        const clean = text(t, 60);
        if (clean && nextTopics.length < 4) nextTopics.push(clean);
      }

      // Only ideas we offered count, written the way the learner's map writes them. Models copy
      // them back with small slips, so match loosely.
      const offered = [...learner.known, ...learner.shaky];
      const claimed = (parsed as { buildsOn?: unknown }).buildsOn;
      const builtOn: string[] = [];
      for (const b of Array.isArray(claimed) ? claimed : []) {
        const label = typeof b === "string" ? matchIdea(b, offered) : undefined;
        if (label && !builtOn.includes(label)) builtOn.push(label);
      }
      // Offered ideas and no answer about them (often a cut-off answer): it may lean on them, so
      // keep it to this learner rather than risk sharing a course that assumes what others lack.
      const personal = builtOn.length > 0 || (offered.length > 0 && !Array.isArray(claimed));

      await ctx.runMutation(internal.courses.finish, {
        course,
        builtOn,
        personal,
        title: text(parsed.title, 100) || topic,
        description: text(parsed.description, 300),
        nextTopics,
        model,
        lessons: out.slice(0, lessons),
      });
    } catch (err) {
      await inFlight;
      console.error("course generation failed:", err);
      await ctx.runMutation(internal.courses.fail, { course, error: err instanceof Error && /^[a-z_]+$/.test(err.message) ? err.message : "unknown" });
    }
  },
});

export const generateQuiz = internalAction({
  args: { lesson: v.id("lessons") },
  handler: async (ctx, { lesson }) => {
    try {
      const target = await ctx.runQuery(internal.lessons.forQuiz, { lesson });
      if (!target) return;
      const { json } = await tries((models) =>
        chatJson({
          system: systemPrompt(target.language),
          user: quizPrompt(target.courseTitle, target.title, target.content),
          temperature: 0.4,
          maxTokens: 6000,
          models,
        }),
      );

      const questions: { question: string; options: string[]; correct: number }[] = [];
      for (const item of Array.isArray((json as { questions?: unknown }).questions) ? (json as { questions: unknown[] }).questions : []) {
        const q = item as { question?: unknown; options?: unknown; correct?: unknown };
        const options: string[] = [];
        for (const o of Array.isArray(q.options) ? q.options : []) {
          const clean = text(o, 200);
          if (clean && options.length < 4) options.push(clean);
        }
        const correct = typeof q.correct === "number" ? Math.trunc(q.correct) : -1;
        const question = text(q.question, 300);
        if (question && options.length >= 2 && correct >= 0 && correct < options.length) questions.push({ question, options, correct });
      }
      if (questions.length === 0) throw new Error("no_questions");
      await ctx.runMutation(internal.lessons.saveQuiz, { lesson, questions: questions.slice(0, 3) });
    } catch (err) {
      console.error("quiz generation failed:", err);
      await ctx.runMutation(internal.lessons.failQuiz, { lesson });
    }
  },
});

/** Names the key ideas of a course written before lessons carried them. */
export const generateConcepts = internalAction({
  args: { course: v.id("courses") },
  handler: async (ctx, { course }) => {
    try {
      const target = await ctx.runQuery(internal.graph.forConcepts, { course });
      if (!target || target.lessons.length === 0) return;
      const { json } = await tries((models) =>
        chatJson({
          system: systemPrompt(target.language),
          user: conceptsPrompt(target.title, target.lessons),
          temperature: 0.2,
          maxTokens: 4000,
          models,
        }),
      );
      const items = Array.isArray((json as { lessons?: unknown }).lessons) ? (json as { lessons: { concepts?: unknown }[] }).lessons : [];
      await ctx.runMutation(internal.graph.saveConcepts, {
        course,
        concepts: target.lessons.map((_, i) => concepts(items[i]?.concepts)),
      });
    } catch (err) {
      console.error("concept extraction failed:", err);
    }
  },
});
