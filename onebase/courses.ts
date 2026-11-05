import { ConvexError, v } from "onebase/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { copyToOwner, liveEntry } from "./library";
import { spend } from "./lib/limits";
import { assertOwner, cleanTopic } from "./lib/owner";
import { courseKey, normalise } from "./lib/topic";

const level = v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"));

/** A visitor's courses, newest first, with how far along each one is. */
export const list = query({
  args: { owner: v.string() },
  handler: async (ctx, { owner }) => {
    assertOwner(owner);
    const courses = await ctx.db.query("courses").withIndex("by_owner", (q) => q.eq("owner", owner)).order("desc").take(100);
    const out = [];
    for (const course of courses) {
      const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", course._id)).collect();
      let done = 0;
      for (const lesson of lessons) if (lesson.completed) done++;
      out.push({ ...course, lessonCount: lessons.length, completedCount: done });
    }
    return out;
  },
});

/** One course with its lessons, or null when it isn't this visitor's. */
export const get = query({
  args: { owner: v.string(), id: v.string() },
  handler: async (ctx, { owner, id }) => {
    assertOwner(owner);
    const courseId = ctx.db.normalizeId("courses", id);
    if (!courseId) return null;
    const course = await ctx.db.get(courseId);
    if (!course || course.owner !== owner) return null;
    const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", courseId)).order("asc").collect();
    return { course, lessons };
  },
});

export const create = mutation({
  args: { owner: v.string(), topic: v.string(), language: v.string(), level, lessons: v.number() },
  handler: async (ctx, args) => {
    assertOwner(args.owner);
    const topic = cleanTopic(args.topic);
    const language = args.language.trim().slice(0, 40) || "auto";
    const lessons = Math.min(6, Math.max(3, Math.round(args.lessons)));

    // Already written by someone, for the same language, level and length? Then there is nothing
    // to wait for and no model to ask.
    const shared = await liveEntry(ctx, courseKey(topic, language, args.level, lessons));
    if (shared) return await copyToOwner(ctx, args.owner, shared);

    const recent = await ctx.db.query("courses").withIndex("by_owner", (q) => q.eq("owner", args.owner)).order("desc").take(5);
    let busy = 0;
    for (const c of recent) if (c.status === "generating") busy++;
    if (busy >= 2) throw new ConvexError({ code: "busy" });

    await spend(ctx.components.limiter, "course", args.owner);

    const id = await ctx.db.insert("courses", {
      owner: args.owner,
      topic,
      language,
      level: args.level,
      status: "generating",
      title: topic,
      description: "",
      nextTopics: [],
      planned: lessons,
    });
    await ctx.scheduler.runAfter(0, internal.ai.generateCourse, { course: id, topic, language, level: args.level, lessons });
    return id;
  },
});

export const remove = mutation({
  args: { owner: v.string(), id: v.id("courses") },
  handler: async (ctx, { owner, id }) => {
    assertOwner(owner);
    const course = await ctx.db.get(id);
    if (!course || course.owner !== owner) return;
    const lessons = await ctx.db.query("lessons").withIndex("by_course", (q) => q.eq("course", id)).collect();
    for (const lesson of lessons) await ctx.db.delete(lesson._id);
    for (const card of await ctx.db.query("reviews").withIndex("by_course", (q) => q.eq("course", id)).collect()) await ctx.db.delete(card._id);
    await ctx.db.delete(id);
  },
});

