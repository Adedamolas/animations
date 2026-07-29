"use client";

import { useCallback, useEffect, useRef } from "react";
import { clamp01 } from "@/lib/math";

/* ── A diagonal photo conveyor ──────────────────────────────────────────────
   Images ride a curve from the top-right down to the bottom-left. A "sliding
   window" clip opens each one on the way in (growing leftward, anchored right)
   and closes it on the way out (shrinking from the right, anchored left) — a
   window sliding shut over the scene, not a crude width squash. Momentum
   scrolling: a flick keeps gliding and eases to a stop. The image nearest the
   focal point names itself, bottom-right. */

const CREAM = "#faf6e8";

type Scene = { title: string; sky: [string, string]; ground: [string, string] };
const SCENES: Scene[] = [
  { title: "tidal wanderer", sky: ["#dcdde0", "#b7b8bb"], ground: ["#8f9092", "#5c5d5f"] },
  { title: "pink hour", sky: ["#f2b8c6", "#e79ab0"], ground: ["#8ea86a", "#4f6338"] },
  { title: "ridgeline", sky: ["#ccbfe0", "#9384b0"], ground: ["#4a4568", "#2a273c"] },
  { title: "goldcut", sky: ["#f3e0a6", "#e6c060"], ground: ["#a98a3e", "#6f5a26"] },
  { title: "saltmarsh", sky: ["#c3ddd6", "#8fb3a8"], ground: ["#4d6f64", "#2f463f"] },
  { title: "emberfall", sky: ["#f8cfa0", "#ef9a63"], ground: ["#9a4f34", "#5e2f20"] },
  { title: "harbor fog", sky: ["#cdd4d8", "#9aa4aa"], ground: ["#5f6a70", "#333c42"] },
  { title: "duskline", sky: ["#f4c9a2", "#e59a6a"], ground: ["#8a4f3a", "#4a2820"] },
  { title: "meadowcut", sky: ["#d6e3b8", "#a9c07e"], ground: ["#5f7a3e", "#374826"] },
  { title: "slate coast", sky: ["#b8c6cc", "#7f9299"], ground: ["#3f545c", "#223136"] },
];
const N = SCENES.length;

