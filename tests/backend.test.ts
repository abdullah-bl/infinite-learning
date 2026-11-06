// End to end: starts the mock OpenRouter and `onebase dev`, then drives the real API over the
// client. Run with: bun test tests/backend.test.ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { OnebaseClient } from "onebase/browser";
import { api } from "../onebase/_generated/api";

const owner = crypto.randomUUID() + crypto.randomUUID();
const stranger = crypto.randomUUID() + crypto.randomUUID();
const procs: Bun.Subprocess[] = [];
let client: OnebaseClient;

const until = async <T>(fn: () => Promise<T | null | undefined | false>, ms = 15000): Promise<T> => {
  const end = Date.now() + ms;
  for (;;) {
    const got = await fn();
    if (got) return got;
    if (Date.now() > end) throw new Error("timed out");
    await Bun.sleep(150);
  }
};

beforeAll(async () => {
  procs.push(Bun.spawn(["bun", "tests/mock-openrouter.ts"], { stdout: "ignore" }));
  procs.push(
    Bun.spawn(["bunx", "onebase", "serve", "--port", "8191", "--data", ".test-data"], {
      env: { ...process.env, OPENROUTER_API_KEY: "test", OPENROUTER_URL: "http://localhost:8099", ONEBASE_DEPLOY: "off" },
      stdout: "ignore",
      stderr: "ignore",
    }),
  );
  client = new OnebaseClient("http://localhost:8191");
  await until(async () => (await fetch("http://localhost:8191/api/health").catch(() => null))?.ok);
});

afterAll(async () => {
  for (const p of procs) p.kill();
  await Bun.$`rm -rf .test-data`.quiet();
});

test("writes a course, a quiz, and keeps it private", async () => {
  const id = await client.mutation(api.courses.create, { owner, topic: "sourdough", language: "auto", level: "beginner", lessons: 3 });

  const early = await client.query(api.courses.get, { owner, id });
  expect(early?.course.status).toBe("generating");

  const ready = await until(async () => {
    const got = await client.query(api.courses.get, { owner, id });
    return got?.course.status === "ready" ? got : null;
  });
  expect(ready.course.title).toBe("Sourdough Basics");
  expect(ready.lessons.length).toBe(3);
  expect(ready.course.nextTopics.length).toBe(4);

  // someone with a different key sees nothing
  expect(await client.query(api.courses.get, { owner: stranger, id })).toBeNull();
  expect(await client.query(api.courses.list, { owner: stranger })).toEqual([]);

  const lesson = ready.lessons[0]._id;
  await client.mutation(api.lessons.requestQuiz, { owner, lesson });
  const withQuiz = await until(async () => {
    const got = await client.query(api.courses.get, { owner, id });
    return got?.lessons[0].quizStatus === "ready" ? got : null;
  });
  expect(withQuiz.lessons[0].questions?.length).toBe(3);

  for (let i = 0; i < 3; i++) await client.mutation(api.lessons.answer, { owner, lesson, question: i, choice: 0 });
  const done = await client.query(api.courses.get, { owner, id });
  expect(done?.lessons[0].completed).toBe(true);

  const [row] = await client.query(api.courses.list, { owner });
  expect(row.completedCount).toBe(1);
  expect(row.lessonCount).toBe(3);

  await client.mutation(api.courses.remove, { owner, id });
  expect(await client.query(api.courses.get, { owner, id })).toBeNull();
});

test("refuses a bad key and an empty topic", async () => {
  await expect(client.mutation(api.courses.create, { owner: "short", topic: "x", language: "auto", level: "beginner", lessons: 3 })).rejects.toThrow();
  await expect(client.mutation(api.courses.create, { owner, topic: " ", language: "auto", level: "beginner", lessons: 3 })).rejects.toThrow();
});

