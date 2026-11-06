import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useI18n } from "~/lib/i18n";

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: NotFound,
});

function Root() {
  useReveal();
  // keep the page's language and direction in step with the setting (the inline script in
  // index.html sets them before first paint)
  const { lang, dir } = useI18n();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  return <Outlet />;
}

/** Adds `.in` to every [data-reveal] element as it scrolls into view, including ones that appear later. */
function useReveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("in"));
      return;
    }
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const scan = () =>
      document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => {
        if (!seen.has(el)) {
          seen.add(el);
          io.observe(el);
        }
      });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
}

function NotFound() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = `${t("nf.h")} · ${t("brand")}`;
  }, [t]);
  return (
    <main className="field f1 lost">
      <h1 className="display">{t("nf.h")}</h1>
      <p className="lead">{t("nf.d")}</p>
      <p>
        <Link to="/" className="btn">{t("nf.btn")}</Link>
      </p>
    </main>
  );
}