const VIS = 3.4; // journey units on screen at once — higher packs them tighter
const FOCAL = 0.44; // t of the "open + named" image (maps mid-right)
const FRICTION = 0.94; // momentum decay — the brake-and-glide
const WHEEL_K = 0.00024; // slow, contemplative drift — with a touch more pace
const DRAG_K = 0.0021;
const VEL_MAX = 0.05; // hard cap so a hard flick can't blow past everything

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// nearest looped copy of slot i relative to conveyor position
const wrap = (i: number, pos: number) => {
  const raw = i - pos;
  return raw - N * Math.round(raw / N);
};
// quadratic bézier point (top-right → mid-right → bottom-left)
const bez = (t: number, a: number, b: number, c: number) =>
  (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

export function SlidingCarousel({ previewPos }: { previewPos?: number }) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  const pos = useRef(previewPos ?? 0);
  const vel = useRef(0);
  const paintRef = useRef<(t: number) => void>(() => {});

  const sizeCard = useCallback(() => {
    const w = Math.min(window.innerWidth * 0.55, 576);
    const h = w * 0.64;
    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i];
      if (el) {
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      }
    }
    return { w, h };
  }, []);
  const size = useRef({ w: 440, h: 280 });

  const paint = useCallback((time: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { w: cw, h: ch } = size.current;
    const p = pos.current;

    // path anchors (card centres). On narrow screens the diagonal pulls toward
    // centre so the focal card stays fully on-screen instead of off the right.
    const narrow = vw < 680;
    const P0x = vw * (narrow ? 0.6 : 0.84), P0y = -vh * 0.14;
    const P1x = vw * (narrow ? 0.5 : 0.82), P1y = vh * 0.46;
    const P2x = vw * (narrow ? 0.4 : 0.16), P2y = vh * 1.12;

    let best = Infinity;
    let bestScene = 0;

    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const d = wrap(i, p);
      const t = d / VIS;

      if (t < -0.35 || t > 1.35) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";

      const cx = bez(t, P0x, P1x, P2x);
      const cy = bez(t, P0y, P1y, P2y);

      // idle drift — gentle, unique per card
      const tt = time / 1000;
      const dx = Math.sin(tt * 0.6 + i * 1.7) * 6;
      const dy = Math.cos(tt * 0.5 + i * 2.3) * 5;

      const x = cx - cw / 2 + dx;
      const y = cy - ch / 2 + dy;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Peak z at the focal point so the centred image is always on top and
      // reads in full — entering/exiting images layer behind it.
      el.style.zIndex = String(Math.round((2 - Math.abs(t - FOCAL)) * 60));

      // sliding-window clip: open on entry (anchored right, grows left),
      // close on exit (anchored left, shrinks from the right).
      const vis = smooth(-0.05, 0.2, t) * (1 - smooth(0.8, 1.05, t));
      const cut = (1 - vis) * 100;
      el.style.clipPath = t < 0.5 ? `inset(0 0 0 ${cut}%)` : `inset(0 ${cut}% 0 0)`;
      el.style.opacity = String(clamp01(vis * 4));

      const near = Math.abs(t - FOCAL);
      if (near < best) {
        best = near;
        bestScene = i;
      }
    }

    // name the focal image, bottom-right
    if (titleRef.current) {
      titleRef.current.textContent = SCENES[bestScene].title;
      titleRef.current.style.opacity = String(clamp01(1 - best * 3.2));
    }
    if (counterRef.current) {
      counterRef.current.textContent = `${String(bestScene + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
      counterRef.current.style.opacity = String(clamp01(1 - best * 3.2));
    }
    if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - Math.abs(pos.current) * 2));
  }, []);

  useEffect(() => {
    paintRef.current = paint;
    size.current = sizeCard();
    const onResize = () => {
      size.current = sizeCard();
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const loop = (now: number) => {
      if (previewPos === undefined) {
        if (vel.current > VEL_MAX) vel.current = VEL_MAX;
        else if (vel.current < -VEL_MAX) vel.current = -VEL_MAX;
        pos.current += vel.current;
        vel.current *= FRICTION;
        if (Math.abs(vel.current) < 1e-4) vel.current = 0;
      }
      paintRef.current(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Input → momentum (skip in preview)
    let cleanupInput = () => {};
    if (previewPos === undefined) {
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        vel.current += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * WHEEL_K;
      };
      let dragging = false;
      let last = 0;
      const axis = (e: PointerEvent) => e.clientX * 0.4 + e.clientY * 0.6;
      const onDown = (e: PointerEvent) => {
        dragging = true;
        last = axis(e);
        vel.current = 0;
        (e.target as Element).setPointerCapture?.(e.pointerId);
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const a = axis(e);
        const step = (last - a) * DRAG_K;
        pos.current += step;
        vel.current = step;
        last = a;
      };
      const onUp = () => {
        dragging = false;
      };
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      cleanupInput = () => {
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      cleanupInput();
    };
  }, [paint, sizeCard, previewPos]);

  return (
    <div className="fixed inset-0 touch-none select-none overflow-hidden" style={{ background: CREAM }}>
      {SCENES.map((s, i) => (
        <div
          key={s.title}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 overflow-hidden rounded-[5px] will-change-transform"
          style={{ width: 440, height: 280, visibility: "hidden" }}
        >
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, ${s.sky[0]} 0%, ${s.sky[1]} 52%, ${s.ground[0]} 52%, ${s.ground[1]} 100%)` }}
          />
          <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.1, mixBlendMode: "overlay" }} />
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 70px rgba(0,0,0,0.28)" }} />
        </div>
      ))}

      {/* focal image name, bottom-right */}
      <div className="pointer-events-none absolute bottom-8 right-8 text-right sm:bottom-10 sm:right-12">
        <div ref={counterRef} className="mb-1 font-mono text-[11px] tracking-[0.2em] text-text-tertiary" />
        <div ref={titleRef} className="text-[17px] font-medium tracking-tight text-foreground" />
      </div>

      <div ref={hintRef} className="pointer-events-none absolute bottom-8 left-8 text-[12px] font-medium tracking-wide text-text-tertiary sm:left-12">
        Scroll or drag ↘
      </div>
    </div>
  );
}
