import { v } from "onebase/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOwner } from "./lib/owner";
import { normalise } from "./lib/topic";

// A learner's knowledge map: the key ideas of every lesson they have, how well they know each
// one, and the topics their courses point to next. Built from their own courses only; nothing
// here is shared.

export type State = "known" | "shaky" | "new";

/** Known: finished, or its questions mostly right. Shaky: mostly wrong. New: not read yet.
 *  `latest` is each question's latest answer when it has been reviewed since the quiz. */
export function lessonState(lesson: Pick<Doc<"lessons">, "completed" | "questions">, latest?: Map<number, boolean>): State {
  let answered = 0;
  let right = 0;
  (lesson.questions ?? []).forEach((q, i) => {
    const reviewed = latest?.get(i);
    if (reviewed === undefined && q.userAnswer === undefined) return;
    answered++;
    if (reviewed ?? q.userAnswer === q.correct) right++;
  });
  if (answered > 0) return right / answered >= 2 / 3 ? "known" : "shaky";
  return lesson.completed ? "known" : "new";
}

/** Each lesson's questions' latest answers, review included, for one learner. */
async function latestAnswers(ctx: QueryCtx, owner: string) {
  const out = new globalThis.Map<Id<"lessons">, Map<number, boolean>>();
  for (const card of await ctx.db.query("reviews").withIndex("by_owner_due", (q) => q.eq("owner", owner)).collect()) {
    let byQuestion = out.get(card.lesson);
    if (!byQuestion) out.set(card.lesson, (byQuestion = new globalThis.Map()));
    byQuestion.set(card.question, card.last);
  }
  return out;
}

/** An idea taught in several lessons: a quiz that went badly anywhere means it's worth a review;
 *  otherwise, learned anywhere means known. An unread second course doesn't unlearn it. */
const combine = (a: State, b: State): State => (a === "shaky" || b === "shaky" ? "shaky" : a === "known" || b === "known" ? "known" : "new");

type Place = { course: Id<"courses">; courseTitle: string; lesson: number; lessonTitle: string; state: State };
export type Concept = { key: string; label: string; state: State; where: Place[]; fading: boolean };
export type Next = { key: string; label: string; from: Id<"courses">[] };
export type KnowledgeMap = {
  courses: { id: Id<"courses">; title: string; done: number; total: number; library: Id<"library"> | null }[];
  concepts: Concept[];
  next: Next[];
  waiting: number; // courses whose key ideas are still being read
  writing: { id: Id<"courses">; topic: string }[]; // courses the model is writing right now
};

export const mine = query({
  // `now` marks the ideas whose review is due as fading; the page passes the time it opened
  args: { owner: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, { owner, now }): Promise<KnowledgeMap> => {
    assertOwner(owner);
    const courses = await ctx.db.query("courses").withIndex("by_owner", (q) => q.eq("owner", owner)).order("desc").take(100);
    const out: KnowledgeMap = { courses: [], concepts: [], next: [], waiting: 0, writing: [] };
    const latest = await latestAnswers(ctx, owner);
    const due = new Set<Id<"lessons">>();
    if (now !== undefined) {
      const cards = await ctx.db.query("reviews").withIndex("by_owner_due", (q) => q.eq("owner", owner).lte("due", now)).take(500);
      for (const card of cards) due.add(card.lesson);
    }
    const concepts = new globalThis.Map<string, Concept>();
    const own = new Set<string>();

    for (const course of courses) {
      if (course.status === "generating") out.writing.push({ id: course._id, topic: course.topic });
      if (course.status !== "ready") continue;
      own.add(normalise(course.topic));
      own.add(normalise(course.title));
      const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", course._id)).order("asc").collect();
      let done = 0;
      let missing = false;
      for (const lesson of lessons) {
        const state = lessonState(lesson, latest.get(lesson._id));
        if (state === "known") done++;
        if (!lesson.concepts?.length) missing = true;
        for (const label of lesson.concepts ?? []) {
          const key = normalise(label);
          if (!key) continue;
          const place = { course: course._id, courseTitle: course.title, lesson: lesson.position, lessonTitle: lesson.title, state };
          const fading = state !== "new" && due.has(lesson._id);
          const seen = concepts.get(key);
          if (seen) {
            seen.where.push(place);
            seen.state = combine(seen.state, state);
            seen.fading ||= fading;
          } else concepts.set(key, { key, label, state, where: [place], fading });
        }
      }
      if (missing) out.waiting++;
      out.courses.push({ id: course._id, title: course.title, done, total: lessons.length, library: course.library ?? null });
    }

    // topics the courses point to that the learner hasn't taken yet
    const next = new globalThis.Map<string, Next>();
    for (const course of courses) {
      if (course.status !== "ready") continue;
      for (const label of course.nextTopics) {
        const key = normalise(label);
        if (!key || own.has(key)) continue;
        const seen = next.get(key);
        if (seen) seen.from.push(course._id);
        else next.set(key, { key, label, from: [course._id] });
      }
    }

    out.concepts = [...concepts.values()];
    out.next = [...next.values()];
    return out;
  },
});

