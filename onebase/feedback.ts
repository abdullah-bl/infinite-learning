import { ConvexError, v } from "onebase/values";
import { mutation, query } from "./_generated/server";
import { FEEDBACK_REASONS } from "./lib/prompts";
import { assertOwner } from "./lib/owner";

// A shared version stops being handed out once at least this many learners found it poor and
// they outnumber the ones who found it useful. Until then the next request still gets it.
const RETIRE_AFTER = 3;

/** This learner's rating of one of their courses, or null. */
export const mine = query({
  args: { owner: v.string(), course: v.id("courses") },
  handler: async (ctx, { owner, course }) => {
    assertOwner(owner);
    return await ctx.db.query("feedback").withIndex("by_course_owner", (q) => q.eq("course", course).eq("owner", owner)).first();
  },
});

/** Rates a course. Rating again changes the earlier rating rather than adding another. */
export const rate = mutation({
  args: {
    owner: v.string(),
    course: v.id("courses"),
    rating: v.union(v.literal("up"), v.literal("down")),
    reasons: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { owner, course, rating, reasons = [], note }) => {
    assertOwner(owner);
    const doc = await ctx.db.get(course);
    if (!doc || doc.owner !== owner || doc.status !== "ready") throw new ConvexError({ code: "not_found" });
    const clean = {
      rating,
      reasons: rating === "down" ? [...new Set(reasons)].filter((r) => FEEDBACK_REASONS.includes(r)) : [],
      note: rating === "down" && note?.trim() ? note.trim().slice(0, 500) : undefined,
    };

    const before = await ctx.db.query("feedback").withIndex("by_course_owner", (q) => q.eq("course", course).eq("owner", owner)).first();
    if (before) await ctx.db.patch(before._id, clean);
    else await ctx.db.insert("feedback", { owner, course, library: doc.library, ...clean });

    // Keep the shared version's counts in step: one learner, one vote.
    const entry = doc.library ? await ctx.db.get(doc.library) : null;
    if (entry && before?.rating !== rating) {
      let up = entry.up ?? 0;
      let down = entry.down ?? 0;
      if (before?.rating === "up") up--;
      if (before?.rating === "down") down--;
      if (rating === "up") up++;
      else down++;
      await ctx.db.patch(entry._id, { up, down, ...(down >= RETIRE_AFTER && down > up ? { retired: true } : {}) });
    }
  },
});
