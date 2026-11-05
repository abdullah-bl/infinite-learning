import { ConvexError, v } from "onebase/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { spend } from "./lib/limits";
import { nextBox, WAITS } from "./lib/review";
import { assertOwner } from "./lib/owner";

const question = v.object({
  question: v.string(),
  options: v.array(v.string()),
  correct: v.number(),
});

export const setCompleted = mutation({
  args: { owner: v.string(), lesson: v.id("lessons"), completed: v.boolean() },
  handler: async (ctx, { owner, lesson, completed }) => {
    assertOwner(owner);
    const doc = await ctx.db.get(lesson);
    if (!doc || doc.owner !== owner) throw new ConvexError({ code: "not_found" });
    await ctx.db.patch(lesson, { completed });
  },
});

/** Records one answer. A question can only be answered once, so a score means something. */
export const answer = mutation({
  args: { owner: v.string(), lesson: v.id("lessons"), question: v.number(), choice: v.number() },
  handler: async (ctx, { owner, lesson, question: index, choice }) => {
    assertOwner(owner);
    const doc = await ctx.db.get(lesson);
    if (!doc || doc.owner !== owner || !doc.questions) throw new ConvexError({ code: "not_found" });
    const target = doc.questions[index];
    if (!target || choice < 0 || choice >= target.options.length) throw new ConvexError({ code: "bad_answer" });
    if (target.userAnswer !== undefined) return;
    const questions = doc.questions.map((q, i) => (i === index ? { ...q, userAnswer: choice } : q));
    let answered = 0;
    for (const q of questions) if (q.userAnswer !== undefined) answered++;
    // Finishing the quiz finishes the lesson.
    await ctx.db.patch(lesson, { questions, ...(answered === questions.length ? { completed: true } : {}) });

    // The question comes back for review: tomorrow if wrong, in a few days if right.
    const right = choice === target.correct;
    const card = await ctx.db.query("reviews").withIndex("by_lesson_question", (q) => q.eq("lesson", lesson).eq("question", index)).first();
    const box = nextBox(card?.box, right);
    const due = Date.now() + WAITS[box];
    if (card) await ctx.db.patch(card._id, { box, due, last: right, seen: card.seen + 1 });
    else await ctx.db.insert("reviews", { owner, course: doc.course, lesson, question: index, box, due, last: right, seen: 1 });
  },
});

/** Clears the answers so the learner can try the same quiz again. */
export const retakeQuiz = mutation({
  args: { owner: v.string(), lesson: v.id("lessons") },
  handler: async (ctx, { owner, lesson }) => {
    assertOwner(owner);
    const doc = await ctx.db.get(lesson);
    if (!doc || doc.owner !== owner || !doc.questions) return;
    await ctx.db.patch(lesson, { questions: doc.questions.map((q) => ({ ...q, userAnswer: undefined })) });
  },
});

export const requestQuiz = mutation({
  args: { owner: v.string(), lesson: v.id("lessons") },
  handler: async (ctx, { owner, lesson }) => {
    assertOwner(owner);
    const doc = await ctx.db.get(lesson);
    if (!doc || doc.owner !== owner) throw new ConvexError({ code: "not_found" });
    if (doc.quizStatus === "generating" || doc.quizStatus === "ready") return;
    await spend(ctx.components.limiter, "quiz", owner);
    await ctx.db.patch(lesson, { quizStatus: "generating" });
    await ctx.scheduler.runAfter(0, internal.ai.generateQuiz, { lesson });
  },
});

export const forQuiz = internalQuery({
  args: { lesson: v.id("lessons") },
  handler: async (ctx, { lesson }) => {
    const doc = await ctx.db.get(lesson);
    if (!doc) return null;
    const course = await ctx.db.get(doc.course);
    return course ? { title: doc.title, content: doc.content, courseTitle: course.title, language: course.language } : null;
  },
});

export const saveQuiz = internalMutation({
  args: { lesson: v.id("lessons"), questions: v.array(question) },
  handler: async (ctx, { lesson, questions }) => {
    const doc = await ctx.db.get(lesson);
    if (!doc) return;
    await ctx.db.patch(lesson, { questions, quizStatus: "ready" });
    // The next copy of this course gets the quiz without asking the model again.
    const course = await ctx.db.get(doc.course);
    const entry = course?.library ? await ctx.db.get(course.library) : null;
    const target = entry?.lessons[doc.position];
    if (entry && target && !target.questions) {
      await ctx.db.patch(entry._id, { lessons: entry.lessons.map((l, i) => (i === doc.position ? { ...l, questions } : l)) });
    }
  },
});

export const failQuiz = internalMutation({
  args: { lesson: v.id("lessons") },
  handler: async (ctx, { lesson }) => {
    if (await ctx.db.get(lesson)) await ctx.db.patch(lesson, { quizStatus: "error" });
  },
});
