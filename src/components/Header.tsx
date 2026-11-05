import { Link } from "@tanstack/react-router";
import { updateSettings } from "~/lib/device";
import { useI18n } from "~/lib/i18n";

/** Wordmark block, a green tab with the links, and the language switch and settings at the end. */
export function Header() {
  const { t, lang } = useI18n();
  return (
    <header className="top">
      <Link to="/" className="mark">{t("brand")}</Link>
      <nav className="tab" aria-label={t("nav.aria")}>
        <Link to="/" hash="how" className="wide">{t("nav.how")}</Link>
        <Link to="/" hash="courses" className="wide">{t("nav.courses")}</Link>
        <Link to="/map">{t("nav.map")}</Link>
        <Link to="/" hash="faq" className="wide">{t("nav.faq")}</Link>
      </nav>
      <div className="more">
        <button className="link" lang={lang === "ar" ? "en" : "ar"} onClick={() => updateSettings({ ui: lang === "ar" ? "en" : "ar" })}>
          {t("nav.switch")}
        </button>
        <Link to="/settings" className="wide-only">{t("nav.settings")}</Link>
      </div>
    </header>
  );
}