test("a course already written is copied at once, found by meaning, and keeps its quiz", async () => {
  const a = crypto.randomUUID() + crypto.randomUUID();
  const b = crypto.randomUUID() + crypto.randomUUID();
  const c = crypto.randomUUID() + crypto.randomUUID();
  const args = { language: "auto", level: "beginner" as const, lessons: 3 };

  // a writes it, and answers its first quiz
  const first = await client.mutation(api.courses.create, { owner: a, topic: "Bread science", ...args });
  const ready = await until(async () => {
    const got = await client.query(api.courses.get, { owner: a, id: first });
    return got?.course.status === "ready" ? got : null;
  });
  await client.mutation(api.lessons.requestQuiz, { owner: a, lesson: ready.lessons[0]._id });
  await until(async () => (await client.query(api.courses.get, { owner: a, id: first }))?.lessons[0].quizStatus === "ready");
  await client.mutation(api.lessons.answer, { owner: a, lesson: ready.lessons[0]._id, question: 0, choice: 1 });

  // b asks for the same thing, typed differently: ready straight away, nothing to wait for
  const copy = await client.mutation(api.courses.create, { owner: b, topic: "  bread SCIENCE! ", ...args });
  const got = await client.query(api.courses.get, { owner: b, id: copy });
  expect(got?.course.status).toBe("ready");
  expect(got?.lessons.map((l) => l.title)).toEqual(ready.lessons.map((l) => l.title));
  // the quiz came along, but not a's answer or progress
  expect(got?.lessons[0].quizStatus).toBe("ready");
  expect(got?.lessons[0].questions?.every((q) => q.userAnswer === undefined)).toBe(true);
  expect(got?.lessons.every((l) => !l.completed)).toBe(true);

  // asking again opens the same copy instead of making another
  expect(await client.mutation(api.courses.create, { owner: b, topic: "bread science", ...args })).toBe(copy);

  // c types something close and is offered it, then opens it
  const offered = await until(async () => {
    const found = await client.action(api.library.similar, { owner: c, text: "bread science sourdough basics", language: "auto" });
    return found.length ? found : null;
  });
  expect(offered[0].title).toBe(ready.course.title);
  const opened = await client.mutation(api.library.adopt, { owner: c, id: offered[0].id });
  expect((await client.query(api.courses.get, { owner: c, id: opened! }))?.lessons.length).toBe(3);

  // something unrelated offers nothing
  expect(await client.action(api.library.similar, { owner: c, text: "chess openings", language: "auto" })).toEqual([]);
}, 30_000);

test("ratings retire a poor version, and a rewrite takes its place", async () => {
  const keys = Array.from({ length: 6 }, () => crypto.randomUUID() + crypto.randomUUID());
  const [a, b, c, d, e, f] = keys;
  const args = { topic: "Coffee roasting", language: "auto", level: "beginner" as const, lessons: 3 };
  const ready = async (owner: string, id: string) =>
    until(async () => {
      const got = await client.query(api.courses.get, { owner, id });
      return got?.course.status === "ready" ? got : null;
    });

  const first = await client.mutation(api.courses.create, { owner: a, ...args });
  const original = await ready(a, first);

  // three learners copy it; one changes their mind, so it takes three "not useful" to outvote
  const copies: Record<string, string> = {};
  for (const o of [b, c, d]) copies[o] = await client.mutation(api.courses.create, { owner: o, ...args });
  await client.mutation(api.feedback.rate, { owner: b, course: copies[b] as never, rating: "down" });
  await client.mutation(api.feedback.rate, { owner: b, course: copies[b] as never, rating: "up" }); // changed: one vote, not two
  await client.mutation(api.feedback.rate, { owner: c, course: copies[c] as never, rating: "down", reasons: ["short", "made-up"] });
  expect((await client.query(api.feedback.mine, { owner: c, course: copies[c] as never }))?.reasons).toEqual(["short"]);
  await client.mutation(api.feedback.rate, { owner: d, course: copies[d] as never, rating: "down" });

  // 2 down, 1 up: still handed out
  const stillShared = await client.mutation(api.courses.create, { owner: e, ...args });
  expect((await client.query(api.courses.get, { owner: e, id: stillShared }))?.course.status).toBe("ready");
  await client.mutation(api.feedback.rate, { owner: e, course: stillShared as never, rating: "down" });

  // 3 down, 1 up: retired, so the next request is written fresh
  const fresh = await client.mutation(api.courses.create, { owner: f, ...args });
  expect((await client.query(api.courses.get, { owner: f, id: fresh }))?.course.status).toBe("generating");
  await ready(f, fresh);

  // a rewrite replaces whatever version is current, and the next learner gets the rewrite
  await client.mutation(api.feedback.rate, { owner: a, course: first as never, rating: "down", reasons: ["basic"] });
  const better = await client.mutation(api.courses.rewrite, { owner: a, id: first as never });
  const rewritten = await ready(a, better);
  expect(rewritten.course.rewriteOf).toBe(first);
  expect(rewritten.course.library).toBeDefined();
  expect(rewritten.course.library).not.toBe(original.course.library);
  const g = crypto.randomUUID() + crypto.randomUUID();
  const next = await client.mutation(api.courses.create, { owner: g, ...args });
  const nextCourse = await client.query(api.courses.get, { owner: g, id: next });
  expect(nextCourse?.course.status).toBe("ready"); // instant: a live version exists again
  expect(nextCourse?.course.library).toBe(rewritten.course.library);
  expect((await client.query(api.courses.list, { owner: a })).length).toBe(2); // the original and the rewrite
}, 60_000);

