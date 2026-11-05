import { useI18n } from "~/lib/i18n";

/** Three tiles that grow as the work goes on: a topic, a lesson, a quiz. */
export function HowItWorks() {
  const { t } = useI18n();
  return (
    <section id="how" className="field f3 chapter how" aria-labelledby="how-h">
      <div className="stages">
        <h2 id="how-h" className="head heading" data-reveal>{t("how.h")}</h2>

        <div className="tile s1" data-reveal style={{ ["--d" as string]: "80ms" }}>
          <span className="mini-copy">{t("how.you_type")}</span>
          <p className="mini-title">{t("how.topic")}<span className="caret" aria-hidden="true" /></p>
        </div>
        <div className="tile s2" data-reveal style={{ ["--d" as string]: "160ms" }}>
          <span className="mini-copy">{t("how.lesson")}</span>
          <div>
            <p className="mini-title" style={{ marginBottom: 12 }}>{t("how.l_title")}</p>
            <p className="mini-copy">{t("how.l_copy")}</p>
          </div>
        </div>
        <div className="tile s3" data-reveal style={{ ["--d" as string]: "240ms" }}>
          <p className="mini-copy"><b>{t("how.q")}</b></p>
          <div>
            <span className="mini-opt ok">{t("how.o1")}</span>
            <span className="mini-opt">{t("how.o2")}</span>
            <span className="mini-opt">{t("how.o3")}</span>
          </div>
        </div>

        <div className="say a" data-reveal style={{ ["--d" as string]: "120ms" }}>
          <p className="stage">{t("how.typed")}</p>
          <p className="small">{t("how.typed_d")}</p>
        </div>
        <div className="say b" data-reveal style={{ ["--d" as string]: "200ms" }}>
          <p className="stage">{t("how.written")}</p>
          <p className="small">{t("how.written_d")}</p>
        </div>
        <div className="say c" data-reveal style={{ ["--d" as string]: "280ms" }}>
          <p className="stage">{t("how.tested")}</p>
          <p className="small">{t("how.tested_d")}</p>
        </div>
      </div>
    </section>
  );
}
