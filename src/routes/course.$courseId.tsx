import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "onebase/react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { api } from "~/lib/api";
import type { Doc } from "../../onebase/_generated/dataModel";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { useStartCourse } from "~/components/useStartCourse";
import { useOwner } from "~/lib/device";
import { chapterField } from "~/lib/field";
import { courseError, errorText, useI18n, type Key } from "~/lib/i18n";

export const Route = createFileRoute("/course/$courseId")({ component: CoursePage });

function CoursePage() {
  const { courseId } = Route.useParams();
  return (
    <main>
      <Header />
      <Course id={courseId} />
      <Footer />
    </main>
  );
}

/** Generated titles vary in length; long ones are set smaller so they stay within two lines. */
const size = (t: string) => (t.length > 30 ? "l" : t.length > 16 ? "m" : "s");

function Opening() {
  const { t } = useI18n();
  return (
    <section className="field f1 writing" aria-live="polite">
      <h1 className="display">
        {t("c.opening")}
        <span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
      </h1>
    </section>
  );
}

/** Ticks once a second, for the elapsed time while a course is written. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The course while the model writes it: the outline fills in, and the lesson being written
 *  appears as it arrives. */
function LiveWriting({ course }: { course: Doc<"courses"> }) {
  const { t, lang } = useI18n();
  const now = useNow();
  const progress = course.progress;
  const lessons = progress?.lessons ?? [];
  // a model's id is "maker/name:free"; the name is what a reader can recognise
  const model = progress?.model?.split("/").pop()?.replace(/:free$/, "");
  const words = Math.round((progress?.thought ?? 0) / 6);
  const title = course.progress?.title || course.topic;
  const planned = Math.max(course.planned ?? 3, lessons.length);
  const current = lessons[lessons.length - 1];

  return (
    <section className="field f1 writing-live" aria-busy="true">
      <h1 className="display" dir="auto" data-len={size(title)}>{title}</h1>
      <div className="grid">
        <div className="status">
          <p className="lead" role="status">
            {lessons.length === 0 ? t("w.thinking") : t("w.lesson", { i: lessons.length, n: planned })}
            <span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
          </p>
          <p className="small num elapsed">{clock(now - course._creationTime)}</p>
          {(progress?.attempt ?? 1) > 1 && <p className="small">{t("w.retry")}</p>}
          {model && (
            <p className="small" dir="auto">
              {lessons.length === 0 && words > 0
                ? t("w.thought", { model, words: words.toLocaleString(lang) })
                : t("w.by", { model })}
            </p>
          )}
          <ol className="plan" aria-label={t("toc.aria")}>
            {Array.from({ length: planned }, (_, i) => (
              <li key={i} dir="auto" data-state={i < lessons.length - 1 ? "done" : i === lessons.length - 1 ? "now" : "todo"}>
                {lessons[i]?.title || t("w.pending", { i: i + 1 })}
              </li>
            ))}
          </ol>
          <p className="small">{t("w.note")}</p>
        </div>
        {current?.content ? (
          <div className="draft prose" dir="auto" aria-hidden="true">
            <Markdown>{current.content}</Markdown>
            <span className="caret" />
          </div>
        ) : (
          <div className="draft" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

function Course({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const owner = useOwner();
  const data = useQuery(api.courses.get, owner ? { owner, id } : "skip");

  useEffect(() => {
    if (data) document.title = `${data.course.title} · ${t("brand")}`;
  }, [data, t]);

  // The lessons arrive after the page does, so a link to #lesson-2 has nothing to scroll to at
  // first. Scroll once, when they are there.
  const ready = data?.course.status === "ready";
  const scrolled = useRef(false);
  useEffect(() => {
    if (!ready || scrolled.current) return;
    scrolled.current = true;
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [ready]);

  if (!owner || data === undefined) return <Opening />;
  if (data === null) {
    return (
      <section className="field f1 lost">
        <h1 className="display">{t("c.nf_h")}</h1>
        <p className="lead" style={{ maxWidth: "36ch" }}>{t("c.nf_d")}</p>
        <p><Link to="/settings" className="btn">{t("c.nf_btn")}</Link></p>
      </section>
    );
  }

  const { course, lessons } = data;
  if (course.status === "generating") return <LiveWriting course={course} />;
  if (course.status === "error") return <Failed course={course} owner={owner} />;

  let done = 0;
  for (const l of lessons) if (l.completed) done++;
  const last = chapterField(lessons.length - 1);
  const open = lessons.findIndex((l) => !l.completed);
  const hasNext = course.nextTopics.length > 0;

  return (
    <>
      <section className="field f1 course-top">
        <h1 className="display" dir="auto" data-len={size(course.title)} style={{ marginBottom: 24 }}>{course.title}</h1>
        <div className="grid">
          <div style={{ gridColumn: "1 / 6" }}>
            <p className="lead" dir="auto">{course.description}</p>
            <p className="meta">
              <span>{t(`level.${course.level}` as Key)}</span>
              <span>{t("c.lessons", { n: lessons.length })}</span>
              <span className="num">{t("c.done", { done, total: lessons.length })}</span>
              {course.model && <span>{t("c.by", { model: course.model })}</span>}
            </p>
            {course.builtOn && course.builtOn.length > 0 && (
              <p className="built-on">
                <span dir="auto">{t("c.builtOn", { ideas: course.builtOn.join(lang === "ar" ? "، " : ", ") })}</span>{" "}
                <Link to="/map">{t("map.see")}</Link>
              </p>
            )}
            <div className="row">
              {open === -1 ? (
                hasNext && <a className="btn" href="#next">{t("c.finished")}</a>
              ) : (
                <a className="btn" href={`#lesson-${open + 1}`}>
                  {done === 0 ? t("c.start") : t("c.continue", { i: open + 1 })}
                </a>
              )}
            </div>
          </div>
          <nav className="toc" aria-label={t("toc.aria")} style={{ gridColumn: "7 / 13" }}>
            {lessons.map((l, i) => (
              <a key={l._id} href={`#lesson-${i + 1}`}>
                <span dir="auto">{l.title}</span>
                <span>{l.completed ? t("toc.done") : ""}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {lessons.map((lesson, i) => (
        <LessonChapter key={lesson._id} lesson={lesson} index={i} total={lessons.length} owner={owner} hasNext={hasNext} />
      ))}

      <Next course={course} avoid={last} owner={owner} />
    </>
  );
}

function Failed({ course, owner }: { course: Doc<"courses">; owner: string }) {
  const { t } = useI18n();
  const { start, busy, error } = useStartCourse();
  const remove = useMutation(api.courses.remove);
  return (
    <section className="field f1 lost">
      <h1 className="display">{t("f.h")}</h1>
      <p className="lead" style={{ maxWidth: "40ch" }}>{courseError(course.error, t)}</p>
      <p className="small" role="status">{error}</p>
      <div className="row">
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            await remove({ owner, id: course._id });
            await start(course.topic);
          }}
        >
          {busy ? t("form.busy") : t("f.retry")}
        </button>
        <Link to="/" className="btn ink">{t("f.back")}</Link>
      </div>
    </section>
  );
}

function LessonChapter({ lesson, index, total, owner, hasNext }: { lesson: Doc<"lessons">; index: number; total: number; owner: string; hasNext: boolean }) {
  const { t } = useI18n();
  const field = chapterField(index);
  const setCompleted = useMutation(api.lessons.setCompleted);
  const isLast = index + 1 === total;
  const nextId = isLast ? (hasNext ? "next" : null) : `lesson-${index + 2}`;
  const goNext = () => nextId && document.getElementById(nextId)?.scrollIntoView();
  return (
    <section id={`lesson-${index + 1}`} className={`field ${field} lesson`} aria-labelledby={`lesson-h-${index + 1}`}>
      <h2 id={`lesson-h-${index + 1}`} className="head" dir="auto" data-len={size(lesson.title)} data-reveal>{lesson.title}</h2>
      <div className="grid">
        <p className="side" data-reveal>{t("l.of", { i: index + 1, n: total })}</p>
        <div className="body">
          <div className="prose" dir="auto" data-reveal>
            <Markdown>{lesson.content}</Markdown>
          </div>
          <Quiz lesson={lesson} owner={owner} />
          <div className="row">
            {!lesson.completed ? (
              <button
                className="btn"
                onClick={() => {
                  goNext();
                  void setCompleted({ owner, lesson: lesson._id, completed: true });
                }}
              >
                {!nextId ? t("l.done") : isLast ? t("l.finish") : t("l.next")}
              </button>
            ) : (
              <>
                {nextId && <a className="btn ink" href={`#${nextId}`}>{isLast ? t("n.h") : t("l.go_next")}</a>}
                <button className="link" onClick={() => void setCompleted({ owner, lesson: lesson._id, completed: false })}>{t("l.undone")}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Quiz({ lesson, owner }: { lesson: Doc<"lessons">; owner: string }) {
  const { t } = useI18n();
  const request = useMutation(api.lessons.requestQuiz);
  const answer = useMutation(api.lessons.answer);
  const retake = useMutation(api.lessons.retakeQuiz);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  const ask = async () => {
    asked.current = true;
    setError(null);
    try {
      await request({ owner, lesson: lesson._id });
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  // Write the quiz while the reader is still on the lesson, so it is there when they get to it.
  useEffect(() => {
    if (lesson.quizStatus !== "none" || asked.current || !box.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !asked.current) {
          io.disconnect();
          void ask();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(box.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.quizStatus]);

  if (lesson.quizStatus !== "ready" || !lesson.questions) {
    const failed = error !== null || lesson.quizStatus === "error";
    return (
      <div className="quiz" ref={box}>
        <h3>{t("q.h")}</h3>
        {failed ? (
          <>
            <p className="small" role="status">{error ?? t("q.err")}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn ink" onClick={ask}>{t("q.retry")}</button>
            </div>
          </>
        ) : (
          <p className="lead pending" role="status">
            {t("q.writing")}
            <span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
          </p>
        )}
      </div>
    );
  }

  let right = 0;
  let answered = 0;
  for (const q of lesson.questions) {
    if (q.userAnswer !== undefined) {
      answered++;
      if (q.userAnswer === q.correct) right++;
    }
  }
  const finished = answered === lesson.questions.length;

  return (
    <div className="quiz">
      <h3>{t("q.h")}</h3>
      {lesson.questions.map((q, qi) => (
        <div className="q" key={qi}>
          <p className="ask-q" dir="auto">{q.question}</p>
          <div className="opts">
            {q.options.map((opt, oi) => {
              const picked = q.userAnswer === oi;
              const isRight = q.userAnswer !== undefined && oi === q.correct;
              const isWrong = picked && oi !== q.correct;
              return (
                <button
                  key={oi}
                  className={`opt${isRight ? " right" : ""}${isWrong ? " wrong" : ""}`}
                  disabled={q.userAnswer !== undefined}
                  onClick={() => void answer({ owner, lesson: lesson._id, question: qi, choice: oi })}
                >
                  <span dir="auto">{opt}</span>
                  {isRight && <span className="tag">{picked ? t("q.right") : t("q.the")}</span>}
                  {isWrong && <span className="tag">{t("q.yours")}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {finished && (
        <>
          <p className="score">{t("q.score", { right, n: lesson.questions.length })}</p>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn ink" onClick={() => void retake({ owner, lesson: lesson._id })}>{t("q.again")}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** Every course ends by offering the next ones, so there is always something to start. */
function Next({ course, avoid, owner }: { course: Doc<"courses">; avoid: string; owner: string }) {
  const { t } = useI18n();
  const { start, busy, error } = useStartCourse();
  const [picked, setPicked] = useState<string | null>(null);
  const field = avoid === "f1" ? "f2" : "f1";
  return (
    <section id="next" className={`field ${field} next`} aria-labelledby="next-h">
      <Feedback course={course} owner={owner} />
      {course.nextTopics.length > 0 && <h2 id="next-h" className="head" data-reveal>{t("n.h")}</h2>}
      <ul>
        {course.nextTopics.map((topic, i) => (
          <li key={topic} data-reveal style={{ ["--d" as string]: `${i * 70}ms` }}>
            <button
              className="poster"
              dir="auto"
              disabled={busy}
              onClick={() => {
                setPicked(topic);
                void start(topic);
              }}
            >
              {busy && picked === topic ? t("form.busy") : topic}
            </button>
          </li>
        ))}
      </ul>
      <p className="small" role="status" style={{ marginTop: 24 }}>{error}</p>
    </section>
  );
}

const REASONS = ["wrong", "basic", "hard", "short", "unclear", "language"] as const;

/** Was it useful? A version enough learners find poor stops being handed out, and the learner
 *  can have it written again with what they marked. */
function Feedback({ course, owner }: { course: Doc<"courses">; owner: string }) {
  const { t } = useI18n();
  const mine = useQuery(api.feedback.mine, { owner, course: course._id });
  const rate = useMutation(api.feedback.rate);
  const rewrite = useMutation(api.courses.rewrite);
  const navigate = useNavigate();
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [changing, setChanging] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pick up what was said before, once it loads
  const loadedId = mine?._id;
  useEffect(() => {
    if (mine?.rating === "down") {
      setReasons(mine.reasons);
      setNote(mine.note ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedId]);

  if (mine === undefined) return null;

  const send = async (rating: "up" | "down", extra?: { reasons: string[]; note: string }) => {
    setError(null);
    try {
      await rate({ owner, course: course._id, rating, ...extra });
      setChanging(false);
      if (extra) setSent(true);
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  const asking = mine === null || changing;
  return (
    <div className="feedback" data-reveal>
      <h2 className="lead fb-h">{t("fb.h")}</h2>
      {asking ? (
        <div className="seg">
          <button onClick={() => void send("up")}>{t("fb.up")}</button>
          <button onClick={() => void send("down")}>{t("fb.down")}</button>
        </div>
      ) : mine.rating === "up" ? (
        <p className="fb-said">
          {t("fb.thanks")} <button className="link" onClick={() => setChanging(true)}>{t("fb.change")}</button>
        </p>
      ) : (
        <>
          <p className="small">{t("fb.why")}</p>
          <div className="seg small-seg" role="group" aria-label={t("fb.why")}>
            {REASONS.map((r) => (
              <button
                key={r}
                aria-pressed={reasons.includes(r)}
                onClick={() => {
                  setSent(false);
                  setReasons((now) => (now.includes(r) ? now.filter((x) => x !== r) : [...now, r]));
                }}
              >
                {t(`fb.r.${r}` as Key)}
              </button>
            ))}
          </div>
          <form
            className="field-in"
            onSubmit={(e) => {
              e.preventDefault();
              void send("down", { reasons, note });
            }}
          >
            <label className="sr" htmlFor="fb-note">{t("fb.note")}</label>
            <input id="fb-note" dir="auto" maxLength={500} placeholder={t("fb.note")} value={note} onChange={(e) => (setSent(false), setNote(e.target.value))} />
            <button className="btn ink" type="submit">{t("fb.send")}</button>
          </form>
          <p className="small" role="status">
            {sent ? t("fb.sent") : null} <button className="link" onClick={() => setChanging(true)}>{t("fb.change")}</button>
          </p>
          <div className="row">
            <button
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await rate({ owner, course: course._id, rating: "down", reasons, note });
                  const id = await rewrite({ owner, id: course._id });
                  await navigate({ to: "/course/$courseId", params: { courseId: id } });
                } catch (err) {
                  setError(errorText(err, t));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? t("form.busy") : t("fb.rewrite")}
            </button>
            <span className="small">{t("fb.rewrite_d")}</span>
          </div>
        </>
      )}
      {error && <p className="small" role="alert">{error}</p>}
    </div>
  );
}
