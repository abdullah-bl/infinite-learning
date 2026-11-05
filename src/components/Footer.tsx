import { Link } from "@tanstack/react-router";
import { useI18n } from "~/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="foot">
      <div className="name" aria-hidden="true">{t("brand")}</div>
      <div className="grid">
        <div className="places">
          <Link to="/" hash="start">{t("foot.start")}</Link>
          <Link to="/" hash="courses">{t("foot.courses")}</Link>
          <Link to="/settings">{t("foot.settings")}</Link>
          <a href="https://github.com/abdullahbl/infinite-learning">{t("foot.github")}</a>
        </div>
        <div className="more">
          <p className="credits">{t("foot.credits")}</p>
        </div>
      </div>
      <div className="last">
        <span>{t("foot.made")}</span>
        <a href="#top">{t("foot.top")}</a>
      </div>
    </footer>
  );
}
