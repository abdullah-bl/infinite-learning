import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "onebase/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "~/lib/api";
import { useOwner, useSettings } from "~/lib/device";
import { errorText, useI18n, type Key } from "~/lib/i18n";
import { normalise } from "../../onebase/lib/topic";
import { buildSky, lightOf, searchSky, type AtlasCourse, type Constellation, type MyMap, type Sky } from "~/lib/sky";
import { courseLanguage, useStartCourse } from "./useStartCourse";

type Sel = { t: "c" | "s" | "u"; id: string } | null;
type Cam = { x: number; y: number; k: number };

const LIT_KEY = "il.lit";
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Splits a title into at most two lines of about 18 characters, for the middle of a constellation. */
function twoLines(title: string) {
  const words = title.split(/\s+/);
  if (title.length <= 20 || words.length < 2) return [title.length > 30 ? `${title.slice(0, 29)}…` : title];
  let a = words[0];
  let i = 1;
  while (i < words.length && (a + " " + words[i]).trim().length <= Math.max(14, title.length / 2 + 2)) a = (a + " " + words[i++]).trim();
  let b = words.slice(i).join(" ");
  if (b.length > 22) b = `${b.slice(0, 21)}…`;
  return b ? [a, b] : [a];
}

/**
 * Every course written here as a constellation and every key idea as a star, with the visitor's
 * own stars lit. Drag to move, scroll or pinch to zoom, tap anything to read about it.
 * `embedded`: inside a page, so a plain scroll still scrolls the page and one finger still
 * scrolls on a phone; zoom with ctrl + scroll, a trackpad pinch, or two fingers.
 */
export function SkyExplorer({ embedded = false }: { embedded?: boolean }) {
  const { t, lang, dir } = useI18n();
  const owner = useOwner();
  const settings = useSettings();
  const language = courseLanguage(settings, lang);
  const [opened] = useState(() => Date.now());
  const atlas = useQuery(api.graph.atlas, { language }) as AtlasCourse[] | undefined;
  const mine = useQuery(api.graph.mine, owner ? { owner, now: opened } : "skip") as (MyMap & { waiting: number }) | undefined;
  const fill = useMutation(api.graph.fill);
  const rtl = dir === "rtl";

  // older courses don't carry their key ideas yet: ask for a few each visit
  const waiting = mine?.waiting ?? 0;
  useEffect(() => {
    if (owner && waiting > 0) void fill({ owner }).catch(() => {});
  }, [owner, waiting, fill]);

  // where each constellation was last time, so the sky stays where the learner left it
  const placeKey = `il.sky.${language}`;
  const previous = useRef<Map<string, { x: number; y: number }> | undefined>(undefined);
  if (previous.current === undefined && typeof localStorage !== "undefined") {
    try {
      const saved = JSON.parse(localStorage.getItem(placeKey) ?? "null") as [string, { x: number; y: number }][] | null;
      if (Array.isArray(saved)) previous.current = new Map(saved);
    } catch {}
  }
  const ready = atlas !== undefined && (owner === null || mine !== undefined);
  const sky = useMemo(() => (ready ? buildSky(atlas!, mine ?? null, previous.current) : null), [ready, atlas, mine]);
  useEffect(() => {
    if (!sky) return;
    previous.current = new Map(sky.constellations.map((c) => [c.id, { x: Math.round(c.x), y: Math.round(c.y) }]));
    try {
      localStorage.setItem(placeKey, JSON.stringify([...previous.current]));
    } catch {}
  }, [sky, placeKey]);

  // stars lit since the last visit get to light up in front of the learner
  const [ignite, setIgnite] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!sky || !mine) return;
    const lit = sky.stars.filter((s) => lightOf(s) === "lit").map((s) => s.key);
    let before: string[] | null = null;
    try {
      before = JSON.parse(localStorage.getItem(LIT_KEY) ?? "null");
    } catch {}
    if (Array.isArray(before)) {
      const was = new Set(before);
      const fresh = lit.filter((k) => !was.has(k));
      if (fresh.length) setIgnite((old) => new Set([...old, ...fresh]));
    }
    try {
      localStorage.setItem(LIT_KEY, JSON.stringify(lit));
    } catch {}
  }, [sky, mine]);

  if (!sky) {
    return (
      <div className={`sky ${embedded ? "embedded" : "full"}`} data-ui>
        <div className="sky-stage"><p className="sky-wait lead" role="status">{t("sky.loading")}<span className="dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p></div>
      </div>
    );
  }
  return <Explorer sky={sky} mine={mine ?? null} embedded={embedded} rtl={rtl} ignite={ignite} />;
}

