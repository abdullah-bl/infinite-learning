import { defineSchema, defineTable } from "onebase/server";
import { v } from "onebase/values";

const level = v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"));

const question = v.object({
  question: v.string(),
  options: v.array(v.string()),
  correct: v.number(),
  userAnswer: v.optional(v.number()),
});

// There are no accounts. A browser makes up a random `owner` key on first visit and sends it
// with every call, so the key is the only thing that unlocks a person's courses.
export default defineSchema({
  courses: defineTable({
    owner: v.string(),
    topic: v.string(),
    language: v.string(),
    level,
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("error")),
    title: v.string(),
    description: v.string(),
    // follow-up topics the model suggests, so each course leads to the next
    nextTopics: v.array(v.string()),
    error: v.optional(v.string()),
    model: v.optional(v.string()),
    // how many lessons were asked for, and the course as it streams in (cleared when done)
    planned: v.optional(v.number()),
    // the shared copy this course came from or went into
    library: v.optional(v.id("library")),
    // a new version written because this learner found an earlier one poor
    rewriteOf: v.optional(v.id("courses")),
    // set once the course's lessons have been read for their key ideas (courses written before
    // lessons carried them)
    conceptsAsked: v.optional(v.boolean()),
    // ideas from the learner's map this course was written to build on; such a course is theirs
    // alone and isn't shared
    builtOn: v.optional(v.array(v.string())),
    progress: v.optional(
      v.object({
        title: v.string(),
        lessons: v.array(v.object({ title: v.string(), content: v.string() })),
        model: v.optional(v.string()),
        thought: v.optional(v.number()), // characters of thinking so far
        attempt: v.optional(v.number()), // 1, 2 or 3
      }),
    ),
  })
    .index("by_owner", ["owner"])
    .index("by_status", ["status"]),

  // Every finished course, once, shared by everyone: a request that has already been written
  // is answered from here instead of the model. Only the course travels; nobody's progress,
  // answers or key does.
  library: defineTable({
    key: v.string(), // the normalised topic, language, level and length; see lib/topic.ts
    topic: v.string(),
    title: v.string(),
    description: v.string(),
    language: v.string(),
    level,
    model: v.optional(v.string()),
    lessons: v.array(
      v.object({
        title: v.string(),
        content: v.string(),
        concepts: v.optional(v.array(v.string())),
        questions: v.optional(v.array(v.object({ question: v.string(), options: v.array(v.string()), correct: v.number() }))),
      }),
    ),
    nextTopics: v.array(v.string()),
    uses: v.number(),
    search: v.string(), // topic and title together, for the full-text fallback
    embedding: v.optional(v.array(v.float64())), // for finding courses by meaning
    embeddedAs: v.optional(v.string()), // the text the embedding was made from
    // what learners thought of it; a version enough of them found poor is no longer handed out
    up: v.optional(v.number()),
    down: v.optional(v.number()),
    retired: v.optional(v.boolean()),
  })
    .index("by_key", ["key"])
    .searchIndex("search_text", { searchField: "search", filterFields: ["language"] })
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 2048, filterFields: ["language"] }),

  // Spaced review: each quiz question a learner has answered comes back after a while, sooner
  // when they got it wrong. A Leitner box: right moves it up a box (a longer wait), wrong sends
  // it back to the first.
  reviews: defineTable({
    owner: v.string(),
    course: v.id("courses"),
    lesson: v.id("lessons"),
    question: v.number(), // its index in the lesson's quiz
    box: v.number(), // 0 to 4
    due: v.number(), // when it comes back, ms since the epoch
    last: v.boolean(), // whether the latest answer, in the quiz or a review, was right
    seen: v.number(),
  })
    .index("by_owner_due", ["owner", "due"])
    .index("by_lesson_question", ["lesson", "question"])
    .index("by_course", ["course"]),

  // One rating per learner per course.
  feedback: defineTable({
    owner: v.string(),
    course: v.id("courses"),
    library: v.optional(v.id("library")),
    rating: v.union(v.literal("up"), v.literal("down")),
    reasons: v.array(v.string()),
    note: v.optional(v.string()),
  })
    .index("by_course_owner", ["course", "owner"])
    .index("by_library", ["library"]),

  lessons: defineTable({
    course: v.id("courses"),
    owner: v.string(),
    position: v.number(),
    title: v.string(),
    content: v.string(),
    completed: v.boolean(),
    quizStatus: v.union(v.literal("none"), v.literal("generating"), v.literal("ready"), v.literal("error")),
    // the lesson's key ideas: the points of the learner's knowledge map
    concepts: v.optional(v.array(v.string())),
    questions: v.optional(v.array(question)),
  }).index("by_course", ["course", "position"]),
});