test("the knowledge map: ideas, how well they are known, what comes next, and older courses filled in", async () => {
  const owner = crypto.randomUUID() + crypto.randomUUID();
  const args = { language: "auto", level: "beginner" as const, lessons: 3 };
  const ready = async (id: string) =>
    until(async () => {
      const got = await client.query(api.courses.get, { owner, id });
      return got?.course.status === "ready" ? got : null;
    });

  const course = await ready(await client.mutation(api.courses.create, { owner, topic: "Map me", ...args }));
  let map = await client.query(api.graph.mine, { owner });
  expect(map.waiting).toBe(0);
  // "wild yeast" and "Wild yeast" are one idea, taught in two lessons
  const yeast = map.concepts.find((c) => c.key === "wild yeast");
  expect(yeast?.where.length).toBe(2);
  expect(map.concepts.length).toBe(5);
  expect(map.concepts.every((c) => c.state === "new")).toBe(true);
  expect(map.next.length).toBe(4);

  // lesson 1's quiz all wrong: shaky, and so is every idea it shares; lesson 3 done: known
  const [l1, , l3] = course.lessons;
  await client.mutation(api.lessons.requestQuiz, { owner, lesson: l1._id });
  const quiz = await until(async () => {
    const got = await client.query(api.courses.get, { owner, id: course.course._id });
    return got?.lessons[0].quizStatus === "ready" ? got.lessons[0].questions : null;
  });
  for (let i = 0; i < quiz.length; i++) await client.mutation(api.lessons.answer, { owner, lesson: l1._id, question: i, choice: (quiz[i].correct + 1) % 4 });
  await client.mutation(api.lessons.setCompleted, { owner, lesson: l3._id, completed: true });
  map = await client.query(api.graph.mine, { owner });
  const state = (key: string) => map.concepts.find((c) => c.key === key)?.state;
  expect(state("sourdough starter")).toBe("shaky");
  expect(state("wild yeast")).toBe("shaky");
  expect(state("feeding schedule")).toBe("new");
  expect(state("shaping dough")).toBe("known");

  // a course from before lessons named their ideas waits, then the map reads it
  await ready(await client.mutation(api.courses.create, { owner, topic: "OLD-STYLE history", ...args }));
  expect((await client.query(api.graph.mine, { owner })).waiting).toBe(1);
  await client.mutation(api.graph.fill, { owner });
  map = await until(async () => {
    const m = await client.query(api.graph.mine, { owner });
    return m.waiting === 0 ? m : null;
  });
  expect(map.concepts.find((c) => c.key === "shared old idea")?.where.length).toBe(3);

  // someone else's map has none of it
  expect((await client.query(api.graph.mine, { owner: crypto.randomUUID() + crypto.randomUUID() })).concepts).toEqual([]);
}, 60_000);

test("a new course builds on what the learner knows, and then is theirs alone", async () => {
  const learner = crypto.randomUUID() + crypto.randomUUID();
  const other = crypto.randomUUID() + crypto.randomUUID();
  const args = { language: "auto", level: "beginner" as const, lessons: 3 };
  const ready = async (owner: string, id: string) =>
    until(async () => {
      const got = await client.query(api.courses.get, { owner, id });
      return got?.course.status === "ready" ? got : null;
    });

  // the learner finishes a course, so its ideas are known
  const first = await ready(learner, await client.mutation(api.courses.create, { owner: learner, topic: "Yeast for beginners", ...args }));
  for (const l of first.lessons) await client.mutation(api.lessons.setCompleted, { owner: learner, lesson: l._id, completed: true });

  // a related topic: built on "wild yeast", and not handed to anyone else
  const related = await ready(learner, await client.mutation(api.courses.create, { owner: learner, topic: "Wild yeast fermentation", ...args }));
  expect(related.course.builtOn).toEqual(["wild yeast"]);
  expect(related.course.library).toBeUndefined();
  const theirs = await client.mutation(api.courses.create, { owner: other, topic: "Wild yeast fermentation", ...args });
  expect((await client.query(api.courses.get, { owner: other, id: theirs }))?.course.status).toBe("generating");

  // an unrelated topic builds on nothing, so it is shared as usual
  const unrelated = await ready(learner, await client.mutation(api.courses.create, { owner: learner, topic: "Chess for kids", ...args }));
  expect(unrelated.course.builtOn).toBeUndefined();
  expect(unrelated.course.library).toBeDefined();
}, 60_000);