export type Constellation = {
  id: Id<"library">;
  title: string;
  topic: string;
  description: string;
  level: Doc<"library">["level"];
  uses: number;
  lessons: { title: string; concepts: string[] }[];
  next: string[];
};

/** Every shared course in a language with its key ideas: the sky everyone's maps sit in. The
 *  current version of each course only, most used first. Nothing here belongs to a learner. */
export const atlas = query({
  args: { language: v.string() },
  handler: async (ctx, { language }): Promise<Constellation[]> => {
    const seen = new Set<string>();
    const out: Constellation[] = [];
    // newest first, so the first entry met for a key is its live version
    for (const e of await ctx.db.query("library").order("desc").take(1500)) {
      if (e.language !== language || e.retired || seen.has(e.key)) continue;
      seen.add(e.key);
      out.push({
        id: e._id,
        title: e.title,
        topic: e.topic,
        description: e.description,
        level: e.level,
        uses: e.uses,
        lessons: e.lessons.map((l) => ({ title: l.title, concepts: l.concepts ?? [] })),
        next: e.nextTopics,
      });
    }
    out.sort((a, b) => b.uses - a.uses);
    return out.slice(0, 150);
  },
});

/** Asks for the key ideas of a few older courses that don't have them yet. Called by the map. */
export const fill = mutation({
  args: { owner: v.string() },
  handler: async (ctx, { owner }) => {
    assertOwner(owner);
    const courses = await ctx.db.query("courses").withIndex("by_owner", (q) => q.eq("owner", owner)).order("desc").take(100);
    let asked = 0;
    for (const course of courses) {
      if (asked === 3) break;
      if (course.status !== "ready" || course.conceptsAsked) continue;
      const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", course._id)).collect();
      if (lessons.every((l) => l.concepts?.length)) {
        await ctx.db.patch(course._id, { conceptsAsked: true });
        continue;
      }
      const { ok } = await ctx.components.limiter.limit({ name: "concepts", key: owner });
      if (!ok) break;
      await ctx.db.patch(course._id, { conceptsAsked: true });
      await ctx.scheduler.runAfter(0, internal.ai.generateConcepts, { course: course._id });
      asked++;
    }
  },
});

export const forConcepts = internalQuery({
  args: { course: v.id("courses") },
  handler: async (ctx, { course }) => {
    const doc = await ctx.db.get(course);
    if (!doc) return null;
    const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", course)).order("asc").collect();
    return { title: doc.title, language: doc.language, lessons: lessons.map((l) => ({ title: l.title, content: l.content })) };
  },
});

export const saveConcepts = internalMutation({
  args: { course: v.id("courses"), concepts: v.array(v.array(v.string())) },
  handler: async (ctx, { course, concepts }) => {
    const doc = await ctx.db.get(course);
    if (!doc) return;
    const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", course)).order("asc").collect();
    for (const lesson of lessons) {
      const found = concepts[lesson.position];
      if (found?.length && !lesson.concepts?.length) await ctx.db.patch(lesson._id, { concepts: found });
    }
    // the shared copy keeps them too, so the next learner's map has them from the start
    const entry = doc.library ? await ctx.db.get(doc.library) : null;
    if (entry && entry.lessons.some((l) => !l.concepts?.length)) {
      await ctx.db.patch(entry._id, { lessons: entry.lessons.map((l, i) => (l.concepts?.length ? l : { ...l, concepts: concepts[i] ?? [] })) });
    }
  },
});

/** What the learner already knows and found hard, most recent first, for writing a new course
 *  on top of it. A rewrite leaves out the course it replaces: that one isn't "already known". */
export const forPrompt = internalQuery({
  args: { course: v.id("courses") },
  handler: async (ctx, { course }): Promise<{ known: string[]; shaky: string[] }> => {
    const doc = await ctx.db.get(course);
    if (!doc) return { known: [], shaky: [] };
    const courses = await ctx.db.query("courses").withIndex("by_owner", (q) => q.eq("owner", doc.owner)).order("desc").take(100);
    const states = new globalThis.Map<string, { label: string; state: State }>();
    const latest = await latestAnswers(ctx, doc.owner);
    for (const c of courses) {
      if (c.status !== "ready" || c._id === course || c._id === doc.rewriteOf) continue;
      const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", c._id)).collect();
      for (const lesson of lessons) {
        const state = lessonState(lesson, latest.get(lesson._id));
        for (const label of lesson.concepts ?? []) {
          const key = normalise(label);
          const seen = states.get(key);
          if (seen) seen.state = combine(seen.state, state);
          else if (key) states.set(key, { label, state });
        }
      }
    }
    const known: string[] = [];
    const shaky: string[] = [];
    for (const { label, state } of states.values()) {
      if (state === "known" && known.length < 30) known.push(label);
      if (state === "shaky" && shaky.length < 12) shaky.push(label);
    }
    return { known, shaky };
  },
});