function Explorer({ sky, mine, embedded, rtl, ignite }: { sky: Sky; mine: MyMap | null; embedded: boolean; rtl: boolean; ignite: Set<string> }) {
  const { t } = useI18n();
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const world = useRef<SVGGElement>(null);
  const cam = useRef<Cam>({ x: 0, y: 0, k: 1 });
  const fitK = useRef(1);
  const anim = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [sel, setSel] = useState<Sel>(null);
  const [query, setQuery] = useState("");
  const [lens, setLens] = useState<"all" | "mine">("all");
  const [hint, setHint] = useState(false);

  const consts = useMemo(() => new Map(sky.constellations.map((c) => [c.id, c])), [sky]);
  const stars = useMemo(() => new Map(sky.stars.map((s) => [s.key, s])), [sky]);
  const hasMine = sky.constellations.some((c) => c.mine);
  const wide = size.w >= 900;
  // the panel covers the end of the stage; the camera frames what is left
  const panel = wide ? Math.min(400, size.w * 0.34 - 32) + 32 : 0;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // the camera moves the world directly, without React, so dragging stays smooth
  const apply = useCallback(() => {
    const { x, y, k } = cam.current;
    world.current?.setAttribute("transform", `translate(${x} ${y}) scale(${k})`);
    const s = svg.current;
    if (!s) return;
    s.style.setProperty("--ik", String(1 / k));
    s.style.setProperty("--sk", String(Math.pow(k, -0.6)));
    s.dataset.z = k >= 1.25 ? "2" : k >= 0.6 ? "1" : "0";
  }, []);

  // Names that would overlap a more important one step back, the way a map thins its labels:
  // the picked thing first, then what it touches, then the learner's own, then the most read.
  const declutterAt = useRef(0);
  const declutter = useCallback(() => {
    const s = svg.current;
    if (!s) return;
    const { x, y, k } = cam.current;
    const z = s.dataset.z;
    const boxes: { el: Element; x0: number; y0: number; x1: number; y1: number; p: number }[] = [];
    for (const el of s.querySelectorAll(".const, .star, .u")) {
      const isConst = el.classList.contains("const");
      const shown = isConst || z === "2" || (z === "1" && (el.matches(".lit, .shaky, .fading, .u")));
      if (!shown && !el.matches(".on, .hl")) {
        el.classList.remove("crowded");
        continue;
      }
      const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(el.getAttribute("transform") ?? "");
      if (!m) continue;
      const sx = x + Number(m[1]) * k;
      const sy = y + Number(m[2]) * k;
      const text = el.querySelector("text")?.textContent ?? "";
      if (isConst) {
        const lines = el.querySelectorAll("tspan").length || 1;
        const w = Math.min(text.length, lines > 1 ? Math.ceil(text.length / 2) + 2 : text.length) * 8.6;
        boxes.push({ el, x0: sx - w / 2, x1: sx + w / 2, y0: sy - 16, y1: sy - 16 + lines * 19, p: el.matches(".on") ? 4 : el.matches(".hl") ? 3 : el.matches(".mine") ? 2 : 1 });
      } else {
        const w = Math.min(34, text.length) * 6.8 + 12;
        const start = rtl ? sx - w : sx;
        boxes.push({ el, x0: start, x1: start + w, y0: sy - 8, y1: sy + 8, p: el.matches(".on") ? 4 : el.matches(".hl") ? 2.5 : el.matches(".lit, .shaky, .fading") ? 1.5 : 0.5 });
      }
    }
    // stable: equal priorities keep the sky's own order (the most read courses come first)
    const order = boxes.map((b, i) => ({ b, i })).sort((a, z2) => z2.b.p - a.b.p || a.i - z2.i);
    const kept: typeof boxes = [];
    for (const { b } of order) {
      const hit = kept.some((o) => b.x0 < o.x1 + 4 && b.x1 + 4 > o.x0 && b.y0 < o.y1 + 2 && b.y1 + 2 > o.y0);
      b.el.classList.toggle("crowded", hit);
      if (!hit) kept.push(b);
    }
  }, [rtl]);
  const settle = useCallback(() => {
    clearTimeout(declutterAt.current);
    declutterAt.current = window.setTimeout(declutter, 120);
  }, [declutter]);

  const fly = useCallback(
    (to: Cam, ms = 700) => {
      cancelAnimationFrame(anim.current);
      if (reduced() || ms === 0) {
        cam.current = to;
        apply();
        settle();
        return;
      }
      const from = { ...cam.current };
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - p, 4);
        // zoom in log space, so a big zoom doesn't rush at the end
        const k = Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e);
        // keep the target point travelling in a straight line on screen
        const cx = (size.w / 2 - from.x) / from.k + ((size.w / 2 - to.x) / to.k - (size.w / 2 - from.x) / from.k) * e;
        const cy = (size.h / 2 - from.y) / from.k + ((size.h / 2 - to.y) / to.k - (size.h / 2 - from.y) / from.k) * e;
        cam.current = { k, x: size.w / 2 - cx * k, y: size.h / 2 - cy * k };
        apply();
        if (p < 1) anim.current = requestAnimationFrame(step);
        else settle();
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply, settle, size.w, size.h],
  );

  /** The camera that shows a box of the world in the part of the stage the panel doesn't cover. */
  const frame = useCallback(
    (b: { x0: number; y0: number; x1: number; y1: number }, pad = 48, maxK = 2.4): Cam => {
      const aw = size.w - panel;
      const ax = rtl ? panel : 0;
      const k = Math.max(0.08, Math.min(maxK, (aw - pad * 2) / Math.max(1, b.x1 - b.x0), (size.h - pad * 2) / Math.max(1, b.y1 - b.y0)));
      return { k, x: ax + aw / 2 - ((b.x0 + b.x1) / 2) * k, y: size.h / 2 - ((b.y0 + b.y1) / 2) * k };
    },
    [size.w, size.h, panel, rtl],
  );

  const mineBounds = useMemo(() => {
    const own = sky.constellations.filter((c) => c.mine);
    if (!own.length) return sky.bounds;
    return {
      x0: Math.min(...own.map((c) => c.x - c.r)),
      y0: Math.min(...own.map((c) => c.y - c.r)),
      x1: Math.max(...own.map((c) => c.x + c.r)),
      y1: Math.max(...own.map((c) => c.y + c.r)),
    };
  }, [sky]);

  const fitAll = useCallback(
    (ms = 700) => {
      const c = frame(lens === "mine" ? mineBounds : sky.bounds, 48, 1.6);
      fitK.current = Math.min(c.k, 1);
      fly(c, ms);
    },
    [frame, fly, lens, mineBounds, sky.bounds],
  );

  // first sight: a little further out, then settle onto the whole sky
  const placed = useRef(false);
  useEffect(() => {
    if (!size.w || !size.h) return;
    if (!placed.current) {
      placed.current = true;
      let c = frame(sky.bounds, 48, 1.6);
      fitK.current = Math.min(c.k, 1);
      // on a small screen the whole sky is too small to read: start closer, where it's busiest
      if (c.k < 0.5 && sky.constellations.length) {
        const b = hasMine ? mineBounds : (() => {
          const top = sky.constellations[0];
          return { x0: top.x - top.r * 2.2, y0: top.y - top.r * 2.2, x1: top.x + top.r * 2.2, y1: top.y + top.r * 2.2 };
        })();
        c = frame(b, 24, 0.7);
        c = c.k < 0.5 ? frame({ x0: (b.x0 + b.x1) / 2 - 1, y0: (b.y0 + b.y1) / 2 - 1, x1: (b.x0 + b.x1) / 2 + 1, y1: (b.y0 + b.y1) / 2 + 1 }, 0, 0.5) : c;
      }
      cam.current = { k: c.k * 0.82, x: c.x + (size.w / 2 - c.x) * 0.18, y: c.y + (size.h / 2 - c.y) * 0.18 };
      apply();
      fly(c, 1400);
    } else if (sel) select(sel);
    else fitAll(400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);
  useEffect(() => {
    if (placed.current) fitAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens]);

  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const { x, y, k } = cam.current;
      const nk = Math.max(fitK.current * 0.5, Math.min(4, k * factor));
      cam.current = { k: nk, x: px - ((px - x) / k) * nk, y: py - ((py - y) / k) * nk };
      apply();
      settle();
    },
    [apply, settle],
  );

  const select = useCallback(
    (next: Sel) => {
      setSel(next);
      if (!next) return;
      if (next.t === "c") {
        const c = consts.get(next.id);
        if (c) fly(frame({ x0: c.x - c.r - 30, y0: c.y - c.r - 30, x1: c.x + c.r + 30, y1: c.y + c.r + 30 }, 40, 2.2));
      } else {
        const p = next.t === "s" ? stars.get(next.id) : sky.uncharted.find((u) => u.key === next.id);
        if (p) {
          const k = Math.max(cam.current.k, 1.5);
          fly(frame({ x0: p.x - 1, y0: p.y - 1, x1: p.x + 1, y1: p.y + 1 }, 0, k));
        }
      }
    },
    [consts, stars, sky.uncharted, fly, frame],
  );

  // pointers: drag to pan, two fingers to pinch, a tap to pick
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let moved = false;
    let downAt: { x: number; y: number } | null = null;
    let pinch: { d: number; k: number } | null = null;
    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      cancelAnimationFrame(anim.current);
      pts.set(e.pointerId, local(e));
      downAt = local(e);
      moved = false;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: cam.current.k };
      }
    };
    const move = (e: PointerEvent) => {
      const was = pts.get(e.pointerId);
      if (!was) return;
      const p = local(e);
      // inside a page, one finger scrolls the page as usual
      if (embedded && e.pointerType === "touch" && pts.size === 1) return;
      if (!moved && downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) < 5) return;
      if (!moved) {
        moved = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add("grabbing");
      }
      if (pts.size === 2 && pinch) {
        pts.set(e.pointerId, p);
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        zoomAt((pinch.k * d) / pinch.d / cam.current.k, mid.x, mid.y);
        cam.current.x += (p.x - was.x) / 2;
        cam.current.y += (p.y - was.y) / 2;
      } else {
        cam.current.x += p.x - was.x;
        cam.current.y += p.y - was.y;
        pts.set(e.pointerId, p);
      }
      apply();
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      el.classList.remove("grabbing");
      if (!moved && pts.size === 0 && e.type === "pointerup") {
        const hit = (e.target as Element).closest?.("[data-id]");
        const id = hit?.getAttribute("data-id");
        if (id) {
          const [kind, ...rest] = id.split(":");
          select({ t: kind as "c" | "s" | "u", id: rest.join(":") });
        } else select(null);
      }
    };
    const wheel = (e: WheelEvent) => {
      if (embedded && !e.ctrlKey && !e.metaKey) {
        setHint(true);
        return;
      }
      e.preventDefault();
      const p = local(e);
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [apply, zoomAt, select, embedded]);

  useEffect(() => {
    if (!hint) return;
    const id = setTimeout(() => setHint(false), 1800);
    return () => clearTimeout(id);
  }, [hint]);

  const keys = (e: React.KeyboardEvent) => {
    const step = 80;
    const c = cam.current;
    const mid = { x: size.w / 2, y: size.h / 2 };
    if (e.key === "ArrowLeft") c.x += step;
    else if (e.key === "ArrowRight") c.x -= step;
    else if (e.key === "ArrowUp") c.y += step;
    else if (e.key === "ArrowDown") c.y -= step;
    else if (e.key === "+" || e.key === "=") return e.preventDefault(), zoomAt(1.3, mid.x, mid.y);
    else if (e.key === "-") return e.preventDefault(), zoomAt(1 / 1.3, mid.x, mid.y);
    else if (e.key === "0") return e.preventDefault(), fitAll();
    else if (e.key === "Escape") return select(null);
    else return;
    e.preventDefault();
    apply();
  };

  // what to bring forward: the picked thing and what it touches, or what the search finds
  const found = useMemo(() => searchSky(sky, query), [sky, query]);
  const focus = useMemo(() => {
    const out = new Set<string>();
    if (sel?.t === "c") {
      const c = consts.get(sel.id);
      out.add(`c:${sel.id}`);
      c?.lessons.forEach((l) => l.stars.forEach((k) => out.add(`s:${k}`)));
      sky.uncharted.forEach((u) => u.from.includes(sel.id) && out.add(`u:${u.key}`));
      sky.routes.forEach(([a, b]) => (a === sel.id ? out.add(`c:${b}`) : b === sel.id && out.add(`c:${a}`)));
    } else if (sel?.t === "s") {
      out.add(`s:${sel.id}`);
      stars.get(sel.id)?.in.forEach((p) => out.add(`c:${p.c}`));
    } else if (sel?.t === "u") {
      out.add(`u:${sel.id}`);
      sky.uncharted.find((u) => u.key === sel.id)?.from.forEach((c) => out.add(`c:${c}`));
    } else if (query.trim().length >= 2) {
      found.stars.forEach((s) => out.add(`s:${s.key}`));
      found.constellations.forEach((c) => out.add(`c:${c.id}`));
    } else if (lens === "mine") {
      sky.constellations.forEach((c) => c.mine && out.add(`c:${c.id}`));
      sky.stars.forEach((s) => s.state && out.add(`s:${s.key}`));
    }
    return out.size ? out : null;
  }, [sel, query, found, lens, sky, consts, stars]);
  const on = (id: string) => (focus?.has(id) ? " hl" : "");
  useEffect(() => settle(), [focus, sel, settle, sky]);
  const order = useMemo(() => new Map(sky.constellations.map((c, i) => [c.id, i])), [sky]);

  const below = useRef<HTMLDivElement>(null);
  const picked = sel?.t === "c" ? consts.get(sel.id)?.title : sel?.t === "s" ? stars.get(sel.id)?.label : sel?.t === "u" ? sky.uncharted.find((u) => u.key === sel.id)?.label : null;

  const nodeLabel = (c: Constellation) => `${c.title}${c.mine ? `, ${t("sky.yours")}` : ""}`;

  return (
    <div className={`sky ${embedded ? "embedded" : "full"}`} dir={rtl ? "rtl" : "ltr"} data-ui>
      <div className="sky-stage" ref={wrap}>
        <svg
          ref={svg}
          className={`sky-svg${focus ? " dim" : ""}`}
          data-z="0"
          tabIndex={0}
          role="application"
          aria-label={t(embedded ? "sky.aria_page" : "sky.aria")}
          aria-describedby="sky-keys"
          onKeyDown={keys}
          width={size.w}
          height={size.h}
        >
          <g ref={world}>
            <g className="routes">
              {sky.routes.map(([a, b]) => {
                const ca = consts.get(a)!;
                const cb = consts.get(b)!;
                return <line key={`${a}>${b}`} className={`route${focus?.has(`c:${a}`) && focus?.has(`c:${b}`) ? " hl" : ""}`} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} />;
              })}
            </g>
            {sky.constellations.map((c) => (
              <circle key={`h${c.id}`} className="hit" data-id={`c:${c.id}`} cx={c.x} cy={c.y} r={c.r} />
            ))}
            <g className="figures">
              {sky.lines.map((l, i) => {
                const a = stars.get(l.a)!;
                const b = stars.get(l.b)!;
                const mine = !!consts.get(l.c)?.mine;
                return <line key={i} className={`fig${mine ? " mine" : ""}${l.bridge ? " bridge" : ""}${on(`c:${l.c}`)}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
              })}
            </g>
            {sky.uncharted.map((u) => (
              <g key={u.key} className={`u${on(`u:${u.key}`)}${sel?.t === "u" && sel.id === u.key ? " on" : ""}`} data-id={`u:${u.key}`} transform={`translate(${u.x} ${u.y})`}>
                <g className="mk"><rect x={-5} y={-5} width={10} height={10} /><circle className="pad" r={12} /></g>
                <g className="lb"><text x={rtl ? -12 : 12} dy="0.35em" direction={rtl ? "rtl" : "ltr"}>{u.label}</text></g>
              </g>
            ))}
            {sky.stars.map((s) => {
              const light = lightOf(s);
              const r = light === "dark" ? 2.2 : light === "unread" ? 3 : 4;
              return (
                <g
                  key={s.key}
                  className={`star ${light}${on(`s:${s.key}`)}${sel?.t === "s" && sel.id === s.key ? " on" : ""}${ignite.has(s.key) ? " ignite" : ""}`}
                  data-id={`s:${s.key}`}
                  transform={`translate(${s.x} ${s.y})`}
                  style={{ ["--i" as string]: order.get(s.in[0]?.c) ?? 0 }}
                >
                  <g className="mk">
                    {ignite.has(s.key) && <circle className="ring" r={r} />}
                    <circle className="dot" r={r} />
                    <circle className="pad" r={11} />
                  </g>
                  <g className="lb"><text x={rtl ? -10 : 10} dy="0.35em" direction={rtl ? "rtl" : "ltr"}>{s.label.length > 34 ? `${s.label.slice(0, 33)}…` : s.label}</text></g>
                </g>
              );
            })}
            {sky.constellations.map((c, i) => {
              const lines = twoLines(c.title);
              return (
                <g
                  key={c.id}
                  className={`const${c.mine ? " mine" : ""}${c.writing ? " writing" : ""}${on(`c:${c.id}`)}${sel?.t === "c" && sel.id === c.id ? " on" : ""}`}
                  data-id={`c:${c.id}`}
                  transform={`translate(${c.x} ${c.y})`}
                  style={{ ["--i" as string]: i }}
                  tabIndex={0}
                  role="button"
                  aria-label={nodeLabel(c)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      select({ t: "c", id: c.id });
                    }
                  }}
                >
                  {c.writing && <g className="mk"><circle className="pulse" r={14} /><circle className="core" r={6} /></g>}
                  <g className="lb">
                    <text textAnchor="middle" direction={rtl ? "rtl" : "ltr"} y={c.writing ? 30 : lines.length > 1 ? -4 : 6}>
                      {lines.map((l, j) => (
                        <tspan key={j} x={0} dy={j ? "1.1em" : 0}>{l}</tspan>
                      ))}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="sky-tools">
          {hasMine && (
            <div className="sky-lens" role="group" aria-label={t("sky.lens")}>
              {(["all", "mine"] as const).map((l) => (
                <button key={l} aria-pressed={lens === l} onClick={() => (setSel(null), setLens(l))}>{t(`sky.lens.${l}` as Key)}</button>
              ))}
            </div>
          )}
          <div className="sky-zoom">
            <button aria-label={t("sky.zoom_in")} onClick={() => zoomAt(1.4, size.w / 2, size.h / 2)}>+</button>
            <button aria-label={t("sky.zoom_out")} onClick={() => zoomAt(1 / 1.4, size.w / 2, size.h / 2)}>−</button>
            <button className="fit" onClick={() => (setSel(null), fitAll())}>{t("sky.fit")}</button>
          </div>
        </div>
        <p id="sky-keys" className="sr">{t("sky.keys")}</p>
        <p className={`sky-hint small${hint ? " show" : ""}`} aria-hidden="true">{t("sky.hint_ctrl")}</p>

        {!wide && picked && (
          <div className="sky-peek">
            <strong dir="auto">{picked}</strong>
            <button className="btn ink" onClick={() => below.current?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" })}>{t("sky.more")}</button>
          </div>
        )}
        {wide && <Panel sky={sky} mine={mine} sel={sel} select={select} query={query} setQuery={setQuery} found={found} ignite={ignite} />}
      </div>
      {!wide && <div ref={below}><Panel sky={sky} mine={mine} sel={sel} select={select} query={query} setQuery={setQuery} found={found} ignite={ignite} /></div>}
    </div>
  );
}

type PanelProps = {
  sky: Sky;
  mine: MyMap | null;
  sel: Sel;
  select: (s: Sel) => void;
  query: string;
  setQuery: (q: string) => void;
  found: ReturnType<typeof searchSky>;
  ignite: Set<string>;
};

/** Beside the sky: what is picked, and where to go with it. With nothing picked, the whole sky. */
function Panel(props: PanelProps) {
  const { sel } = props;
  return (
    <aside className="sky-panel" aria-live="polite">
      {sel?.t === "c" ? <CourseCard {...props} id={sel.id} /> : sel?.t === "s" ? <StarCard {...props} id={sel.id} /> : sel?.t === "u" ? <UnchartedCard {...props} id={sel.id} /> : <Overview {...props} />}
    </aside>
  );
}

/** Opens a course: the learner's own copy, or a fresh copy of a shared one, at a lesson if given. */
function useOpen() {
  const { t } = useI18n();
  const owner = useOwner();
  const adopt = useMutation(api.library.adopt);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function open(c: Constellation, lesson?: number) {
    const hash = lesson === undefined ? undefined : `lesson-${lesson + 1}`;
    if (c.mine) return navigate({ to: "/course/$courseId", params: { courseId: c.mine }, hash });
    if (!owner || busy) return;
    setBusy(c.id);
    setError(null);
    try {
      const id = await adopt({ owner, id: c.id.slice(2) as never });
      if (id) await navigate({ to: "/course/$courseId", params: { courseId: id }, hash });
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(null);
    }
  }
  return { open, busy, error };
}

function Back({ select }: { select: PanelProps["select"] }) {
  const { t } = useI18n();
  return <button className="link back" onClick={() => select(null)}>{t("sky.back")}</button>;
}

function Overview({ sky, select, query, setQuery, found, ignite }: PanelProps) {
  const { t } = useI18n();
  const { start, busy, error } = useStartCourse();
  const lit = sky.stars.filter((s) => lightOf(s) === "lit").length;
  const fading = sky.stars.filter((s) => s.fading).length;
  const shaky = sky.stars.filter((s) => lightOf(s) === "shaky").length;
  const owned = sky.stars.filter((s) => s.state).length;
  const searching = query.trim().length >= 2;
  const nothing = searching && found.stars.length === 0 && found.constellations.length === 0;
  const popular = sky.constellations.filter((c) => !c.writing).slice(0, 5);

  return (
    <div className="card overview">
      <h3 className="count">{t("sky.count", { courses: sky.constellations.filter((c) => !c.writing).length, stars: sky.stars.length })}</h3>
      {owned > 0 ? (
        <p>{t("sky.lit", { lit, all: owned })}{shaky > 0 && ` ${t("sky.shaky_n", { n: shaky })}`}</p>
      ) : (
        <p>{t("sky.lit0")}</p>
      )}
      <ul className="sky-legend" aria-label={t("map.legend")}>
        {(["lit", "shaky", "fading", "dark", "uncharted"] as const).map((l) => (
          <li key={l}><span className={`sw ${l}`} aria-hidden="true" />{t(`sky.l.${l}` as Key)}</li>
        ))}
      </ul>
      {ignite.size > 0 && <p className="news">{ignite.size === 1 ? t("sky.new_lit1") : t("sky.new_lit", { n: ignite.size })}</p>}
      {fading > 0 && (
        <p className="fade-row">
          <span>{fading === 1 ? t("sky.fading1") : t("sky.fading", { n: fading })}</span>
          <Link to="/review" className="btn">{t("sky.relight")}</Link>
        </p>
      )}

      <form className="sky-search" role="search" onSubmit={(e) => {
        e.preventDefault();
        const first = found.stars[0] ? { t: "s" as const, id: found.stars[0].key } : found.constellations[0] ? { t: "c" as const, id: found.constellations[0].id } : null;
        if (first) select(first);
        else if (nothing) void start(query.trim());
      }}>
        <label htmlFor="sky-q" className="small">{t("sky.search")}</label>
        <input id="sky-q" type="search" dir="auto" value={query} placeholder={t("sky.search_ph")} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </form>

      {searching && !nothing && (
        <ul className="results">
          {found.constellations.map((c) => (
            <li key={c.id}><button className="row-btn" dir="auto" onClick={() => select({ t: "c", id: c.id })}><span className="sw c" aria-hidden="true" />{c.title}</button></li>
          ))}
          {found.stars.map((s) => (
            <li key={s.key}><button className="row-btn" dir="auto" onClick={() => select({ t: "s", id: s.key })}><span className={`sw ${lightOf(s)}`} aria-hidden="true" />{s.label}</button></li>
          ))}
        </ul>
      )}
      {nothing && (
        <div className="none">
          <p>{t("sky.none", { q: query.trim() })}</p>
          <button className="btn" disabled={busy} onClick={() => void start(query.trim())}>{busy ? t("form.busy") : t("sky.write")}</button>
          {error && <p className="small" role="alert">{error}</p>}
        </div>
      )}

      {!searching && popular.length > 0 && (
        <div className="popular">
          <h4 className="small">{t("sky.popular")}</h4>
          <ul>
            {popular.map((c) => (
              <li key={c.id}><button className="row-btn" dir="auto" onClick={() => select({ t: "c", id: c.id })}>{c.title}</button></li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

function CourseCard({ sky, select, id }: PanelProps & { id: string }) {
  const { t } = useI18n();
  const { open, busy, error } = useOpen();
  const { start, busy: starting } = useStartCourse();
  const c = sky.constellations.find((x) => x.id === id);
  if (!c) return <Back select={select} />;
  const stars = new Map(sky.stars.map((s) => [s.key, s]));
  const leads = c.next.map((label) => {
    const key = normalise(label);
    const to = sky.constellations.find((x) => x.id !== c.id && (normalise(x.title) === key || normalise(x.topic) === key));
    const u = sky.uncharted.find((x) => x.key === key);
    return { label, to, u };
  });

  if (c.writing) {
    return (
      <div className="card">
        <Back select={select} />
        <p className="small">{t("sky.c.writing")}</p>
        <h3 dir="auto">{c.title}</h3>
        <Link className="btn" to="/course/$courseId" params={{ courseId: c.mine! }}>{t("sky.c.watch")}</Link>
      </div>
    );
  }
  return (
    <div className="card course">
      <Back select={select} />
      <h3 dir="auto">{c.title}</h3>
      {c.description && <p dir="auto">{c.description}</p>}
      <p className="small meta">
        {t("sky.c.meta", { lessons: c.lessons.length || c.total, level: c.level ? t(`level.${c.level}` as Key) : "" }).replace(/ · $/, "")}
        {!c.mine && c.uses > 1 && ` · ${t("sky.c.uses", { n: c.uses })}`}
      </p>
      {c.mine && <p className="yours">{t("sky.c.yours", { done: c.done, total: c.total })}</p>}
      <p>
        <button className="btn" disabled={busy === c.id} onClick={() => void open(c)}>
          {busy === c.id ? t("form.busy") : c.mine ? t("sky.c.open") : t("sky.c.open_new")}
        </button>
      </p>
      {error && <p className="small" role="alert">{error}</p>}
      <ol className="lessons">
        {c.lessons.map((l, i) => (
          <li key={i}>
            <button className="link lesson-t" dir="auto" onClick={() => void open(c, i)}>{l.title}</button>
            <span className="chips">
              {l.stars.map((k) => {
                const s = stars.get(k);
                return s ? (
                  <button key={k} className={`chip ${lightOf(s)}`} dir="auto" onClick={() => select({ t: "s", id: k })}>{s.label}</button>
                ) : null;
              })}
            </span>
          </li>
        ))}
      </ol>
      {leads.length > 0 && (
        <div className="leads">
          <h4 className="small">{t("sky.c.leads")}</h4>
          <ul>
            {leads.map(({ label, to, u }) => (
              <li key={label}>
                {to ? (
                  <button className="row-btn" dir="auto" onClick={() => select({ t: "c", id: to.id })}><span className="sw c" aria-hidden="true" />{to.title}</button>
                ) : u ? (
                  <button className="row-btn" dir="auto" onClick={() => select({ t: "u", id: u.key })}><span className="sw uncharted" aria-hidden="true" />{label}</button>
                ) : (
                  <button className="row-btn" dir="auto" disabled={starting} onClick={() => void start(label)}><span className="sw uncharted" aria-hidden="true" />{label}</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StarCard({ sky, select, id }: PanelProps & { id: string }) {
  const { t } = useI18n();
  const { open, busy, error } = useOpen();
  const s = sky.stars.find((x) => x.key === id);
  if (!s) return <Back select={select} />;
  const light = lightOf(s);
  const places = s.in.map((p) => ({ c: sky.constellations.find((c) => c.id === p.c)!, lesson: p.lesson })).filter((p) => p.c);
  // the learner's own course first: that's where their progress is
  places.sort((a, b) => Number(!!b.c.mine) - Number(!!a.c.mine));
  const first = places[0];
  return (
    <div className={`card star-card ${light}`}>
      <Back select={select} />
      <p className="state"><span className={`sw ${light}`} aria-hidden="true" />{t(`sky.s.${light}` as Key)}</p>
      <h3 dir="auto">{s.label}</h3>
      {s.fading ? (
        <p><Link to="/review" className="btn">{t("sky.s.review")}</Link></p>
      ) : (
        light !== "lit" && first && (
          <p>
            <button className="btn" disabled={busy === first.c.id} onClick={() => void open(first.c, first.lesson)}>
              {busy === first.c.id ? t("form.busy") : light === "shaky" ? t("sky.s.reread") : t("sky.s.read")}
            </button>
          </p>
        )
      )}
      {error && <p className="small" role="alert">{error}</p>}
      <h4 className="small">{t("sky.s.in")}</h4>
      <ul className="places">
        {places.map(({ c, lesson }) => (
          <li key={`${c.id}-${lesson}`}>
            <button className="row-btn" dir="auto" onClick={() => select({ t: "c", id: c.id })}>
              <span className="sw c" aria-hidden="true" />
              <span>
                <strong>{c.title}</strong>
                <span className="small">{t("sky.s.lesson", { i: lesson + 1, title: c.lessons[lesson]?.title ?? "" })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UnchartedCard({ sky, select, id }: PanelProps & { id: string }) {
  const { t, lang } = useI18n();
  const { start, busy, error } = useStartCourse();
  const u = sky.uncharted.find((x) => x.key === id);
  if (!u) return <Back select={select} />;
  const from = u.from.map((c) => sky.constellations.find((x) => x.id === c)).filter((c): c is Constellation => !!c);
  return (
    <div className="card uncharted-card">
      <Back select={select} />
      <p className="state"><span className="sw uncharted" aria-hidden="true" />{t("sky.u.h")}</p>
      <h3 dir="auto">{u.label}</h3>
      <p>{t("sky.u.d", { from: from.map((c) => (lang === "ar" ? `«${c.title}»` : `“${c.title}”`)).join(lang === "ar" ? "، " : ", ") })}</p>
      <p><button className="btn" disabled={busy} onClick={() => void start(u.label)}>{busy ? t("form.busy") : t("sky.write")}</button></p>
      {error && <p className="small" role="alert">{error}</p>}
      <ul className="places">
        {from.map((c) => (
          <li key={c.id}><button className="row-btn" dir="auto" onClick={() => select({ t: "c", id: c.id })}><span className="sw c" aria-hidden="true" />{c.title}</button></li>
        ))}
      </ul>
    </div>
  );
}

