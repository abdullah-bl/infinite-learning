// Fills a throwaway server with the fixture courses, for looking at the sky.
// Run against a server using the mock model: bun tests/seed-sky.ts http://localhost:8196
import { OnebaseClient } from "onebase/browser";
import { api } from "../onebase/_generated/api";
import { skyFixtures } from "./sky-fixtures";

const url = process.argv[2] ?? "http://localhost:8196";
const client = new OnebaseClient(url);
const key = () => crypto.randomUUID() + crypto.randomUUID();
const me = process.argv[3] ?? key();

const ids: Record<string, string> = {};
for (const [topic, f] of Object.entries(skyFixtures)) {
  const language = /[؀-ۿ]/.test(topic) ? "Arabic" : "English";
  const id = await client.mutation(api.courses.create, { owner: key(), topic, language, level: "beginner", lessons: f.lessons.length });
  ids[topic] = id as string;
}
// the server writes two at a time per learner and these are all different learners; give it time
await Bun.sleep(15000);

// a few are popular
const popular: Record<string, number> = { "how chatbots like chatgpt work": 9, "inflation": 6, "how sleep works": 5, "black holes": 4, "climate change": 3, "neural networks": 2 };
for (const [topic, n] of Object.entries(popular)) {
  for (let i = 0; i < n; i++) await client.mutation(api.courses.create, { owner: key(), topic, language: "English", level: "beginner", lessons: skyFixtures[topic].lessons.length });
}

// and one learner who has read some
const mine = ["how chatbots like chatgpt work", "neural networks", "how sleep works", "inflation"];
for (const topic of mine) {
  const id = await client.mutation(api.courses.create, { owner: me, topic, language: "English", level: "beginner", lessons: skyFixtures[topic].lessons.length });
  const got = await client.query(api.courses.get, { owner: me, id });
  if (!got) continue;
  for (const [i, lesson] of got.lessons.entries()) {
    if (topic === "inflation" && i > 0) break;
    if (topic === "neural networks" && i === 1) {
      // answered badly: shaky
      await client.mutation(api.lessons.requestQuiz, { owner: me, lesson: lesson._id });
      continue;
    }
    await client.mutation(api.lessons.setCompleted, { owner: me, lesson: lesson._id, completed: true });
  }
}
// answer the quiz on lesson 2 of neural networks wrongly, so it flickers
await Bun.sleep(3000);
const list = await client.query(api.courses.list, { owner: me });
for (const c of list) {
  const got = await client.query(api.courses.get, { owner: me, id: c._id });
  for (const lesson of got?.lessons ?? []) {
    if (lesson.quizStatus !== "ready" || !lesson.questions) continue;
    for (let q = 0; q < lesson.questions.length; q++) await client.mutation(api.lessons.answer, { owner: me, lesson: lesson._id, question: q, choice: 3 });
  }
}
console.log("me:", me);
process.exit(0);
