import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "onebase/react";
import { useEffect, useMemo, useState } from "react";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { KnowledgeGraph, type NodeKind, type State } from "~/components/KnowledgeGraph";
import { Live } from "~/components/Live";
import { useStartCourse } from "~/components/useStartCourse";
import { api } from "~/lib/api";
import { useOwner } from "~/lib/device";
import { useI18n, type Key } from "~/lib/i18n";

export const Route = createFileRoute("/map")({
  head: () => ({ meta: [{ title: "My map · Infinite Learning" }] }),
  component: MapPage,
});

function MapPage() {
  const { t } = useI18n();
  return (
    <main>
      <Header />
      <Live fallback={<section className="field f1 map-top"><h1 className="display">{t("map.h")}</h1></section>}>
        <Map />
      </Live>
      <Footer />
    </main>
  );
}

function Map() {
  const { t, lang, dir } = useI18n();
  const owner = useOwner();
  const map = useQuery(api.graph.mine, owner ? { owner } : "skip");
  const fill = useMutation(api.graph.fill);
  const [opened] = useState(() => Date.now());
  const reviews = useQuery(api.reviews.due, owner ? { owner, now: opened } : "skip");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t("map.h")} · ${t("brand")}`;
  }, [t]);
  // older courses don't carry their key ideas yet: ask for a few each visit
  const waiting = map?.waiting ?? 0;
  useEffect(() => {
    if (owner && waiting > 0) void fill({ owner }).catch(() => {});
  }, [owner, waiting, fill]);

  const input = useMemo(
    () => (map ? { courses: map.courses.map((c) => ({ id: c.id, title: c.title })), concepts: map.concepts, next: map.next } : null),
    [map],
  );

  if (!owner || !map || !input) return <section className="field f1 map-top"><h1 className="display">{t("map.h")}</h1></section>;

  if (map.courses.length === 0) {
    return (
      <section className="field f1 lost">
        <h1 className="display">{t("map.empty")}</h1>
        <p className="lead" style={{ maxWidth: "36ch" }}>{t("map.empty_d")}</p>
        <p><Link to="/" hash="start" className="btn">{t("lib.first")}</Link></p>
      </section>
    );
  }

  const count = (s: State) => map.concepts.reduce((n, c) => n + (c.state === s ? 1 : 0), 0);
  const stateName = (s: State) => t(`map.s.${s}` as Key);
  const nodeLabel = (n: { kind: NodeKind; state?: State; label: string }) =>
    n.kind === "course" && !n.label ? t("map.h") : n.kind === "course" ? `${t("map.course")}: ${n.label}` : n.kind === "next" ? `${t("map.s.next")}: ${n.label}` : `${n.label}: ${stateName(n.state ?? "new")}`;

  return (
    <>
      <section className="field f1 map-top">
        <h1 className="display">{t("map.h")}</h1>
        <p className="lead stand">
          {t("map.stand", { ideas: map.concepts.length, courses: map.courses.length, known: count("known"), shaky: count("shaky"), fresh: count("new") })}
        </p>
        {waiting > 0 && (
          <p className="small" role="status">
            {t("map.filling")}
            <span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span>
          </p>
        )}
        {reviews && reviews.count > 0 && (
          <p><Link to="/review" className="btn">{reviews.count === 1 ? t("rv.nudge1") : t("rv.nudge", { n: reviews.count })}</Link></p>
        )}
        <ul className="legend" aria-label={t("map.legend")}>
          {(["known", "shaky", "new", "next"] as const).map((s) => (
            <li key={s} className={`lg-${s}`}><span className="dot" aria-hidden="true" />{t(`map.s.${s}` as Key)}</li>
          ))}
        </ul>
      </section>

      <section className="field f2 map-board" aria-label={t("map.h")}>
        <div className="grid">
          <div className="board">
            <KnowledgeGraph input={input} selected={selected} onSelect={setSelected} rtl={dir === "rtl"} label={nodeLabel} />
            <p className="small hint">{t("map.hint")}</p>
          </div>
          <Details map={map} selected={selected} lang={lang} />
        </div>
      </section>

      <section className="field f3 map-lists" aria-labelledby="lists-h">
        <h2 id="lists-h" className="head">{t("map.lists")}</h2>
        <div className="grid">
          {(["shaky", "known", "new"] as const).map((s) => (
            <div key={s} className="col">
              <h3>{t(`map.s.${s}` as Key)}</h3>
              <ul>
                {map.concepts.filter((c) => c.state === s).map((c) => {
                  const at = c.where[0];
                  return (
                    <li key={c.key}>
                      <Link to="/course/$courseId" params={{ courseId: at.course }} hash={`lesson-${at.lesson + 1}`} dir="auto">{c.label}</Link>
                      <span className="small" dir="auto">{at.courseTitle}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <NextList next={map.next} />
        </div>
      </section>
    </>
  );
}

type MapData = NonNullable<ReturnType<typeof useQuery<typeof api.graph.mine>>>;

/** What a selected point is, and where to go with it. */
function Details({ map, selected, lang }: { map: MapData; selected: string | null; lang: string }) {
  const { t } = useI18n();
  const { start, busy } = useStartCourse();
  if (!selected) return <aside className="details small">{t("map.hint")}</aside>;
  const [kind, ...rest] = selected.split(":");
  const id = rest.join(":");

  if (kind === "c") {
    const c = map.courses.find((x) => x.id === id);
    if (!c) return null;
    return (
      <aside className="details" lang={lang}>
        <p className="small">{t("map.course")}</p>
        <h3 dir="auto">{c.title}</h3>
        <p>{t("c.done", { done: c.done, total: c.total })}</p>
        <Link className="btn ink" to="/course/$courseId" params={{ courseId: c.id }}>{t("map.open")}</Link>
      </aside>
    );
  }
  if (kind === "n") {
    const n = map.next.find((x) => x.key === id);
    if (!n) return null;
    return (
      <aside className="details">
        <p className="small">{t("map.s.next")}</p>
        <h3 dir="auto">{n.label}</h3>
        <button className="btn" disabled={busy} onClick={() => void start(n.label)}>{busy ? t("form.busy") : t("map.start")}</button>
      </aside>
    );
  }
  const c = map.concepts.find((x) => x.key === id);
  if (!c) return null;
  return (
    <aside className="details">
      <p className="small">{t(`map.s.${c.state}` as Key)}</p>
      <h3 dir="auto">{c.label}</h3>
      <ul>
        {c.where.map((w) => (
          <li key={`${w.course}-${w.lesson}`}>
            <Link to="/course/$courseId" params={{ courseId: w.course }} hash={`lesson-${w.lesson + 1}`} dir="auto">
              {t("map.in", { title: w.courseTitle, i: w.lesson + 1 })}
            </Link>
          </li>
        ))}
      </ul>
      {c.state !== "known" && (
        <Link className="btn" to="/course/$courseId" params={{ courseId: c.where[0].course }} hash={`lesson-${c.where[0].lesson + 1}`}>
          {c.state === "shaky" ? t("map.review") : t("map.learn")}
        </Link>
      )}
    </aside>
  );
}

function NextList({ next }: { next: MapData["next"] }) {
  const { t } = useI18n();
  const { start, busy, error } = useStartCourse();
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="col">
      <h3>{t("map.s.next")}</h3>
      <ul>
        {next.map((n) => (
          <li key={n.key}>
            <button className="link" dir="auto" disabled={busy} onClick={() => (setPicked(n.key), void start(n.label))}>
              {busy && picked === n.key ? t("form.busy") : n.label}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="small" role="alert">{error}</p>}
    </div>
  );
}
