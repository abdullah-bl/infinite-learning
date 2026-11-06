// The sky: every shared course a constellation, every key idea a star, the learner's own courses
// and how well they know each idea laid over it. Pure data and layout, no React.

import { normalise } from "../../onebase/lib/topic";

export type Mastery = "known" | "shaky" | "new";

export type AtlasCourse = {
  id: string;
  title: string;
  topic: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  uses: number;
  lessons: { title: string; concepts: string[] }[];
  next: string[];
};

export type MyMap = {
  courses: { id: string; title: string; done: number; total: number; library: string | null }[];
  concepts: { key: string; label: string; state: Mastery; fading: boolean; where: { course: string; courseTitle: string; lesson: number; lessonTitle: string }[] }[];
  next: { key: string; label: string; from: string[] }[];
  writing: { id: string; topic: string }[];
};

export type Constellation = {
  id: string; // "L:<library id>", "C:<own course id>" or "W:<course being written>"
  title: string;
  topic: string;
  description: string;
  level?: AtlasCourse["level"];
  uses: number;
  lessons: { title: string; stars: string[] }[]; // star keys, in lesson order
  next: string[]; // labels
  mine: string | null; // the learner's own course, when they have one
  done: number;
  total: number;
  writing: boolean;
  x: number;
  y: number;
  r: number;
};

export type Star = {
  key: string;
  label: string;
  in: { c: string; lesson: number }[];
  state: Mastery | null; // null: not in any of the learner's courses
  fading: boolean;
  x: number;
  y: number;
};

export type Uncharted = { key: string; label: string; from: string[]; x: number; y: number };

