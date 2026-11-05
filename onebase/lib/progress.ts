// Reads a course out of JSON that is still being written, so the page can show it as it
// arrives. Only the course title and the lessons matter; the last string may be cut off.

const STRING = /"(title|content)"\s*:\s*"((?:[^"\\]|\\.)*)(")?/g;

/** Unescapes a JSON string body, even one cut off in the middle of an escape. */
function unescape(body: string, closed: boolean) {
  const safe = closed ? body : body.replace(/\\u[0-9a-fA-F]{0,3}$/, "").replace(/\\$/, "");
  try {
    return JSON.parse(`"${safe}"`) as string;
  } catch {
    return safe.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

export type Progress = { title: string; lessons: { title: string; content: string }[] };

function read(text: string) {
  const at = text.indexOf('"lessons"');
  const head = at === -1 ? text : text.slice(0, at);
  const titleMatch = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(head);
  const lessons: { title: string; content: string; whole: boolean }[] = [];
  if (at !== -1) {
    // stop at nextTopics, which comes after the lessons
    const end = text.indexOf('"nextTopics"', at);
    const body = text.slice(at, end === -1 ? undefined : end);
    for (const m of body.matchAll(STRING)) {
      const closed = m[3] === '"';
      const value = unescape(m[2], closed).slice(0, 8000);
      if (m[1] === "title") lessons.push({ title: value.slice(0, 120), content: "", whole: false });
      else if (lessons.length > 0) Object.assign(lessons[lessons.length - 1], { content: value, whole: closed });
    }
  }
  return { title: titleMatch ? unescape(titleMatch[1], true).slice(0, 100) : "", lessons };
}

export function readProgress(text: string): Progress {
  const { title, lessons } = read(text);
  return { title, lessons: lessons.map(({ title, content }) => ({ title, content })) };
}

/** The lessons of a cut-off answer that arrived whole, to keep rather than throw away. */
export function wholeLessons(text: string): Progress {
  const { title, lessons } = read(text);
  const whole = [];
  for (const l of lessons) if (l.whole && l.content.length > 80) whole.push({ title: l.title, content: l.content });
  return { title, lessons: whole };
}
