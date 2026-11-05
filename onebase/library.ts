import { cached } from "onebase/components/action-cache";
import { v } from "onebase/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, internalMutation, internalQuery, mutation, type ActionCtx, type MutationCtx } from "./_generated/server";
import { embed } from "./lib/embed";
import { assertOwner } from "./lib/owner";
import { normalise } from "./lib/topic";

// How close a course must be, by meaning, to be offered. Measured with the default embedding
// model against "topic. title.": the same topic in other words or another language scores 0.58
// to 0.91 ("electric vehicles", «كيف تعمل السيارات الكهربائية»), a narrower one about 0.4
// ("EV batteries"), unrelated ones under 0.3.
const SIMILAR = 0.5;

/** What a library entry is embedded as. The description is left out: it blurs the match. */
const indexText = (e: { topic: string; title: string }) => `${e.topic}. ${e.title}.`;

/** The version of a course that is handed out for this key: the newest one not retired. */
export async function liveEntry(ctx: { db: MutationCtx["db"] }, key: string): Promise<Doc<"library"> | null> {
  const all = await ctx.db.query("library").withIndex("by_key", (q) => q.eq("key", key)).collect();
  for (let i = all.length - 1; i >= 0; i--) if (!all[i].retired) return all[i];
  return null;
}

/** Puts a copy of a shared course in a learner's own list, ready to read: their own lessons,
 *  progress and answers, starting from nothing. A course they already copied is opened again. */
export async function copyToOwner(ctx: MutationCtx, owner: string, entry: Doc<"library">): Promise<Id<"courses">> {
  const mine = await ctx.db.query("courses").withIndex("by_owner", (q) => q.eq("owner", owner)).order("desc").take(100);
  for (const c of mine) if (c.library === entry._id) return c._id;

  const id = await ctx.db.insert("courses", {
    owner,
    topic: entry.topic,
    language: entry.language,
    level: entry.level,
    status: "ready",
    title: entry.title,
    description: entry.description,
    nextTopics: entry.nextTopics,
    model: entry.model,
    planned: entry.lessons.length,
    library: entry._id,
    // copies of older library courses have no key ideas yet; the map asks for them
    conceptsAsked: entry.lessons.every((l) => l.concepts?.length),
  });
  for (let i = 0; i < entry.lessons.length; i++) {
    const l = entry.lessons[i];
    await ctx.db.insert("lessons", {
      course: id,
      owner,
      position: i,
      title: l.title,
      content: l.content,
      concepts: l.concepts,
      completed: false,
      quizStatus: l.questions ? "ready" : "none",
      questions: l.questions,
    });
  }
  await ctx.db.patch(entry._id, { uses: entry.uses + 1 });
  return id;
}

/** Opens a shared course the learner picked from the suggestions. */
export const adopt = mutation({
  args: { owner: v.string(), id: v.id("library") },
  handler: async (ctx, { owner, id }) => {
    assertOwner(owner);
    const entry = await ctx.db.get(id);
    if (!entry || entry.retired) return null;
    return await copyToOwner(ctx, owner, entry);
  },
});

export const embedText = internalAction({
  args: { text: v.string() },
  handler: (_ctx, { text }): Promise<number[]> => embed(text),
});

// Embeddings are kept for a week by the action cache, so typing the same words again costs nothing.
const embedCached = cached("cache", internal.library.embedText, ({ text }: { text: string }) => normalise(text));
// `cached` types its context loosely, as if the cache were the only component mounted.
const embedVia = (ctx: ActionCtx, text: string): Promise<number[]> => embedCached(ctx as unknown as Parameters<typeof embedCached>[0], { text });

type Card = { id: Id<"library">; title: string; topic: string; level: Doc<"library">["level"]; lessons: number; score: number | null; up: number };

/** Courses already written that are about what is being typed, best first. By meaning when the
 *  embedding model answers, by words when it doesn't. */
export const similar = action({
  args: { owner: v.string(), text: v.string(), language: v.string() },
  handler: async (ctx, { owner, text, language }): Promise<Card[]> => {
    assertOwner(owner);
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 120);
    if (clean.length < 3) return [];
    const { ok } = await ctx.components.limiter.limit({ name: "suggest", key: owner });
    if (!ok) return [];

    try {
      const vector = await embedVia(ctx, clean);
      const hits = await ctx.vectorSearch("library", "by_embedding", { vector, limit: 8, filter: (q) => q.eq("language", language) });
      const close = hits.filter((h) => h._score >= SIMILAR).slice(0, 3);
      return await ctx.runQuery(internal.library.cards, { ids: close.map((h) => h._id), scores: close.map((h) => h._score) });
    } catch (err) {
      console.error("similar: embedding failed, searching by words:", err instanceof Error ? err.message : err);
      return await ctx.runQuery(internal.library.byWords, { text: clean, language });
    }
  },
});

const card = (e: Doc<"library">, score: number | null): Card => ({
  id: e._id,
  title: e.title,
  topic: e.topic,
  level: e.level,
  lessons: e.lessons.length,
  score,
  up: e.up ?? 0,
});

export const cards = internalQuery({
  args: { ids: v.array(v.id("library")), scores: v.array(v.number()) },
  handler: async (ctx, { ids, scores }): Promise<Card[]> => {
    const out: Card[] = [];
    for (let i = 0; i < ids.length; i++) {
      const e = await ctx.db.get(ids[i]);
      if (e && !e.retired) out.push(card(e, scores[i]));
    }
    return out;
  },
});

export const byWords = internalQuery({
  args: { text: v.string(), language: v.string() },
  handler: async (ctx, { text, language }): Promise<Card[]> => {
    const found = await ctx.db
      .query("library")
      .withSearchIndex("search_text", (q) => q.search("search", normalise(text)).eq("language", language))
      .take(3);
    const out: Card[] = [];
    for (const e of found) if (!e.retired) out.push(card(e, null));
    return out;
  },
});

/** Embeds a new library entry so it can be found by meaning. Without it, it is still found by
 *  its exact topic and by words. */
export const index = internalAction({
  args: { id: v.id("library") },
  handler: async (ctx, { id }): Promise<void> => {
    const entry = await ctx.runQuery(internal.library.entry, { id });
    if (!entry) return;
    try {
      const text = indexText(entry);
      const embedding = await embedVia(ctx, text);
      await ctx.runMutation(internal.library.setEmbedding, { id, embedding, embeddedAs: text });
    } catch (err) {
      console.error("library: could not embed", entry.title, err instanceof Error ? err.message : err);
    }
  },
});

export const entry = internalQuery({
  args: { id: v.id("library") },
  handler: (ctx, { id }): Promise<Doc<"library"> | null> => ctx.db.get(id),
});

export const setEmbedding = internalMutation({
  args: { id: v.id("library"), embedding: v.array(v.float64()), embeddedAs: v.string() },
  handler: async (ctx, { id, embedding, embeddedAs }) => {
    if (await ctx.db.get(id)) await ctx.db.patch(id, { embedding, embeddedAs });
  },
});

/** Entries with no embedding yet (the model was down) or one made from older text. */
export const stale = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"library">[]> => {
    const out: Id<"library">[] = [];
    for (const e of await ctx.db.query("library").take(2000)) {
      if (!e.embedding || e.embeddedAs !== indexText(e)) out.push(e._id);
      if (out.length >= 20) break;
    }
    return out;
  },
});

/** Run by a cron: catches up on entries the embedding model missed. */
export const reindex = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    for (const id of await ctx.runQuery(internal.library.stale, {})) await ctx.runAction(internal.library.index, { id });
  },
});
