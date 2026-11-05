import { Link, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "onebase/react";
import { useEffect, useState } from "react";
import { api } from "~/lib/api";
import { updateSettings, useOwner, useSettings, type Level } from "~/lib/device";
import { useI18n, type Key } from "~/lib/i18n";
import { courseLanguage, useStartCourse } from "./useStartCourse";

type Props = { topic: string; onTopic: (t: string) => void };

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

/** The one live thing on the page: whatever is typed here is set as the title card in the
 *  masthead, and submitting it writes the course. The two choices that shape a course sit right
 *  under it, so nobody has to find Settings first. */
export function TopicForm({ topic, onTopic }: Props) {
  const { t } = useI18n();
  const settings = useSettings();
  const { start, busy, error, ready } = useStartCourse();
  const [example, setExample] = useState(0);
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setExample((i) => (i + 1) % 8), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (topic.trim().length < 2) {
          setNudge(true);
          document.getElementById("topic")?.focus();
          return;
        }
        setNudge(false);
        void start(topic);
      }}
    >
      <div className="ask" id="start">
        <label className="sr" htmlFor="topic">{t("form.label")}</label>
        <input
          id="topic"
          name="topic"
          dir="auto"
          autoComplete="off"
          maxLength={120}
          placeholder={t(`ex.${example}` as Key)}
          value={topic}
          onChange={(e) => onTopic(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !ready}>
          {busy ? t("form.busy") : t("form.go")}
        </button>
      </div>
      <div className="choices">
        <div className="chips" role="group" aria-label={t("opt.level")}>
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={settings.level === l} onClick={() => updateSettings({ level: l })}>
              {t(`level.${l}` as Key)}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label={t("opt.lessons")}>
          {[3, 4, 5, 6].map((n) => (
            <button key={n} type="button" aria-pressed={settings.lessons === n} onClick={() => updateSettings({ lessons: n })}>
              {t("c.lessons", { n })}
            </button>
          ))}
        </div>
      </div>
      <Similar topic={topic} />
      <p className={`note small${error || nudge ? " err" : ""}`} role="status">
        {error ?? (nudge ? t("form.nudge") : ready ? t("form.note") : "")}
      </p>
      <Resume />
      <ReviewNudge />
    </form>
  );
}

/** For someone coming back: the latest course they haven't finished, opened at the next lesson. */
function Resume() {
  const { t } = useI18n();
  const owner = useOwner();
  const courses = useQuery(api.courses.list, owner ? { owner } : "skip");
  const course = courses?.find((c) => c.status === "ready" && c.completedCount < c.lessonCount);
  if (!course) return null;
  const i = Math.min(course.completedCount + 1, course.lessonCount);
  return (
    <p className="resume">
      <Link to="/course/$courseId" params={{ courseId: course._id }} hash={`lesson-${i}`} dir="auto">
        {t("home.resume", { title: course.title, i, n: course.lessonCount })}
      </Link>
    </p>
  );
}

type Card = { id: string; title: string; topic: string; level: Level; lessons: number; up: number };

/** Courses someone already wrote about what is being typed. Opening one is instant and costs
 *  no model call, so these come before writing a new one. */
function Similar({ topic }: { topic: string }) {
  const { t, lang } = useI18n();
  const settings = useSettings();
  const owner = useOwner();
  const similar = useAction(api.library.similar);
  const adopt = useMutation(api.library.adopt);
  const navigate = useNavigate();
  const [cards, setCards] = useState<Card[]>([]);
  const language = courseLanguage(settings, lang);

  // ask once typing pauses; a slower, older answer never replaces a newer one
  useEffect(() => {
    const text = topic.trim();
    if (!owner || text.length < 3) {
      setCards([]);
      return;
    }
    let current = true;
    const id = setTimeout(() => {
      similar({ owner, text, language })
        .then((found) => current && setCards(found as Card[]))
        .catch(() => current && setCards([]));
    }, 600);
    return () => {
      current = false;
      clearTimeout(id);
    };
  }, [topic, owner, language, similar]);

  if (!owner || cards.length === 0) return null;
  return (
    <div className="similar" aria-live="polite">
      <p className="small">{t("sim.h")}</p>
      <ul>
        {cards.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={async () => {
                const id = await adopt({ owner, id: c.id as never });
                if (id) await navigate({ to: "/course/$courseId", params: { courseId: id } });
              }}
            >
              <span className="t" dir="auto">{c.title}</span>
              <span className="m">
                {t(`level.${c.level}` as Key)} · {t("c.lessons", { n: c.lessons })}
                {c.up > 0 && <> · {t("sim.liked", { n: c.up })}</>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "3 questions to review today", when there are any. */
function ReviewNudge() {
  const { t } = useI18n();
  const owner = useOwner();
  // an hour's precision is plenty for "due today", and keeps the query from changing every render
  const [hour] = useState(() => Math.floor(Date.now() / 3_600_000) * 3_600_000 + 3_600_000);
  const due = useQuery(api.reviews.due, owner ? { owner, now: hour } : "skip");
  if (!due || due.count === 0) return null;
  return (
    <p className="resume">
      <Link to="/review">{due.count === 1 ? t("rv.nudge1") : t("rv.nudge", { n: due.count })}</Link>
    </p>
  );
}
