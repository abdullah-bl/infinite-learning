import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "onebase/react";
import { useEffect, useState } from "react";
import { api } from "~/lib/api";
import { useOwner } from "~/lib/device";
import { useI18n } from "~/lib/i18n";

/** The visitor's courses, one per line at poster size. Titles left, one fact right. */
export function Library() {
  const { t } = useI18n();
  return (
    <section id="courses" className="field f2 library" aria-labelledby="courses-h">
      <div className="lib-head">
        <h2 id="courses-h" className="head" data-reveal>{t("lib.h")}</h2>
        <Link to="/map" className="btn ink">{t("map.see")}</Link>
      </div>
      <List />
    </section>
  );
}

function List() {
  const { t } = useI18n();
  const owner = useOwner();
  const courses = useQuery(api.courses.list, owner ? { owner } : "skip");
  // Gone from the list the moment it's confirmed; the server catches up a moment later.
  const remove = useMutation(api.courses.remove).withOptimisticUpdate((store, { owner, id }) => {
    const list = store.getQuery(api.courses.list, { owner });
    if (list) store.setQuery(api.courses.list, { owner }, list.filter((c) => c._id !== id));
  });
  // Deleting asks first, in the row itself: browser confirm() dialogs are blocked in some
  // browsers and embedded views, where they quietly answer "no".
  const [asking, setAsking] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!asking) return;
    const id = setTimeout(() => setAsking(null), 6000); // an unanswered question goes away
    return () => clearTimeout(id);
  }, [asking]);

  if (!owner || courses === undefined) return <p className="lead">{t("lib.loading")}</p>;

  if (courses.length === 0) {
    return (
      <div className="empty grid" data-reveal>
        <div className="words">
          <p className="display" style={{ marginBottom: 24 }}>{t("lib.none")}</p>
          <p className="lead">{t("lib.none_d")}</p>
          <Link to="/" hash="start" className="btn">{t("lib.first")}</Link>
        </div>
        <img src="/img/atlas-earth.jpg" width="1400" height="1194" loading="lazy" alt={t("alt.earth")} />
      </div>
    );
  }

  return (
    <ul>
      {courses.map((c, i) => (
        <li key={c._id} data-reveal style={{ ["--d" as string]: `${Math.min(i, 5) * 70}ms` }}>
          <Link
            to="/course/$courseId"
            params={{ courseId: c._id }}
            hash={c.completedCount > 0 && c.completedCount < c.lessonCount ? `lesson-${c.completedCount + 1}` : undefined}
            className="poster"
            dir="auto"
          >
            {c.title}
          </Link>
          <span className="detail">
            <span>
              {c.status === "generating" ? t("lib.writing") : c.status === "error" ? t("lib.failed") : t("lib.done", { done: c.completedCount, total: c.lessonCount })}
            </span>
            {asking === c._id ? (
              <span className="sure" role="group" aria-label={t("lib.sure")}>
                <span>{t("lib.sure")}</span>
                <button
                  className="link yes"
                  autoFocus
                  onClick={() => {
                    setAsking(null);
                    setFailed(null);
                    remove({ owner, id: c._id }).catch(() => setFailed(c._id));
                  }}
                >
                  {t("lib.yes")}
                </button>
                <button className="link" onClick={() => setAsking(null)}>{t("lib.no")}</button>
              </span>
            ) : (
              <button className="link" onClick={() => setAsking(c._id)} aria-label={`${t("lib.delete")}: ${c.title}`}>
                {failed === c._id ? t("err.generic") : t("lib.delete")}
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
