import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "onebase/react";
import { useEffect, useState } from "react";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { Live } from "~/components/Live";
import { api } from "~/lib/api";
import { useOwner } from "~/lib/device";
import { errorText, useI18n, type T } from "~/lib/i18n";

export const Route = createFileRoute("/review")({
  head: () => ({ meta: [{ title: "Review · Infinite Learning" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { t } = useI18n();
  return (
    <main>
      <Header />
      <Live fallback={<section className="field f1 map-top"><h1 className="display">{t("rv.h")}</h1></section>}>
        <Review />
      </Live>
      <Footer />
    </main>
  );
}

/** "tomorrow", "in 3 days", "today": when something comes back. */
export function whenText(due: number, t: T) {
  const days = Math.round((due - Date.now()) / 86_400_000);
  return days <= 0 ? t("rv.today") : days === 1 ? t("rv.tomorrow") : t("rv.in_days", { n: days });
}

type Item = { card: string; course: string; courseTitle: string; lesson: number; lessonTitle: string; question: string; options: string[] };
type Result = { right: boolean; correct: number; due: number; picked: number };

function Review() {
  const { t } = useI18n();
  const owner = useOwner();
  // the moment the page opened: what was due then is this sitting's queue
  const [opened] = useState(() => Date.now());
  const due = useQuery(api.reviews.due, owner ? { owner, now: opened } : "skip");
  const answer = useMutation(api.reviews.answer);
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [at, setAt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t("rv.h")} · ${t("brand")}`;
  }, [t]);
  useEffect(() => {
    if (due && queue === null) setQueue(due.items as Item[]);
  }, [due, queue]);

  if (!owner || !due || !queue) return <section className="field f1 map-top"><h1 className="display">{t("rv.h")}</h1></section>;

  if (queue.length === 0) {
    return (
      <section className="field f1 lost">
        <h1 className="display">{t("rv.none_h")}</h1>
        <p className="lead" style={{ maxWidth: "40ch" }}>
          {due.next ? t("rv.later", { when: whenText(due.next, t) }) : t("rv.none")}
        </p>
        <p><Link to="/map" className="btn ink">{t("map.see")}</Link></p>
      </section>
    );
  }

  if (at >= queue.length) {
    return (
      <section className="field f1 lost">
        <h1 className="display">{t("rv.done_h")}</h1>
        <p className="lead">{t("rv.done", { right: score, n: queue.length })}</p>
        {due.count > queue.length && <p>{t("rv.more", { n: due.count - queue.length })}</p>}
        <div className="row">
          {due.count > queue.length && <button className="btn" onClick={() => location.reload()}>{t("rv.go")}</button>}
          <Link to="/map" className="btn ink">{t("map.see")}</Link>
        </div>
      </section>
    );
  }

  const item = queue[at];
  const pick = async (choice: number) => {
    if (result) return;
    setError(null);
    try {
      const r = await answer({ owner, card: item.card as never, choice });
      setResult({ ...r, picked: choice });
      if (r.right) setScore((s) => s + 1);
    } catch (err) {
      setError(errorText(err, t));
    }
  };

  return (
    <>
      <section className="field f1 map-top">
        <h1 className="display">{t("rv.h")}</h1>
        <p className="lead stand">{t("rv.stand", { n: queue.length })}</p>
        <p className="small num" aria-live="polite">{t("rv.progress", { i: at + 1, n: queue.length })}</p>
      </section>
      <section className="field f3 review" aria-labelledby="rv-q">
        <div className="card">
          <p className="small" dir="auto">{t("rv.from", { course: item.courseTitle, i: item.lesson + 1 })}</p>
          <h2 id="rv-q" className="lead q-text" dir="auto">{item.question}</h2>
          <div className="opts">
            {item.options.map((opt, i) => {
              const right = result && i === result.correct;
              const wrong = result && i === result.picked && !result.right;
              return (
                <button key={i} className={`opt${right ? " right" : ""}${wrong ? " wrong" : ""}`} disabled={!!result} onClick={() => void pick(i)}>
                  <span dir="auto">{opt}</span>
                  {right && <span className="tag">{result.picked === i ? t("q.right") : t("q.the")}</span>}
                  {wrong && <span className="tag">{t("q.yours")}</span>}
                </button>
              );
            })}
          </div>
          {error && <p className="small" role="alert">{error}</p>}
          {result && (
            <div className="after-answer" role="status">
              <p className="lead">{result.right ? t("rv.right", { when: whenText(result.due, t) }) : t("rv.wrong", { when: whenText(result.due, t) })}</p>
              <div className="row">
                <button
                  className="btn"
                  autoFocus
                  onClick={() => {
                    setResult(null);
                    setAt((n) => n + 1);
                  }}
                >
                  {at + 1 < queue.length ? t("rv.next") : t("rv.finish")}
                </button>
                <Link className="link" to="/course/$courseId" params={{ courseId: item.course }} hash={`lesson-${item.lesson + 1}`}>
                  {t("rv.reread")}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
