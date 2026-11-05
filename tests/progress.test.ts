import { expect, test } from "bun:test";
import { readProgress } from "../onebase/lib/progress";

const full = JSON.stringify({
  title: "Sourdough \"Basics\"",
  description: "Bake bread.",
  lessons: [
    { title: "What a starter is", content: "A **starter** is flour\nand water." },
    { title: "Feeding", content: "Feed it daily — café time." },
  ],
  nextTopics: ["Rye bread"],
});

test("reads the course out of a finished answer", () => {
  const p = readProgress(full);
  expect(p.title).toBe('Sourdough "Basics"');
  expect(p.lessons.map((l) => l.title)).toEqual(["What a starter is", "Feeding"]);
  expect(p.lessons[0].content).toBe("A **starter** is flour\nand water.");
});

test("reads a lesson that is still being written, at every cut", () => {
  for (let cut = 1; cut < full.length; cut++) {
    const p = readProgress(full.slice(0, cut));
    expect(p.lessons.length).toBeLessThanOrEqual(2);
    for (const l of p.lessons) expect(full).toContain(JSON.stringify(l.title).slice(1, -1).slice(0, 3));
  }
  const mid = full.slice(0, full.indexOf("café") + 2);
  const p = readProgress(mid);
  expect(p.lessons.length).toBe(2);
  expect(p.lessons[1].content.startsWith("Feed it daily")).toBe(true);
  expect(p.lessons.every((l) => !l.title.includes("Rye"))).toBe(true);
});

test("keeps only the lessons that arrived whole from a cut-off answer", async () => {
  const { wholeLessons } = await import("../onebase/lib/progress");
  const long = "x".repeat(120);
  const cut = JSON.stringify({ title: "T", lessons: [{ title: "One", content: long }, { title: "Two", content: long }] }).slice(0, -60);
  const kept = wholeLessons(cut);
  expect(kept.title).toBe("T");
  expect(kept.lessons.map((l) => l.title)).toEqual(["One"]);
});

test("a rewrite's prompt says what was wrong, and nothing else gets in", async () => {
  const { coursePrompt } = await import("../onebase/lib/prompts");
  const plain = coursePrompt("tea", "beginner", 3);
  expect(plain).not.toContain("rated poorly");
  const fixed = coursePrompt("tea", "beginner", 3, { avoid: ["short", "nonsense"], note: 'Say "more" about green tea' });
  expect(fixed).toContain("rated poorly");
  expect(fixed).toContain("too short");
  expect(fixed).not.toContain("nonsense");
  expect(fixed).toContain("Say 'more' about green tea");
});

test("the prompt mentions what the learner knows only when there is something", async () => {
  const { coursePrompt } = await import("../onebase/lib/prompts");
  expect(coursePrompt("tea", "beginner", 3)).not.toContain("About this learner");
  expect(coursePrompt("tea", "beginner", 3)).not.toContain("buildsOn");
  const p = coursePrompt('green "tea"', "beginner", 3, { known: ["oxidation", "tannins"], shaky: ["caffeine"] });
  expect(p).toContain("They already know: oxidation; tannins.");
  expect(p).toContain("They found these hard: caffeine.");
  expect(p).toContain(`relate to "green 'tea'"`);
  expect(p).toContain('"buildsOn": []');
});

test("an idea the model copied back with a slip still counts, a different one doesn't", async () => {
  const { matchIdea } = await import("../onebase/ai");
  const offered = ["قوة مغناطيسية", "بطارية ليثيوم-أيون", "Compound interest"];
  expect(matchIdea("قوة مغناطيات", offered)).toBe("قوة مغناطيسية");
  expect(matchIdea("بطاريه ليثيوم ايون", offered)).toBe("بطارية ليثيوم-أيون");
  expect(matchIdea("compound interest.", offered)).toBe("Compound interest");
  expect(matchIdea("simple interest", offered)).toBeUndefined();
  expect(matchIdea("قوة", offered)).toBeUndefined();
});
