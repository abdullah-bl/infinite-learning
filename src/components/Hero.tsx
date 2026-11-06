import { useState } from "react";
import { useI18n } from "~/lib/i18n";
import { Header } from "./Header";
import { TopicForm } from "./TopicForm";

/** A mosaic masthead: photographs in grey, flat colour tiles, and one tile that sets what you type. */
export function Hero() {
  const { t } = useI18n();
  const [topic, setTopic] = useState("");
  const shown = topic.trim();
  const len = shown.length > 34 ? "l" : shown.length > 16 ? "m" : "s";

  return (
    <>
      <Header />
      <div className="band">
        <div className="photo drift t-atlas"><img src="/img/atlas-hemisphere.jpg" width="1400" height="1100" alt={t("alt.atlas")} /></div>
        <div className="t-live">
          <p className="typed" dir="auto" data-len={len}>{shown || t("hero.empty")}</p>
        </div>
        <div className="photo t-euclid"><img src="/img/euclid.jpg" width="1400" height="887" alt={t("alt.euclid")} /></div>
        <div className="photo t-globe"><img src="/img/globe-gores.jpg" width="1400" height="658" alt={t("alt.globe")} /></div>
        <div className="t-pink" />
        <div className="photo t-reading"><img src="/img/reading-room.jpg" width="1400" height="934" alt={t("alt.reading")} /></div>
        <div className="photo t-planets"><img src="/img/atlas-planets.jpg" width="1400" height="1179" alt={t("alt.planets")} /></div>
      </div>
      <section className="intro field f1 grid" aria-labelledby="title">
        <p className="stand lead after">{t("hero.stand")}</p>
        <div className="axis">
          <h1 id="title" className="display">
            <span className="line"><span>{t("hero.t1")}</span></span>
            <span className="line"><span style={{ ["--d" as string]: "110ms" }}>{t("hero.t2")}</span></span>
          </h1>
          <div className="after">
            <TopicForm topic={topic} onTopic={setTopic} />
          </div>
        </div>
      </section>
    </>
  );
}