/** Called by the generator once the model has answered. */
export const finish = internalMutation({
  args: {
    course: v.id("courses"),
    title: v.string(),
    description: v.string(),
    nextTopics: v.array(v.string()),
    model: v.string(),
    builtOn: v.optional(v.array(v.string())),
    personal: v.optional(v.boolean()),
    lessons: v.array(v.object({ title: v.string(), content: v.string(), concepts: v.optional(v.array(v.string())) })),
  },
  handler: async (ctx, { course, lessons, builtOn = [], personal: leans = false, ...fields }) => {
    const doc = await ctx.db.get(course);
    if (!doc) return; // deleted while it was being written

    // Into the shared library, unless the same course got there first. A rewrite takes the place
    // of the version it was written to improve on.
    let library: Id<"library"> | undefined;
    const key = courseKey(doc.topic, doc.language, doc.level, doc.planned ?? lessons.length);
    // A course written around one learner's map would make little sense to anyone else.
    const personal = leans || builtOn.length > 0;
    const current = personal ? null : await liveEntry(ctx, key);
    if (current && doc.rewriteOf) await ctx.db.patch(current._id, { retired: true });
    if (!personal && (!current || doc.rewriteOf)) {
      library = await ctx.db.insert("library", {
        key,
        topic: doc.topic,
        title: fields.title,
        description: fields.description,
        language: doc.language,
        level: doc.level,
        model: fields.model,
        lessons,
        nextTopics: fields.nextTopics,
        uses: 1,
        search: normalise(`${doc.topic} ${fields.title}`),
      });
      await ctx.scheduler.runAfter(0, internal.library.index, { id: library });
    }

    for (let i = 0; i < lessons.length; i++) {
      await ctx.db.insert("lessons", {
        course,
        owner: doc.owner,
        position: i,
        title: lessons[i].title,
        content: lessons[i].content,
        concepts: lessons[i].concepts,
        completed: false,
        quizStatus: "none",
      });
    }
    // a model that left out the key ideas leaves them for the map to ask for later
    const named = lessons.every((l) => l.concepts?.length);
    await ctx.db.patch(course, {
      ...fields,
      status: "ready",
      error: undefined,
      progress: undefined,
      library,
      builtOn: builtOn.length ? builtOn : undefined,
      ...(named ? { conceptsAsked: true } : {}),
    });
  },
});

/** The generator's running copy of the course, so the page can show it being written. */
export const progress = internalMutation({
  args: {
    course: v.id("courses"),
    title: v.string(),
    lessons: v.array(v.object({ title: v.string(), content: v.string() })),
    model: v.optional(v.string()),
    thought: v.optional(v.number()),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, { course, ...progress }) => {
    const doc = await ctx.db.get(course);
    if (doc?.status === "generating") await ctx.db.patch(course, { progress });
  },
});

export const fail = internalMutation({
  args: { course: v.id("courses"), error: v.string() },
  handler: async (ctx, { course, error }) => {
    if (await ctx.db.get(course)) await ctx.db.patch(course, { status: "error", error, progress: undefined });
  },
});

/** A restart can cut a generation short; stop showing those as "writing". */
export const reapStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stuck = await ctx.db.query("courses").withIndex("by_status", (q) => q.eq("status", "generating")).collect();
    for (const course of stuck) {
      if (Date.now() - course._creationTime > 8 * 60_000) {
        await ctx.db.patch(course._id, { status: "error", error: "stuck", progress: undefined });
      }
    }
  },
});

/** Writes a course again for a learner who found it poor, telling the model what was wrong. */
export const rewrite = mutation({
  args: { owner: v.string(), id: v.id("courses") },
  handler: async (ctx, { owner, id }) => {
    assertOwner(owner);
    const old = await ctx.db.get(id);
    if (!old || old.owner !== owner || old.status !== "ready") throw new ConvexError({ code: "not_found" });
    const fb = await ctx.db.query("feedback").withIndex("by_course_owner", (q) => q.eq("course", id).eq("owner", owner)).first();

    await spend(ctx.components.limiter, "course", owner);
    const lessons = old.planned ?? 3;
    const course = await ctx.db.insert("courses", {
      owner,
      topic: old.topic,
      language: old.language,
      level: old.level,
      status: "generating",
      title: old.topic,
      description: "",
      nextTopics: [],
      planned: lessons,
      rewriteOf: id,
    });
    await ctx.scheduler.runAfter(0, internal.ai.generateCourse, {
      course,
      topic: old.topic,
      language: old.language,
      level: old.level,
      lessons,
      avoid: fb?.rating === "down" ? fb.reasons : [],
      note: fb?.rating === "down" ? fb.note : undefined,
    });
    return course;
  },
});
