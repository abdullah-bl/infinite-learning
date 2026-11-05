import { useI18n, type Key } from "~/lib/i18n";

export function Faq() {
  const { t } = useI18n();
  return (
    <section id="faq" aria-labelledby="faq-h">
      <div className="faq-head"><h2 id="faq-h" className="display" data-reveal>{t("faq.h")}</h2></div>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="band-q grid">
          <h3 data-reveal>{t(`faq.q${n}` as Key)}</h3>
          <p data-reveal style={{ ["--d" as string]: "90ms" }}>{t(`faq.a${n}` as Key)}</p>
        </div>
      ))}
    </section>
  );
}
