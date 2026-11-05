import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "onebase/react";
import { useState } from "react";
import { api } from "~/lib/api";
import { useOwner, useSettings, type Lang, type Settings } from "~/lib/device";
import { errorText, useI18n } from "~/lib/i18n";

/** The language a course is written in: the one chosen in Settings, or the interface's. */
export const courseLanguage = (settings: Settings, lang: Lang) =>
  settings.language === "auto" ? (lang === "ar" ? "Arabic" : "English") : settings.language;

/** Starts a course on a topic and opens it. The course is written in the background, so the page
 *  it opens shows it filling in. Unless the learner picked a course language, courses are written
 *  in the language they use the site in, whatever script the topic is typed in. */
export function useStartCourse() {
  const { t, lang } = useI18n();
  const owner = useOwner();
  const settings = useSettings();
  const create = useMutation(api.courses.create);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(topic: string) {
    if (!owner || busy) return;
    setBusy(true);
    setError(null);
    try {
      const language = courseLanguage(settings, lang);
      const id = await create({ owner, topic, language, level: settings.level, lessons: settings.lessons });
      await navigate({ to: "/course/$courseId", params: { courseId: id } });
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  }
  return { start, busy, error, ready: owner !== null };
}
