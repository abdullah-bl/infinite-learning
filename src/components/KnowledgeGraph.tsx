import { useEffect, useMemo, useState } from "react";

// A small force layout, run once per map: ideas sit around the courses that teach them, ideas
// taught in two courses end up between them, and next topics sit outside. Deterministic, so the
// map doesn't jump about between visits.

export type State = "known" | "shaky" | "new";
export type GraphInput = {
  courses: { id: string; title: string }[];
  concepts: { key: string; label: string; state: State; where: { course: string }[] }[];
  next: { key: string; label: string; from: string[] }[];
};
export type NodeKind = "course" | "concept" | "next";
type Node = { id: string; kind: NodeKind; label: string; state?: State; x: number; y: number; vx: number; vy: number };

// The canvas: wide on a screen, tall on a phone, so the points get room either way.
const WIDE = { w: 1200, h: 760 };
const TALL = { w: 700, h: 1000 };

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
};

function layout(input: GraphInput, W: number, H: number, rtl: boolean) {
  const nodes: Node[] = [];
  const index = new Map<string, Node>();
  const add = (id: string, kind: NodeKind, label: string, x: number, y: number, state?: State) => {
    const n = { id, kind, label, state, x, y, vx: 0, vy: 0 };
    nodes.push(n);
    index.set(id, n);
    return n;
  };
  const cx = W / 2;
  const cy = H / 2;
  input.courses.forEach((c, i) => {
    const a = (i / Math.max(1, input.courses.length)) * Math.PI * 2 + 0.4;
    const r = input.courses.length === 1 ? 0 : 220;
    add(`c:${c.id}`, "course", c.title, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.75);
  });
  const edges: [Node, Node, number][] = [];
  for (const k of input.concepts) {
    const home = index.get(`c:${k.where[0]?.course}`);
    const a = hash(k.key) * Math.PI * 2;
    const n = add(`k:${k.key}`, "concept", k.label, (home?.x ?? cx) + Math.cos(a) * 90, (home?.y ?? cy) + Math.sin(a) * 90, k.state);
    for (const c of new Set(k.where.map((w) => w.course))) {
      const target = index.get(`c:${c}`);
      if (target) edges.push([n, target, 105]);
    }
  }
  for (const t of input.next) {
    const home = index.get(`c:${t.from[0]}`);
    const a = hash(t.key) * Math.PI * 2;
    const n = add(`n:${t.key}`, "next", t.label, (home?.x ?? cx) + Math.cos(a) * 200, (home?.y ?? cy) + Math.sin(a) * 160);
    for (const c of t.from) {
      const target = index.get(`c:${c}`);
      if (target) edges.push([n, target, 190]);
    }
  }

  // repulsion between every pair, springs along the edges, a pull towards the middle
  for (let step = 0; step < 320; step++) {
    const cool = 1 - step / 320;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          dx = hash(a.id + b.id) - 0.5;
          dy = 0.5 - hash(b.id + a.id);
          d2 = 1;
        }
        const push = (a.kind === "course" || b.kind === "course" ? 9000 : 4500) / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * push;
        a.vy += (dy / d) * push;
        b.vx -= (dx / d) * push;
        b.vy -= (dy / d) * push;
      }
    }
    for (const [a, b, len] of edges) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pull = (d - len) * 0.02;
      a.vx += (dx / d) * pull;
      a.vy += (dy / d) * pull;
      b.vx -= (dx / d) * pull * 0.5;
      b.vy -= (dy / d) * pull * 0.5;
    }
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.0015;
      n.vy += (cy - n.y) * 0.0025;
      n.x += n.vx * cool;
      n.y += n.vy * cool;
      n.vx *= 0.6;
      n.vy *= 0.6;
    }
  }

  // then fit what came out to the canvas, leaving room on the side the labels grow towards
  const start = rtl ? 230 : 70;
  const end = rtl ? 70 : 230;
  const my = 50;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  const sx = x1 > x0 ? (W - start - end) / (x1 - x0) : 1;
  const sy = y1 > y0 ? (H - 2 * my) / (y1 - y0) : 1;
  for (const n of nodes) {
    n.x = x1 > x0 ? start + (n.x - x0) * sx : cx;
    n.y = y1 > y0 ? my + (n.y - y0) * sy : cy;
  }
  return { nodes, edges: edges.map(([a, b]) => [a, b] as const) };
}

type Props = {
  input: GraphInput;
  selected: string | null;
  onSelect: (id: string | null) => void;
  rtl: boolean;
  label: (node: { kind: NodeKind; state?: State; label: string }) => string;
};

export function KnowledgeGraph({ input, selected, onSelect, rtl, label }: Props) {
  const [tall, setTall] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 700px)");
    const on = () => setTall(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const { w: W, h: H } = tall ? TALL : WIDE;
  const { nodes, edges } = useMemo(() => layout(input, W, H, rtl), [input, W, H, rtl]);
  // what is next to the selected point, so the rest can step back
  const near = useMemo(() => {
    if (!selected) return null;
    const out = new Set([selected]);
    for (const [a, b] of edges) {
      if (a.id === selected) out.add(b.id);
      if (b.id === selected) out.add(a.id);
    }
    return out;
  }, [selected, edges]);
  const dim = (id: string) => (near && !near.has(id) ? 0.18 : 1);

  return (
    <svg className="kgraph" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={label({ kind: "course", label: "" })} onClick={() => onSelect(null)}>
      {edges.map(([a, b]) => (
        <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`edge ${b.kind === "course" && a.kind === "next" ? "to-next" : ""}`} opacity={near && !(near.has(a.id) && near.has(b.id)) ? 0.08 : 1} />
      ))}
      {nodes.map((n) => {
        const props = {
          key: n.id,
          className: `node ${n.kind} ${n.state ?? ""} ${selected === n.id ? "on" : ""}`,
          opacity: dim(n.id),
          role: "button",
          tabIndex: 0,
          "aria-label": label(n),
          "aria-pressed": selected === n.id,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onSelect(selected === n.id ? null : n.id);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(selected === n.id ? null : n.id);
            }
          },
        };
        if (n.kind === "course") {
          const text = n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label;
          const w = Math.max(80, text.length * 9.5 + 28);
          return (
            <g {...props} transform={`translate(${n.x} ${n.y})`}>
              <rect x={-w / 2} y={-20} width={w} height={40} />
              <text textAnchor="middle" dy="0.35em" direction={rtl ? "rtl" : "ltr"}>{text}</text>
            </g>
          );
        }
        const side = rtl ? -1 : 1;
        return (
          <g {...props} transform={`translate(${n.x} ${n.y})`}>
            {n.kind === "next" ? <rect x={-8} y={-8} width={16} height={16} /> : <circle r={8} />}
            <text x={side * 14} dy="0.35em" textAnchor="start" direction={rtl ? "rtl" : "ltr"}>
              {n.label.length > 30 ? `${n.label.slice(0, 29)}…` : n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
