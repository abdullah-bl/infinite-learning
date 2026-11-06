import { Link } from "@tanstack/react-router";
import { useI18n } from "~/lib/i18n";
import { SkyExplorer } from "./Sky";

/** The home page's sky: every course written here, open to explore before typing anything. */
export function SkySection() {
  const { t } = useI18n();
  return (
    <section id="sky" className="field f2 sky-home" aria-labelledby="sky-home-h">
      <div className="sky-title grid">
        <h2 id="sky-home-h" className="head" data-reveal>{t("sky.h_home")}</h2>
        <div className="side" data-reveal style={{ ["--d" as string]: "80ms" }}>
          <p className="stand">{t("sky.stand_home")}</p>
          <Link to="/map" className="btn ink">{t("map.see")}</Link>
        </div>
      </div>
      <SkyExplorer embedded />
    </section>
  );
}
