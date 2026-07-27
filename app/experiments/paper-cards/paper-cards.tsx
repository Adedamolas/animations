"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/* ── Paper cards ─────────────────────────────────────────────────────────────
   Big rectangles facing the viewer, tilted ~15° left. On momentum scroll they
   ride up from the top-left, GROW to full size at screen-centre, then glide off
   the bottom without shrinking. Two under-damped oscillators driven by scroll
   velocity lean and flutter each card like a sheet of paper waved through the
   air — settling with a soft wobble when the scroll stops. A specular sheen
   catches the light as each sheet tips; a soft shadow grounds it; a faint idle
   float keeps them alive at rest; and the centred card names itself. */

type Card = { title: string; from: string; to: string; year: string; place: string };
const CARDS: Card[] = [
  { title: "northern drift", from: "#3f6f8f", to: "#12324a", year: "2016", place: "Lofoten" },
  { title: "amber coast", from: "#e8a15a", to: "#8a4a24", year: "2017", place: "Algarve" },
  { title: "violet mile", from: "#8a6fb0", to: "#3d2a63", year: "2018", place: "Jaipur" },
  { title: "sea glass", from: "#6fb0a0", to: "#25574c", year: "2019", place: "Reykjavík" },
  { title: "rose dune", from: "#e096a6", to: "#8a3f56", year: "2020", place: "Marrakech" },
  { title: "slate noon", from: "#8fa2b0", to: "#3c4b58", year: "2021", place: "Hokkaido" },
  { title: "gold field", from: "#e6c467", to: "#8f6f24", year: "2022", place: "Tuscany" },
  { title: "ink harbor", from: "#4a5a78", to: "#161d2e", year: "2023", place: "Lisbon" },
];
const N = CARDS.length;

const VIS = 2.1; // journey units on screen — higher = less space between cards
const GROW_AT = 0.5; // t where a card reaches full size — exactly at screen-centre
const NAME_AT = 0.5; // t of the card we name (the centred one)
const TILT = -15; // degrees left

const FRICTION = 0.948;
const WHEEL_K = 0.0008; // one swipe carries the carousel a good way
const DRAG_K = 0.0063;
const VEL_MAX = 0.175;

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
  const sheenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shadowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const capRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  const pos = useRef(previewPos ?? 0);
  const vel = useRef(0);
  const nowRef = useRef(0);
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
    const tt = nowRef.current / 1000;

    const P0x = vw * 0.26, P0y = vh * 0.18; // near the top-left
    const P1x = vw * 0.52, P1y = vh * 0.5;
    const P2x = vw * 0.45, P2y = vh * 1.34;

    const a1 = o1.current.x, a2 = o2.current.x;
    let best = Infinity, bestCard = 0;

    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i];
      const sheen = sheenRefs.current[i];
      const shadow = shadowRefs.current[i];
      if (!el) continue;
      const d = wrap(i, p);
      const t = d / VIS;
      if (t < -0.5 || t > 1.3) {
        el.style.visibility = "hidden";
        if (shadow) shadow.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      if (shadow) shadow.style.visibility = "visible";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;

      // idle float — a suspended sheet never sits perfectly still
      const idX = Math.sin(tt * 0.5 + i * 1.7) * 5;
      const idY = Math.cos(tt * 0.42 + i * 2.3) * 4;
      const idR = Math.sin(tt * 0.35 + i * 1.1) * 0.8;

      const cx = bez(t, P0x, P1x, P2x) + idX;
      const cy = bez(t, P0y, P1y, P2y) + idY;
      const s = mix(0.3, 1, smooth(0, GROW_AT, t)); // grow to full at centre

      const c = coeff[i];
      const rx = (a1 * c.ax + a2 * c.bx) * WAVE_AMP;
      const ry = (a1 * c.ay + a2 * c.by) * WAVE_AMP;
      const rz = TILT + idR + a1 * c.az * 0.25 * WAVE_AMP;

      el.style.transform =
        `translate3d(${cx - w / 2}px, ${cy - h / 2}px, 0) ` +
        `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
      const z = Math.round(t * 100) + 300;
      el.style.zIndex = String(z);

      // specular sheen — a soft highlight that slides opposite the tilt, as if
      // a fixed light is glancing off the sheet; brighter the more it catches.
      if (sheen) {
        const hx = 50 - ry * 3.2;
        const hy = 42 - rx * 3.2;
        const glint = clamp01((Math.abs(rx) + Math.abs(ry)) / 8);
        sheen.style.background = `radial-gradient(58% 46% at ${hx}% ${hy}%, rgba(255,255,255,0.55), transparent 72%)`;
        sheen.style.opacity = String(0.12 + glint * 0.42);
      }

      // grounding shadow — soft, offset down and opposite the lean, behind card
      if (shadow) {
        shadow.style.width = `${w}px`;
        shadow.style.height = `${h}px`;
        shadow.style.transform =
          `translate3d(${cx - w / 2 - ry * 4}px, ${cy - h / 2 + 26 * s}px, 0) ` +
          `rotateZ(${rz}deg) scale(${s * 0.96})`;
        shadow.style.opacity = String(0.32 * s);
        shadow.style.zIndex = String(z - 1);
      }

      const near = Math.abs(t - NAME_AT);
      if (near < best) {
        best = near;
        bestCard = i;
      }
    }

    // gallery caption — reveals as a card centres
    const card = CARDS[bestCard];
    const rev = clamp01(1 - best * 2.6);
    if (counterRef.current)
      counterRef.current.textContent = `${String(bestCard + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
    if (titleRef.current) titleRef.current.textContent = card.title;
    if (metaRef.current) metaRef.current.textContent = `${card.year} · ${card.place}`;
    if (capRef.current) {
      capRef.current.style.opacity = String(rev);
      capRef.current.style.transform = `translateY(${(1 - rev) * 14}px)`;
    }
    if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - Math.abs(p) * 1.5));
  }, [coeff]);

  useEffect(() => {
    let raf = 0;
    let lastNow = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      nowRef.current = now;

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
      {/* grounding shadows (behind the cards) */}
      {CARDS.map((c, i) => (
        <div
          key={`sh-${c.title}`}
          ref={(el) => {
            shadowRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 rounded-lg will-change-transform"
          style={{
            width: 700,
            height: 448,
            visibility: "hidden",
            background: "radial-gradient(closest-side, rgba(0,0,0,0.4), rgba(0,0,0,0.12) 62%, transparent)",
            filter: "blur(20px)",
          }}
        />
      ))}

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
          {/* specular sheen */}
          <div
            ref={(el) => {
              sheenRefs.current[i] = el;
            }}
            className="absolute inset-0"
            style={{ mixBlendMode: "screen" }}
          />
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.3)" }} />
          <div className="absolute bottom-5 left-6 text-[15px] font-medium tracking-tight text-white/90">{c.title}</div>
        </div>
      ))}

      {/* gallery caption — reveals on the centred card */}
      <div ref={capRef} className="pointer-events-none absolute bottom-8 right-8 z-[999] text-right sm:right-12">
        <div ref={counterRef} className="mb-1.5 font-mono text-[11px] tracking-[0.22em] text-text-tertiary" />
        <div ref={titleRef} className="text-[19px] font-medium tracking-tight text-foreground" />
        <div ref={metaRef} className="mt-0.5 text-[13px] text-text-secondary" />
      </div>

      <div ref={hintRef} className="pointer-events-none absolute bottom-8 left-8 z-[999] text-[12px] font-medium text-text-tertiary sm:left-12">
        Scroll or drag
      </div>
    </div>
  );
}