export type Sky = {
  constellations: Constellation[];
  stars: Star[];
  uncharted: Uncharted[];
  /** courses that point at another course already in the sky */
  routes: [string, string][];
  /** the figure of each constellation: star to star, in lesson order */
  lines: { c: string; a: string; b: string; bridge: boolean }[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
};

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

/** Merges the shared courses and the learner's own into one list of constellations and stars. */
export function buildSky(atlas: AtlasCourse[], mine: MyMap | null, previous?: Map<string, { x: number; y: number }>): Sky {
  const consts: Constellation[] = [];
  const byId = new Map<string, Constellation>();
  const stars = new Map<string, Star>();
  const myState = new Map((mine?.concepts ?? []).map((c) => [c.key, c]));
  const myByLibrary = new Map<string, MyMap["courses"][number]>();
  for (const c of mine?.courses ?? []) if (c.library) myByLibrary.set(c.library, c);

  const addStar = (label: string, c: string, lesson: number) => {
    const key = normalise(label);
    if (!key) return null;
    let s = stars.get(key);
    if (!s) {
      const m = myState.get(key);
      s = { key, label, in: [], state: m?.state ?? null, fading: m?.fading ?? false, x: 0, y: 0 };
      stars.set(key, s);
    }
    if (!s.in.some((p) => p.c === c && p.lesson === lesson)) s.in.push({ c, lesson });
    return key;
  };
  const add = (c: Omit<Constellation, "x" | "y" | "r">) => {
    const full = { ...c, x: 0, y: 0, r: 0 };
    consts.push(full);
    byId.set(full.id, full);
    return full;
  };

  for (const e of atlas) {
    const own = myByLibrary.get(e.id);
    const id = `L:${e.id}`;
    const c = add({
      id,
      title: e.title,
      topic: e.topic,
      description: e.description,
      level: e.level,
      uses: e.uses,
      lessons: [],
      next: e.next,
      mine: own?.id ?? null,
      done: own?.done ?? 0,
      total: own?.total ?? e.lessons.length,
      writing: false,
    });
    // an older course with no key ideas yet shows its lessons as its stars
    c.lessons = e.lessons.map((l, i) => ({
      title: l.title,
      stars: (l.concepts.length ? l.concepts : [l.title]).map((label) => addStar(label, id, i)).filter((k): k is string => !!k),
    }));
  }

  // the learner's courses that aren't in the shared sky: personal ones, or other languages
  const inSky = new Set(atlas.map((e) => e.id));
  for (const own of mine?.courses ?? []) {
    if (own.library && inSky.has(own.library)) continue;
    const id = `C:${own.id}`;
    const lessons: { title: string; stars: string[] }[] = [];
    for (const k of mine?.concepts ?? []) {
      for (const w of k.where) {
        if (w.course !== own.id) continue;
        const l = (lessons[w.lesson] ??= { title: w.lessonTitle, stars: [] });
        const key = addStar(k.label, id, w.lesson);
        if (key && !l.stars.includes(key)) l.stars.push(key);
      }
    }
    add({
      id,
      title: own.title,
      topic: own.title,
      description: "",
      uses: 1,
      lessons: lessons.filter(Boolean),
      next: (mine?.next ?? []).filter((n) => n.from.includes(own.id)).map((n) => n.label),
      mine: own.id,
      done: own.done,
      total: own.total,
      writing: false,
    });
  }
  for (const w of mine?.writing ?? []) {
    add({ id: `W:${w.id}`, title: w.topic, topic: w.topic, description: "", uses: 0, lessons: [], next: [], mine: w.id, done: 0, total: 0, writing: true });
  }

  // where each course leads: to another course in the sky, or somewhere no one has been yet
  const named = new Map<string, string>();
  for (const c of consts) {
    named.set(normalise(c.topic), c.id);
    named.set(normalise(c.title), c.id);
  }
  const routes: [string, string][] = [];
  const uncharted = new Map<string, Uncharted>();
  for (const c of consts) {
    for (const label of c.next) {
      const key = normalise(label);
      if (!key) continue;
      const to = named.get(key);
      if (to && to !== c.id) {
        if (!routes.some(([a, b]) => (a === c.id && b === to) || (a === to && b === c.id))) routes.push([c.id, to]);
      } else if (!to) {
        const u = uncharted.get(key);
        if (u) {
          if (!u.from.includes(c.id)) u.from.push(c.id);
        } else uncharted.set(key, { key, label, from: [c.id], x: 0, y: 0 });
      }
    }
  }

  const starList = [...stars.values()];
  const unchartedList = [...uncharted.values()];
  layout(consts, starList, unchartedList, routes, previous);

  // The figure of a constellation joins its own stars in lesson order. An idea it shares with a
  // course drawn elsewhere gets one line across to it, so the link between courses shows.
  const lines: Sky["lines"] = [];
  for (const c of consts) {
    let last: string | null = null;
    for (const l of c.lessons) {
      for (const key of l.stars) {
        const home = stars.get(key)?.in[0].c === c.id;
        if (home) {
          if (last) lines.push({ c: c.id, a: last, b: key, bridge: false });
          last = key;
        } else if (last) lines.push({ c: c.id, a: last, b: key, bridge: true });
      }
    }
  }

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const grow = (x: number, y: number, pad: number) => {
    x0 = Math.min(x0, x - pad);
    y0 = Math.min(y0, y - pad);
    x1 = Math.max(x1, x + pad);
    y1 = Math.max(y1, y + pad);
  };
  for (const c of consts) {
    grow(c.x - 70, c.y, c.r);
    grow(c.x + 70, c.y, c.r);
  }
  for (const u of unchartedList) grow(u.x, u.y, 40);
  if (!Number.isFinite(x0)) (x0 = -300), (y0 = -200), (x1 = 300), (y1 = 200);

  return { constellations: consts, stars: starList, uncharted: unchartedList, routes, lines, bounds: { x0, y0, x1, y1 } };
}

/** Places the constellations with a small force layout (ones that share ideas or lead to each
 *  other are pulled together), then draws each one's stars around its middle. Deterministic, and
 *  warm-started from the last layout so a new course doesn't reshuffle the sky. */
function layout(consts: Constellation[], stars: Star[], uncharted: Uncharted[], routes: [string, string][], previous?: Map<string, { x: number; y: number }>) {
  const index = new Map(consts.map((c, i) => [c.id, i]));
  consts.forEach((c, i) => {
    const n = c.lessons.reduce((s, l) => s + l.stars.length, 0);
    c.r = c.writing ? 70 : 70 + 22 * Math.sqrt(n);
    const was = previous?.get(c.id);
    // the most read courses start in the middle
    const a = i * 2.39996 + hash(c.id) * 0.3;
    const d = 160 * Math.sqrt(i);
    c.x = was?.x ?? Math.cos(a) * d;
    c.y = was?.y ?? Math.sin(a) * d * 0.7;
  });

  // springs: shared ideas pull hard, a "next topic" route pulls a little
  const springs: [number, number, number][] = [];
  const shared = new Map<string, number>();
  for (const s of stars) {
    const cs = [...new Set(s.in.map((p) => p.c))];
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++) {
        const k = cs[i] < cs[j] ? `${cs[i]}|${cs[j]}` : `${cs[j]}|${cs[i]}`;
        shared.set(k, (shared.get(k) ?? 0) + 1);
      }
  }
  for (const [k, n] of shared) {
    const [a, b] = k.split("|");
    springs.push([index.get(a)!, index.get(b)!, 0.03 * Math.min(3, n)]);
  }
  for (const [a, b] of routes) springs.push([index.get(a)!, index.get(b)!, 0.012]);

  const steps = previous?.size ? 120 : 360;
  const vx = new Float64Array(consts.length);
  const vy = new Float64Array(consts.length);
  for (let step = 0; step < steps; step++) {
    const cool = 1 - step / steps;
    for (let i = 0; i < consts.length; i++) {
      for (let j = i + 1; j < consts.length; j++) {
        const a = consts[i];
        const b = consts[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 1) (dx = hash(a.id + b.id) - 0.5), (dy = 0.5 - hash(b.id)), (d = 1);
        const room = a.r + b.r + 110;
        const push = (room * room * 0.6) / (d * d);
        vx[i] += (dx / d) * push;
        vy[i] += (dy / d) * push;
        vx[j] -= (dx / d) * push;
        vy[j] -= (dy / d) * push;
      }
    }
    for (const [i, j, k] of springs) {
      const a = consts[i];
      const b = consts[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const pull = (d - (a.r + b.r + 30)) * k;
      vx[i] += (dx / d) * pull;
      vy[i] += (dy / d) * pull;
      vx[j] -= (dx / d) * pull;
      vy[j] -= (dy / d) * pull;
    }
    for (let i = 0; i < consts.length; i++) {
      const c = consts[i];
      // a gentle pull to the middle, a little stronger vertically: the sky is wider than tall
      vx[i] -= c.x * 0.0028;
      vy[i] -= c.y * 0.0065;
      c.x += vx[i] * cool;
      c.y += vy[i] * cool;
      vx[i] *= 0.55;
      vy[i] *= 0.55;
    }
  }
  // nothing overlaps
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < consts.length; i++)
      for (let j = i + 1; j < consts.length; j++) {
        const a = consts[i];
        const b = consts[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const min = a.r + b.r + 40;
        if (d < min) {
          const m = (min - d) / 2;
          a.x -= (dx / d) * m;
          a.y -= (dy / d) * m;
          b.x += (dx / d) * m;
          b.y += (dy / d) * m;
          moved = true;
        }
      }
    if (!moved) break;
  }

  // Each constellation's stars: its lessons along an open arc, their ideas clustered at each point.
  const spots = new Map<string, { x: number; y: number }[]>();
  for (const c of consts) {
    const n = c.lessons.length;
    const start = hash(c.id) * Math.PI * 2;
    const arc = n <= 1 ? 0 : Math.min(Math.PI * 1.6, n * 0.75);
    c.lessons.forEach((l, i) => {
      const a = start + (n <= 1 ? 0 : (i / (n - 1)) * arc);
      const rr = n <= 1 ? 0 : c.r * (0.5 + 0.12 * hash(`${c.id}${i}`));
      const ax = c.x + Math.cos(a) * rr;
      const ay = c.y + Math.sin(a) * rr;
      l.stars.forEach((key, j) => {
        const b = j * 2.39996 + hash(key) * 1.2;
        const d = j === 0 && l.stars.length === 1 ? 0 : 16 + 13 * Math.sqrt(j + 1);
        const list = spots.get(key) ?? [];
        list.push({ x: ax + Math.cos(b) * d, y: ay + Math.sin(b) * d });
        spots.set(key, list);
      });
    });
  }
  // an idea taught in several courses stays with the first (the most read), leaning towards the others
  for (const s of stars) {
    const list = spots.get(s.key) ?? [{ x: 0, y: 0 }];
    const mx = list.reduce((t, p) => t + p.x, 0) / list.length;
    const my = list.reduce((t, p) => t + p.y, 0) / list.length;
    s.x = list[0].x + (mx - list[0].x) * 0.25;
    s.y = list[0].y + (my - list[0].y) * 0.25;
  }
  // topics no course covers yet sit just outside the courses that point at them
  const byId = new Map(consts.map((c) => [c.id, c]));
  for (const u of uncharted) {
    const from = u.from.map((id) => byId.get(id)!).filter(Boolean);
    const c = from[0];
    const a = hash(u.key) * Math.PI * 2;
    if (from.length > 1) {
      u.x = from.reduce((t, f) => t + f.x, 0) / from.length + Math.cos(a) * 40;
      u.y = from.reduce((t, f) => t + f.y, 0) / from.length + Math.sin(a) * 40;
    } else {
      u.x = c.x + Math.cos(a) * (c.r + 46);
      u.y = c.y + Math.sin(a) * (c.r + 46);
    }
  }
}

/** Ideas and courses whose words contain the search, ideas first. */
export function searchSky(sky: Sky, query: string) {
  const q = normalise(query);
  if (q.length < 2) return { stars: [] as Star[], constellations: [] as Constellation[] };
  return {
    stars: sky.stars.filter((s) => s.key.includes(q)).slice(0, 6),
    constellations: sky.constellations.filter((c) => normalise(c.title).includes(q) || normalise(c.topic).includes(q)).slice(0, 4),
  };
}

/** What a star looks like to this learner: lit, flickering, fading, or not theirs yet. */
export const lightOf = (s: Pick<Star, "state" | "fading">) =>
  s.state === null ? "dark" : s.fading ? "fading" : s.state === "known" ? "lit" : s.state === "shaky" ? "shaky" : "unread";
