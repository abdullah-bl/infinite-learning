// A stand-in for OpenRouter so the backend can be tested without a key or network.
// Run: bun tests/mock-openrouter.ts   (listens on :8099)
const course = {
  title: "Sourdough Basics",
  description: "Bake a loaf of sourdough with a starter you keep alive.",
  lessons: [
    { title: "What a starter is", concepts: ["sourdough starter", "wild yeast"], content: "A **starter** is a jar of flour and water full of wild yeast and bacteria.\n\nYou feed it so it stays active and bubbly, and you keep a little of it between bakes.\n\n### Why it rises\n\nThe yeast makes gas, and the gluten network traps it inside the dough." },
    { title: "Feeding and timing", concepts: ["feeding schedule", "Wild yeast"], content: "Feed your starter at the same hour each day with equal parts flour and water.\n\nWarm kitchens speed it up; cold ones slow it down, so watch the bubbles rather than the clock.\n\nA ripe starter doubles in size within about six hours of feeding." },
    { title: "Shaping and baking", concepts: ["shaping dough", "steam baking"], content: "Fold the dough to build strength, shape it gently, then let it rest in a floured basket.\n\nBake it hot in a covered pot so steam keeps the crust open while the loaf springs up.\n\nCool the loaf fully before you cut it." },
  ],
  nextTopics: ["Rye bread", "Baker's percentages", "Pizza dough", "Fermentation science"],
};
const quiz = {
  questions: [
    { question: "What is in a starter?", options: ["Flour and water", "Only sugar", "Milk", "Oil"], correct: 0 },
    { question: "How should you decide when it is ready?", options: ["The clock", "The bubbles", "The smell of soap", "The colour of the jar"], correct: 1 },
    { question: "Why bake in a covered pot?", options: ["To keep steam in", "To save energy", "To make it flat", "To dry the crust"], correct: 0 },
  ],
};
const arCourse = {
  title: "أساسيات العجين المخمّر",
  description: "اخبز رغيفاً من العجين المخمّر بمخمّر تحافظ على نشاطه.",
  lessons: [
    { title: "ما هو المخمّر", content: "**المخمّر** وعاء من الدقيق والماء مليء بالخميرة البرية والبكتيريا.\n\nتغذّيه بانتظام ليبقى نشطاً، وتحتفظ بقليل منه بين مرة خبز وأخرى.\n\n### لماذا ينتفخ العجين؟\n\nتنتج الخميرة غازاً، وتحبسه شبكة الغلوتين داخل العجين، فيرتفع." },
    { title: "التغذية والتوقيت", content: "غذِّ المخمّر في الساعة نفسها كل يوم بكميات متساوية من الدقيق والماء.\n\nالمطبخ الدافئ يسرّع العملية والبارد يبطئها، فراقب الفقاعات لا الساعة.\n\nيتضاعف حجم المخمّر الناضج خلال نحو ست ساعات من التغذية." },
    { title: "التشكيل والخبز", content: "اطوِ العجين ليكتسب قوة، ثم شكّله برفق واتركه يرتاح في سلة مرشوشة بالدقيق.\n\nاخبزه في قدر مغطى وساخن ليبقى البخار محبوساً فيرتفع الرغيف.\n\nاترك الرغيف يبرد تماماً قبل أن تقطعه." },
  ],
  nextTopics: ["خبز الجاودار", "نسب الخباز", "عجينة البيتزا", "علم التخمّر"],
};
const arQuiz = {
  questions: [
    { question: "مم يتكوّن المخمّر؟", options: ["دقيق وماء", "سكر فقط", "حليب", "زيت"], correct: 0 },
    { question: "كيف تعرف أنه جاهز؟", options: ["بالساعة", "بالفقاعات", "برائحة الصابون", "بلون الوعاء"], correct: 1 },
    { question: "لماذا نخبز في قدر مغطى؟", options: ["لحبس البخار", "لتوفير الطاقة", "ليصبح مسطحاً", "لتجفيف القشرة"], correct: 0 },
  ],
};
const isArabic = (s: string) => /[\u0600-\u06FF]/.test(s);
Bun.serve({
  port: 8099,
  async fetch(req) {
    if (req.url.endsWith("/embeddings")) {
      // Word-overlap vectors: texts that share words point the same way, others don't.
      const { input } = (await req.json()) as { input: string[] };
      const data = input.map((text) => {
        const v = new Array(2048).fill(0);
        for (const w of text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2)) {
          let h = 0;
          for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
          v[h % 2048] += 1;
        }
        if (v.every((x) => x === 0)) v[0] = 1;
        return { embedding: v };
      });
      return Response.json({ data });
    }
    if (!req.url.endsWith("/chat/completions")) return new Response("not found", { status: 404 });
    const body = (await req.json()) as { messages: { content: string }[]; stream?: boolean };
    await Bun.sleep(300);
    const prompt = body.messages[1].content;
    const wantsQuiz = prompt.includes('"questions"');
    // naming the key ideas of an older course
    const wantsConcepts = prompt.includes('{ "lessons": [ { "concepts"');
    const conceptCount = (prompt.match(/^Lesson \d+:/gm) ?? []).length;
    const conceptsAnswer = { lessons: Array.from({ length: conceptCount }, (_, i) => ({ concepts: [`old idea ${i + 1}`, "shared old idea"] })) };
    const ar = isArabic(body.messages[1].content);
    // a topic marked OLD-STYLE comes back the way courses did before lessons named their ideas
    const oldStyle = prompt.includes("OLD-STYLE");
    const base = oldStyle ? { ...course, lessons: course.lessons.map(({ title, content }) => ({ title, content })) } : course;
    // building on what the learner knows: claim the known ideas that share a word with the topic,
    // the way a model would pick the related ones
    const topic = /micro-course about "([^"]+)"/.exec(prompt)?.[1]?.toLowerCase() ?? "";
    const known = /They already know: ([^\n]+)\./.exec(prompt)?.[1].split("; ") ?? [];
    const words = topic.split(/\s+/).filter((w) => w.length > 3);
    const buildsOn = known.filter((k) => words.some((w) => k.toLowerCase().includes(w)));
    const plain = prompt.includes('"buildsOn"') ? { ...base, buildsOn } : base;
    const content = "```json\n" + JSON.stringify(wantsConcepts ? conceptsAnswer : wantsQuiz ? (ar ? arQuiz : quiz) : ar ? arCourse : plain) + "\n```";
    if (!body.stream) return Response.json({ model: "mock/free", choices: [{ message: { content } }] });
    // Stream it the way OpenRouter does: SSE chunks, a keep-alive comment, then [DONE].
    const pieces = content.match(/[\s\S]{1,24}/g) ?? [];
    const enc = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(c) {
          c.enqueue(enc.encode(": OPENROUTER PROCESSING\n\n"));
          const thinkUntil = Date.now() + (wantsQuiz || wantsConcepts ? 0 : Number(process.env.MOCK_THINK_MS ?? 0));
          while (Date.now() < thinkUntil) {
            c.enqueue(enc.encode(`data: ${JSON.stringify({ model: "mock/thinker:free", choices: [{ delta: { content: "", reasoning: "Let me think about how to structure this course. " } }] })}\n\n`));
            await Bun.sleep(150);
          }
          for (const piece of pieces) {
            c.enqueue(enc.encode(`data: ${JSON.stringify({ model: "mock/free", choices: [{ delta: { content: piece } }] })}\n\n`));
            await Bun.sleep(wantsQuiz || wantsConcepts ? 5 : Number(process.env.MOCK_DELAY ?? 25));
          }
          c.enqueue(enc.encode("data: [DONE]\n\n"));
          c.close();
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  },
});
console.log("mock OpenRouter on :8099");
