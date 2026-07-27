"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/* ── Paper cards ─────────────────────────────────────────────────────────────
   Big rectangles facing the viewer, tilted ~15° left. On momentum scroll they
   ride up from the upper-left, GROW to full size by screen-centre, then glide
   off the bottom without shrinking. Two under-damped oscillators, driven by
   scroll velocity, lean and flutter each card like a sheet of paper waved
   through the air — and wobble to a soft settle when the scroll stops. */

type Card = { title: string; from: string; to: string };
const CARDS: Card[] = [
  { title: "northern drift", from: "#3f6f8f", to: "#12324a" },
  { title: "amber coast", from: "#e8a15a", to: "#8a4a24" },
  { title: "violet mile", from: "#8a6fb0", to: "#3d2a63" },
  { title: "sea glass", from: "#6fb0a0", to: "#25574c" },
  { title: "rose dune", from: "#e096a6", to: "#8a3f56" },
  { title: "slate noon", from: "#8fa2b0", to: "#3c4b58" },
  { title: "gold field", from: "#e6c467", to: "#8f6f24" },
  { title: "ink harbor", from: "#4a5a78", to: "#161d2e" },
];
const N = CARDS.length;

const VIS = 1.7; // journey units on screen — big cards, so only a couple
const FOCAL = 0.5; // t at screen-centre → full size here
const TILT = -15; // degrees left

const FRICTION = 0.94;
const WHEEL_K = 0.00024;
const DRAG_K = 0.0021;
const VEL_MAX = 0.05;

// paper flutter
const WAVE_K = 150; // scroll velocity → lean target
const WAVE_MAX = 6;
const WAVE_AMP = 1.0; // per-card degrees multiplier

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const wrap = (i: number, pos: number) => {
  const raw = i - pos;
  return raw - N * Math.round(raw / N);
};
const bez = (t: number, a: number, b: number, c: number) =>
  (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

// per-card flutter coefficients — each sheet catches the air differently
function makeCoeff() {
  let s = 0x1234;
  const r = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 9) & 0xffff) / 0x8000 - 1; // [-1,1]
  };
  return CARDS.map(() => ({ ax: r(), ay: r(), bx: r(), by: r(), az: r() }));
}

export function PaperCards({ previewPos }: { previewPos?: number }) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  const pos = useRef(previewPos ?? 0);
  const vel = useRef(0);
  // two under-damped oscillators for the flutter (x = angle, v = angular vel)
  const o1 = useRef({ x: 0, v: 0 });
  const o2 = useRef({ x: 0, v: 0 });

  const coeff = useMemo(() => makeCoeff(), []);

  const paint = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const p = pos.current;
    const w = Math.min(vw * 0.6, 900);
    const h = w * 0.64;

    const P0x = vw * 0.26, P0y = vh * 0.18;
    const P1x = vw * 0.52, P1y = vh * 0.5;
    const P2x = vw * 0.45, P2y = vh * 1.32;

    const a1 = o1.current.x, a2 = o2.current.x;
    let best = Infinity, bestCard = 0;

    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const d = wrap(i, p);
      const t = d / VIS;
      if (t < -0.3 || t > 1.3) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;

      const cx = bez(t, P0x, P1x, P2x);
      const cy = bez(t, P0y, P1y, P2y);
      // grow to full by centre, then hold (never shrink on the way out)
      const s = t < FOCAL ? mix(0.75, 1, smooth(0, FOCAL, t)) : 1;

      const c = coeff[i];
      const rx = (a1 * c.ax + a2 * c.bx) * WAVE_AMP;
      const ry = (a1 * c.ay + a2 * c.by) * WAVE_AMP;
      const rz = TILT + a1 * c.az * 0.25 * WAVE_AMP;

      el.style.transform =
        `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0) ` +
        `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
      el.style.opacity = String(smooth(-0.08, 0.1, t));
      el.style.zIndex = String(Math.round((2 - Math.abs(t - FOCAL)) * 60));

      const near = Math.abs(t - FOCAL);
      if (near < best) {
        best = near;
        bestCard = i;
      }
    }

    if (titleRef.current) {
      titleRef.current.textContent = CARDS[bestCard].title;
      titleRef.current.style.opacity = String(clamp01(1 - best * 3));
    }
    if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - Math.abs(p) * 1.5));
  }, [coeff]);

  useEffect(() => {
    let raf = 0;
    let lastNow = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;

      if (previewPos === undefined) {
        if (vel.current > VEL_MAX) vel.current = VEL_MAX;
        else if (vel.current < -VEL_MAX) vel.current = -VEL_MAX;
        pos.current += vel.current;
        vel.current *= FRICTION;
        if (Math.abs(vel.current) < 1e-4) vel.current = 0;
      }

      // flutter oscillators track the (velocity-derived) lean, under-damped so
      // they overshoot and settle — the paper waving, then coming to rest.
      const target = clamp(vel.current * WAVE_K, -WAVE_MAX, WAVE_MAX);
      const step = (o: { x: number; v: number }, k: number, c: number, tg: number) => {
        o.v += (k * (tg - o.x) - c * o.v) * dt;
        o.x += o.v * dt;
      };
      step(o1.current, 200, 9, target);
      step(o2.current, 95, 6, target * 0.7);

      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let cleanup = () => {};
    if (previewPos === undefined) {
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        vel.current += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * WHEEL_K;
      };
      let dragging = false;
      let last = 0;
      const ax = (e: PointerEvent) => e.clientX * 0.35 + e.clientY * 0.65;
      const onDown = (e: PointerEvent) => {
        dragging = true;
        last = ax(e);
        vel.current = 0;
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const a = ax(e);
        const stepv = (last - a) * DRAG_K;
        pos.current += stepv;
        vel.current = stepv;
        last = a;
      };
      const onUp = () => {
        dragging = false;
      };
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      cleanup = () => {
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      cleanup();
    };
  }, [paint, previewPos]);

  return (
    <div
      className="fixed inset-0 touch-none select-none overflow-hidden bg-background"
      style={{ perspective: "1600px" }}
    >
      {CARDS.map((c, i) => (
        <div
          key={c.title}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 overflow-hidden rounded-md border border-black/10 will-change-transform"
          style={{ width: 700, height: 448, visibility: "hidden", background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.1, mixBlendMode: "overlay" }} />
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.3)" }} />
          <div className="absolute bottom-5 left-6 text-[15px] font-medium tracking-tight text-white/90">{c.title}</div>
        </div>
      ))}

      <div ref={titleRef} className="pointer-events-none absolute bottom-8 right-8 text-[15px] font-medium tracking-tight text-foreground sm:right-12" />
      <div ref={hintRef} className="pointer-events-none absolute bottom-8 left-8 text-[12px] font-medium text-text-tertiary sm:left-12">
        Scroll or drag
      </div>
    </div>
  );
}
