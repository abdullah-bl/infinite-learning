import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useI18n } from "~/lib/i18n";
import { Faq } from "~/components/Faq";
import { Footer } from "~/components/Footer";
import { Hero } from "~/components/Hero";
import { HowItWorks } from "~/components/HowItWorks";
import { Library } from "~/components/Library";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = t("meta.title");
  }, [t]);
  return (
    <main id="top">
      <Hero />
      <HowItWorks />
      <Library />
      <Faq />
      <Footer />
    </main>
  );
}
