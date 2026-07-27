"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";

/* ── Folder jump-out ─────────────────────────────────────────────────────────
   Three square cards, each tilted its own way, sit sandwiched in the folder
   (peeking between the back panel and the front flap). Hover tips the flap
   toward you; click opens it and the cards jump OUT — rising steadily while
   they come forward and enlarge, staggered so they cascade. No bounce. */

const CARD = 200; // square

type Card = { grad: string; tilt: number; fx: number };
const CARDS: Card[] = [
  { grad: "linear-gradient(150deg, #6f86c9, #24356a)", tilt: -13, fx: -9 },
  { grad: "linear-gradient(150deg, #e0a06a, #7a3f24)", tilt: 3, fx: 2 },
  { grad: "linear-gradient(150deg, #7fb59a, #2c5544)", tilt: 16, fx: 12 },
];
const N = CARDS.length;
const STAGGER = 0.06; // cascade between cards

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);


// Over-damped — no overshoot, no bounce.
const SPRING = { stiffness: 150, damping: 30, mass: 1 };

export function FolderInteraction({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const openRef = useRef(initialOpen);

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const flapRef = useRef<HTMLDivElement>(null);
  const hover = useRef(0);
  const hoverTarget = useRef(0);

  const paintRef = useRef<() => void>(() => {});
  const spring = useSpring(initialOpen ? 1 : 0, () => {}, SPRING);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const paint = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const o = clamp01(spring.current());
    const hv = hover.current;

    const mouthX = vw / 2;
    const mouthY = vh * 0.72; // sandwiched in the folder
    const centerY = vh * 0.45;
    const fScale = 0.5;
    // size so three stand side by side across the screen
    const cardFinalW = Math.min(vw * 0.26, vh * 0.42, 320);
    const bigScale = cardFinalW / CARD;
    const spacing = cardFinalW * 1.14; // side by side, small gap between

    for (let i = 0; i < N; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;
      const c = CARDS[i];
      // staggered per-card progress — all land by o = 1
      const oi = clamp01((o - i * STAGGER) / (1 - (N - 1) * STAGGER));

      // Two overlapping beats: FIRST the card launches UP (front-loaded, still
      // small + stacked), THEN it spreads to its slot, un-tilts, and enlarges
      // (back-loaded). The up finishes late too, so there's no dead stop.
      const up = easeOut(oi); // front-loaded — the jump
      const end = oi * oi; // back-loaded — spread + enlarge

      const finalX = mouthX + (i - 1) * spacing;
      const x = mix(mouthX + c.fx, finalX, end);
      const y = mix(mouthY - hv * 16, centerY, up);
      const scale = mix(fScale, bigScale, end);
      const z = mix(0, 50, end);
      const rotZ = mix(c.tilt, 0, end); // tilted in the folder → upright out

      el.style.transform =
        `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) ` +
        `rotateZ(${rotZ}deg) scale(${scale})`;
      el.style.zIndex = oi > 0.2 ? "400" : String(322 - i); // sandwiched, then out
    }

    // hover tips the front flap toward you; opening tips it further
    if (flapRef.current)
      flapRef.current.style.transform = `translateX(-50%) rotateX(${-(hv * 10 + o * 22)}deg)`;
  }, [spring]);

  const toggle = useCallback(() => {
    const next = !openRef.current;
    setOpen(next);
    hoverTarget.current = 0;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) spring.jump(next ? 1 : 0);
    else spring.set(next ? 1 : 0);
  }, [spring]);

  useEffect(() => {
    paintRef.current = paint;
    let raf = 0;
    const loop = () => {
      hover.current += (hoverTarget.current - hover.current) * 0.15;
      paintRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paint]);

  return (
    <div className="fixed inset-0 touch-none select-none overflow-hidden bg-background" style={{ perspective: "1400px" }}>
      {/* the cards — square, each tilted its own way */}
      {CARDS.map((c, i) => (
        <div
          key={i}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          className="absolute left-0 top-0 overflow-hidden rounded-lg will-change-transform"
          style={{ width: CARD, height: CARD, background: c.grad }}
        >
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 60px rgba(0,0,0,0.25)" }} />
        </div>
      ))}

      {/* folder back panel */}
      <div className="pointer-events-none absolute left-1/2 z-[300] -translate-x-1/2" style={{ bottom: "18%", width: 200, height: 156 }}>
        <div className="absolute inset-0 rounded-2xl bg-[#3a3a3d] shadow-xl" />
      </div>
      {/* front flap — tips open */}
      <div
        ref={flapRef}
        className="pointer-events-none absolute bottom-[18%] left-1/2 z-[350] h-28 w-[200px] rounded-2xl border border-white/10 bg-[#55555a]/45 backdrop-blur-md"
        style={{ transformOrigin: "bottom center", transform: "translateX(-50%)" }}
      />

      {/* click target */}
      <button
        type="button"
        onClick={toggle}
        onMouseEnter={() => {
          if (!openRef.current) hoverTarget.current = 1;
        }}
        onMouseLeave={() => {
          hoverTarget.current = 0;
        }}
        aria-label={open ? "Close" : "Open folder"}
        className="absolute left-1/2 z-[360] -translate-x-1/2 rounded-2xl"
        style={{ bottom: "16%", width: 240, height: 190 }}
      />
    </div>
  );
}
