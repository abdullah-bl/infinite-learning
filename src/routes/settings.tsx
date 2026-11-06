import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Footer } from "~/components/Footer";
import { Header } from "~/components/Header";
import { setOwner, updateSettings, useOwner, useSettings, type Level } from "~/lib/device";
import { useI18n, type Key } from "~/lib/i18n";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const LANGUAGES = ["auto", "English", "Arabic", "Spanish", "French", "German", "Turkish", "Chinese"];

function Settings() {
  const { t } = useI18n();
  const s = useSettings();
  const owner = useOwner();
  const [other, setOther] = useState("");
  const [swap, setSwap] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    document.title = t("meta.settings");
  }, [t]);

  const customLanguage = !LANGUAGES.includes(s.language);

  return (
    <main>
      <Header />
      <section className="field f1 set">
        <h1 className="display">{t("s.h")}</h1>
        <div className="grid">
          <div className="opt-group">
            <h2>{t("s.ui")}</h2>
            <p>{t("s.ui_d")}</p>
            <div className="seg">
              <button lang="en" aria-pressed={s.ui === "en"} onClick={() => updateSettings({ ui: "en" })}>English</button>
              <button lang="ar" aria-pressed={s.ui === "ar"} onClick={() => updateSettings({ ui: "ar" })}>العربية</button>
            </div>
          </div>

          <div className="opt-group">
            <h2>{t("s.level")}</h2>
            <p>{t("s.level_d")}</p>
            <div className="seg">
              {LEVELS.map((l) => (
                <button key={l} aria-pressed={s.level === l} onClick={() => updateSettings({ level: l })}>{t(`level.${l}` as Key)}</button>
              ))}
            </div>
          </div>

          <div className="opt-group">
            <h2>{t("s.lessons")}</h2>
            <p>{t("s.lessons_d")}</p>
            <div className="seg">
              {[3, 4, 5, 6].map((n) => (
                <button key={n} aria-pressed={s.lessons === n} onClick={() => updateSettings({ lessons: n })}>{n}</button>
              ))}
            </div>
          </div>

          <div className="opt-group">
            <h2>{t("s.lang")}</h2>
            <p>{t("s.lang_d")}</p>
            <div className="seg">
              {LANGUAGES.map((l) => (
                <button key={l} aria-pressed={s.language === l} onClick={() => updateSettings({ language: l })}>{t(`lang.${l}` as Key)}</button>
              ))}
            </div>
            <form
              className="field-in"
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (other.trim()) updateSettings({ language: other.trim().slice(0, 40) });
              }}
            >
              <label className="sr" htmlFor="other-lang">{t("s.other_label")}</label>
              <input id="other-lang" dir="auto" placeholder={customLanguage ? s.language : t("s.other_ph")} value={other} onChange={(e) => setOther(e.target.value)} />
              <button className="btn ink" type="submit">{t("s.other_btn")}</button>
            </form>
          </div>

          <div className="opt-group">
            <h2>{t("s.key")}</h2>
            <p>{t("s.key_d")}</p>
            <p className="keybox" dir="ltr">{owner ?? "…"}</p>
            <div className="row" style={{ marginTop: 8 }}>
              <button
                className="btn ink"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(owner ?? "");
                    setMsg(t("s.copied"));
                  } catch {
                    setMsg(t("s.copy_fail"));
                  }
                }}
              >
                {t("s.copy")}
              </button>
            </div>
            <form
              className="field-in"
              style={{ marginTop: 24 }}
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  setOwner(swap);
                  setSwap("");
                  setMsg(t("s.swapped"));
                } catch {
                  setMsg(t("s.key_bad"));
                }
              }}
            >
              <label className="sr" htmlFor="swap-key">{t("s.swap_label")}</label>
              <input id="swap-key" dir="ltr" placeholder={t("s.swap_ph")} value={swap} onChange={(e) => setSwap(e.target.value)} autoComplete="off" />
              <button className="btn ink" type="submit">{t("s.swap_btn")}</button>
            </form>
            <p className="small" role="status" style={{ marginTop: 12 }}>{msg}</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