test("review: wrong answers come back tomorrow, right ones later, and a good review is known", async () => {
  const owner = crypto.randomUUID() + crypto.randomUUID();
  const id = await client.mutation(api.courses.create, { owner, topic: "Review me", language: "auto", level: "beginner", lessons: 3 });
  const course = await until(async () => {
    const got = await client.query(api.courses.get, { owner, id });
    return got?.course.status === "ready" ? got : null;
  });
  const lesson = course.lessons[0]._id;
  await client.mutation(api.lessons.requestQuiz, { owner, lesson });
  const quiz = await until(async () => (await client.query(api.courses.get, { owner, id }))?.lessons[0].questions);

  // two wrong, one right: worth a review
  await client.mutation(api.lessons.answer, { owner, lesson, question: 0, choice: (quiz[0].correct + 1) % 4 });
  await client.mutation(api.lessons.answer, { owner, lesson, question: 1, choice: (quiz[1].correct + 1) % 4 });
  await client.mutation(api.lessons.answer, { owner, lesson, question: 2, choice: quiz[2].correct });
  const day = 86_400_000;
  const now = Date.now();
  const state = async () => (await client.query(api.graph.mine, { owner })).concepts.find((c) => c.key === "sourdough starter")?.state;
  expect(await state()).toBe("shaky");

  expect((await client.query(api.reviews.due, { owner, now })).count).toBe(0);
  const tomorrow = await client.query(api.reviews.due, { owner, now: now + day + 60_000 });
  expect(tomorrow.count).toBe(2);
  expect(tomorrow.items[0].question).toBe(quiz[0].question);
  expect(Object.keys(tomorrow.items[0])).not.toContain("correct"); // the answer isn't given away
  expect((await client.query(api.reviews.due, { owner, now: now + 3 * day + 60_000 })).count).toBe(3);

  // reviewing a wrong one right: back in three days, and with 2 of 3 right the idea is known now
  const r = await client.mutation(api.reviews.answer, { owner, card: tomorrow.items[0].card, choice: quiz[0].correct });
  expect(r.right).toBe(true);
  expect(Math.round((r.due - Date.now()) / day)).toBe(3);
  expect(await state()).toBe("known");

  // getting it wrong again sends it back to tomorrow
  const again = await client.mutation(api.reviews.answer, { owner, card: tomorrow.items[0].card, choice: (quiz[0].correct + 1) % 4 });
  expect(Math.round((again.due - Date.now()) / day)).toBe(1);

  // deleting the course takes its review questions with it
  await client.mutation(api.courses.remove, { owner, id });
  expect((await client.query(api.reviews.due, { owner, now: now + 100 * day })).count).toBe(0);
}, 60_000);

test("the sky: every shared course with its ideas, and a learner's stars fading when a review is due", async () => {
  const owner = crypto.randomUUID() + crypto.randomUUID();
  const id = await client.mutation(api.courses.create, { owner, topic: "black holes", language: "English", level: "beginner", lessons: 3 });
  // while it's being written, the learner's sky shows it forming
  expect((await client.query(api.graph.mine, { owner })).writing.map((w) => w.id)).toContain(id);
  const course = await until(async () => {
    const got = await client.query(api.courses.get, { owner, id });
    return got?.course.status === "ready" ? got : null;
  });

  // the shared sky has it once, with each lesson's ideas, and nothing about who wrote it
  const sky = await client.query(api.graph.atlas, { language: "English" });
  const entry = sky.find((c) => c.topic === "black holes");
  expect(entry?.title).toBe("how black holes work");
  expect(entry?.lessons[1].concepts).toContain("event horizon");
  expect(entry?.next).toContain("how stars die");
  expect(JSON.stringify(entry)).not.toContain(owner);
  expect(sky.filter((c) => c.topic === "black holes").length).toBe(1);
  expect((await client.query(api.graph.atlas, { language: "Arabic" })).some((c) => c.topic === "black holes")).toBe(false);

  // the learner's map knows which shared course their copy came from
  const map = await client.query(api.graph.mine, { owner });
  expect(map.courses[0].library).toBe(entry?.id);
  expect(map.writing.length).toBe(0);

  // a right answer is known now, and fades once its review is due
  const lesson = course.lessons[0]._id;
  await client.mutation(api.lessons.requestQuiz, { owner, lesson });
  const quiz = await until(async () => (await client.query(api.courses.get, { owner, id }))?.lessons[0].questions);
  for (let q = 0; q < quiz.length; q++) await client.mutation(api.lessons.answer, { owner, lesson, question: q, choice: quiz[q].correct });
  const gravity = async (now: number) => (await client.query(api.graph.mine, { owner, now })).concepts.find((c) => c.key === "gravity");
  expect(await gravity(Date.now())).toMatchObject({ state: "known", fading: false });
  expect(await gravity(Date.now() + 4 * 86_400_000)).toMatchObject({ state: "known", fading: true });
}, 60_000);
