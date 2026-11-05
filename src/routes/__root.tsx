/// <reference types="vite/client" />
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useI18n } from "~/lib/i18n";
import appCss from "~/styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Infinite Learning: a short course on anything" },
      { name: "description", content: "Type any topic and an AI writes you a short course with lessons and quizzes, in about a minute. No account." },
      { name: "theme-color", content: "#1423b8" },
    ],
    links: [
      { rel: "preconnect", href: "https://api.fontshare.com" },
      { rel: "preconnect", href: "https://cdn.fontshare.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://api.fontshare.com/v2/css?f[]=pilcrow-rounded@400,500,700&display=swap" },
      // the Arabic face; the browser only downloads it for pages that use Arabic
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;700&display=swap" },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  // content is only hidden for its entrance when scripts run
  // `js` lets entrances hide content; the language and direction are set before first paint so an
  // Arabic reader never sees the page flip.
  scripts: () => [{ children: "(function(d){d.classList.add('js');try{var s=JSON.parse(localStorage.getItem('il.settings')||'{}');var l=s.ui||((navigator.language||'').slice(0,2)=='ar'?'ar':'en');if(l=='ar'){d.lang='ar';d.dir='rtl'}}catch(e){}})(document.documentElement)" }],
  shellComponent: Shell,
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

function Shell({ children }: { children: ReactNode }) {
  useReveal();
  const { lang, dir } = useI18n();
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
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
