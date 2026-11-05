import { ConvexError, v } from "onebase/values";
import { mutation, query } from "./_generated/server";
import { assertOwner } from "./lib/owner";
import { nextBox, WAITS } from "./lib/review";

const SESSION = 5; // questions per sitting

/** What is due now, a few at a time, most overdue first, with no answers given away. `now` comes
 *  from the page, which asks again as time passes. */
export const due = query({
  args: { owner: v.string(), now: v.number() },
  handler: async (ctx, { owner, now }) => {
    assertOwner(owner);
    const cards = await ctx.db.query("reviews").withIndex("by_owner_due", (q) => q.eq("owner", owner).lte("due", now)).collect();
    const items = [];
    for (const card of cards) {
      if (items.length === SESSION) break;
      const lesson = await ctx.db.get(card.lesson);
      const q = lesson?.questions?.[card.question];
      const course = lesson ? await ctx.db.get(lesson.course) : null;
      if (!lesson || !q || !course) continue;
      items.push({
        card: card._id,
        course: course._id,
        courseTitle: course.title,
        lesson: lesson.position,
        lessonTitle: lesson.title,
        concepts: lesson.concepts ?? [],
        question: q.question,
        options: q.options,
        box: card.box,
      });
    }
    // and when the next one is due, for "come back tomorrow"
    const later = await ctx.db.query("reviews").withIndex("by_owner_due", (q) => q.eq("owner", owner).gt("due", now)).first();
    return { items, count: cards.length, next: later?.due ?? null };
  },
});

/** Answers a review question, and sets when it comes back. */
export const answer = mutation({
  args: { owner: v.string(), card: v.id("reviews"), choice: v.number() },
  handler: async (ctx, { owner, card, choice }) => {
    assertOwner(owner);
    const doc = await ctx.db.get(card);
    if (!doc || doc.owner !== owner) throw new ConvexError({ code: "not_found" });
    const lesson = await ctx.db.get(doc.lesson);
    const q = lesson?.questions?.[doc.question];
    if (!q || choice < 0 || choice >= q.options.length) throw new ConvexError({ code: "bad_answer" });
    const right = choice === q.correct;
    const box = nextBox(doc.box, right);
    const due = Date.now() + WAITS[box];
    await ctx.db.patch(card, { box, due, last: right, seen: doc.seen + 1 });
    return { right, correct: q.correct, due };
  },
});
