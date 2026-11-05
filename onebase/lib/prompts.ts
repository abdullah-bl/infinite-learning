export type Level = "beginner" | "intermediate" | "advanced";

export const systemPrompt = (language: string) =>
  `You are an expert educator who writes clear, accurate, engaging micro-courses. You explain hard ideas simply and never invent facts.
${language === "auto" ? "Reply in the language the topic is written in." : `Write everything in ${language}: titles, lessons, questions and next topics, even when the topic is written in another language or script. Keep technical terms readable, adding the original term in brackets where it helps.`}
You reply with one JSON object and nothing else: no prose before or after it, no code fences.`;

// What a learner can say was wrong, and what it asks of the next version.
const FIXES: Record<string, string> = {
  wrong: "A learner found factual mistakes. Be especially careful with facts; leave out anything you are not sure of.",
  basic: "A learner found it too basic. Go further and assume a little more.",
  hard: "A learner found it too hard. Use simpler words, smaller steps and more examples.",
  short: "A learner found the lessons too short. Write fuller lessons, at the top of the word range.",
  unclear: "A learner found it unclear. Explain each idea plainly before building on it.",
  language: "A learner got the wrong language. Write every word in the language you were told to use.",
};
export const FEEDBACK_REASONS = Object.keys(FIXES);

type Learner = { known?: string[]; shaky?: string[] };

/** The part of the prompt about what this learner already knows, when there is anything. */
const learnerPart = ({ known = [], shaky = [] }: Learner) =>
  known.length || shaky.length
    ? `

About this learner:${known.length ? `\n- They already know: ${known.join("; ")}.` : ""}${shaky.length ? `\n- They found these hard: ${shaky.join("; ")}.` : ""}
Use only the ideas that genuinely relate to "TOPIC". Don't teach a known idea from scratch: where it helps, connect to it in a sentence and spend the lessons on what is new. If a hard one comes up, explain it again simply. Ignore the rest; most will not apply. In "buildsOn", list the ideas from these two lists you actually built on, written exactly as above, or [] if none.`
    : "";

export const coursePrompt = (topic: string, level: Level, lessons: number, fix: { avoid?: string[]; note?: string } & Learner = {}) =>
  `Write a micro-course about "${topic}" for a ${level} learner.

Return this JSON:
{
  "title": "A short, specific course title (at most 4 words and 28 characters)",
  "description": "One sentence on what the learner will be able to do afterwards",
  "lessons": [
    { "title": "Lesson title (at most 4 words and 28 characters)", "content": "The lesson in Markdown", "concepts": ["2 to 4 key ideas this lesson teaches"] }
  ],
  "nextTopics": ["four related topics worth learning next, each at most 6 words"]${fix.known?.length || fix.shaky?.length ? `,\n  "buildsOn": []` : ""}
}

Rules:
- Exactly ${lessons} lessons, each building on the one before.
- Each lesson is 250 to 400 words of Markdown. Open with why the idea matters, explain it with one concrete example or analogy, and end with a short list of 2 to 4 key points under a "###" heading (written in the course's language). Use **bold** for key terms. Do not repeat the lesson title as a heading.
- "concepts" names the 2 to 4 key ideas each lesson teaches, 1 to 4 words each, as a glossary would name them ("supervised learning", "compound interest"), not as sentences. Use the same name for the same idea across lessons.
- Be correct. If you are unsure of a fact, leave it out.${
    fix.avoid?.length || fix.note
      ? `\n\nAn earlier version of this course was rated poorly. Fix this:\n${(fix.avoid ?? [])
          .map((r) => FIXES[r])
          .filter(Boolean)
          .map((f) => `- ${f}`)
          .join("\n")}${fix.note ? `\n- The learner wrote: "${fix.note.slice(0, 300).replace(/"/g, "'")}"` : ""}`
      : ""
  }${learnerPart(fix).replace("TOPIC", topic.replace(/"/g, "'"))}`;

export const quizPrompt = (courseTitle: string, lessonTitle: string, content: string) =>
  `Write a quiz for the lesson "${lessonTitle}" from the course "${courseTitle}".

Lesson text:
"""
${content.slice(0, 4000)}
"""

Return this JSON:
{
  "questions": [
    { "question": "…", "options": ["…", "…", "…", "…"], "correct": 0 }
  ]
}

Rules:
- Exactly 3 questions that test understanding of the lesson, not trivia.
- Exactly 4 options each. "correct" is the zero-based index of the one right option. Vary which index is right.
- Wrong options should be plausible, and the right one must be stated in the lesson.`;

/** For courses written before lessons named their key ideas: name them now. */
export const conceptsPrompt = (courseTitle: string, lessons: { title: string; content: string }[]) =>
  `These are the lessons of the course "${courseTitle}".

${lessons.map((l, i) => `Lesson ${i + 1}: ${l.title}\n${l.content.slice(0, 900)}`).join("\n\n")}

Return this JSON:
{ "lessons": [ { "concepts": ["2 to 4 key ideas this lesson teaches"] } ] }

Rules:
- One entry per lesson, in the same order: exactly ${lessons.length} entries.
- Each idea is 1 to 4 words, named as a glossary would name it, in the language the lessons are written in.
- Use the same name for the same idea across lessons.`;
