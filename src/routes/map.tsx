import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "onebase/react";
import { useEffect, useState } from "react";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { SkyExplorer } from "~/components/Sky";
import { useStartCourse } from "~/components/useStartCourse";
import { api } from "~/lib/api";
import { useOwner } from "~/lib/device";
import { useI18n, type Key } from "~/lib/i18n";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

function MapPage() {
  return (
    <main>
      <Header />
      <Map />
      <Footer />
    </main>
  );
}

function Map() {
  const { t } = useI18n();
  const owner = useOwner();
  const map = useQuery(api.graph.mine, owner ? { owner } : "skip");
  useEffect(() => {
    document.title = `${t("sky.h")} · ${t("brand")}`;
  }, [t]);

  return (
    <>
      <section className="field f2 sky-page" aria-labelledby="sky-h">
        <div className="sky-title">
          <h1 id="sky-h" className="head">{t("sky.h")}</h1>
          <p className="stand">{t("sky.stand")}</p>
        </div>
        <SkyExplorer />
      </section>

      {map && map.concepts.length > 0 && (
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
      )}
    </>
  );
}

type MapData = NonNullable<ReturnType<typeof useQuery<typeof api.graph.mine>>>;

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
