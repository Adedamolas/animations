"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";
import { clamp01 } from "@/lib/math";

/* Warm, editorial palette (marketing surface — off the chrome tokens). */
const CREAM = "#faf6e8";
const HERO_BG =
  "radial-gradient(120% 90% at 60% 42%, #2ba28b 0%, #14675a 33%, #0a3a33 68%, #06201d 100%)";
/* One warm accent — gold — against the emerald. Ties into the cream/tan copy
   instead of the old orange that fought the green. Deep-emerald ink on top. */
const ACCENT = "#e2a648";
const ACCENT_INK = "#06201d";
const NAV_LIGHT = [250, 246, 232]; // on the dark hero
const NAV_DARK = [26, 20, 15]; // on the cream content
const SQUIRCLE = 60; // px — the size the hero lands at
const WORD_GAP = "0.26em"; // shared by words AND the slot, so spacing is even

/* No bounce, and slow — the slower the spring, the more real time the whole
   cascade gets to breathe. */
const SPRING = { stiffness: 78, damping: 20, mass: 1 };

/* Word cascade. Delays are laid out in relative units (1 per word, a bigger
   jump between sentences) then normalized into [BASE, END] so it always fits
   however many words there are. Slow spring = long, deliberate reveal. */
const WORD_U = 1; // time between consecutive words
const SENTENCE_U = 4.5; // extra jump when a new sentence starts
const BASE = 0.08; // first word start (progress)
const END = 0.9; // last word start
const WORD_DUR = 0.12; // each word's own fade-up length

/* Hero exit — its lines leave one after another (staggered), fading upward. */
const HERO_STAGGER = 0.14;
const HERO_DUR = 0.3;

// The paragraph as tokens; "SLOT" is the inline hole the squircle lands in.
const RAW: string[][] = [
  ["You", "deserve", "SLOT", "to", "be", "wealthy."],
  ["You've", "saved", "for", "years.", "Stayed", "disciplined."],
  ["Yet", "the", "gates", "to", "real", "wealth", "still", "feel", "closed."],
  ["We", "break", "the", "lock."],
  ["Rank", "turns", "your", "network", "into", "your", "net", "worth", "—"],
  ["capital", "through", "connection,", "without", "debt", "traps."],
];

type Token = { kind: "word"; text: string; idx: number } | { kind: "slot" };
let wordCount = 0;
const LINES: Token[][] = RAW.map((line) =>
  line.map((t) =>
    t === "SLOT"
      ? ({ kind: "slot" } as const)
      : ({ kind: "word", text: t, idx: wordCount++ } as const),
  ),
);
const WORD_COUNT = wordCount;

// Per-word start times: 1 unit between words, a bigger jump between sentences,
// normalized into [BASE, END].
const WORD_START: number[] = (() => {
  const raw = new Array<number>(WORD_COUNT);
  let u = 0;
  LINES.forEach((line, li) => {
    if (li > 0) u += SENTENCE_U;
    line.forEach((tok) => {
      if (tok.kind === "word") raw[tok.idx] = u;
      u += WORD_U; // words AND the slot advance the clock
    });
  });
  const maxU = Math.max(...raw);
  return raw.map((v) => BASE + (v / maxU) * (END - BASE));
})();

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const rgb = (a: number[], b: number[], t: number) =>
  `rgb(${Math.round(mix(a[0], b[0], t))}, ${Math.round(mix(a[1], b[1], t))}, ${Math.round(mix(a[2], b[2], t))})`;

export function HeroMorph({ initialPhase = 0 }: { initialPhase?: 0 | 1 }) {
  const [phase, setPhase] = useState<0 | 1>(initialPhase);
  const phaseRef = useRef<0 | 1>(initialPhase);
  phaseRef.current = phase;

  const sectionRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroItemsRef = useRef<(HTMLElement | null)[]>([]);
  const hintRef = useRef<HTMLDivElement>(null);
  const paraRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const slotRef = useRef<HTMLSpanElement>(null);
  const target = useRef<{ x: number; y: number; size: number } | null>(null);

  // The slot never carries a transform (only the words do, and translateY
  // doesn't move their layout box), so its rect is a stable, exact landing
  // spot — no transform-clearing needed.
  const measure = useCallback(() => {
    const r = slotRef.current?.getBoundingClientRect();
    if (r) target.current = { x: r.left, y: r.top, size: r.width };
  }, []);

  const paintRef = useRef<() => void>(() => {});
  const spring = useSpring(initialPhase, () => paintRef.current(), SPRING);

  const paint = useCallback(() => {
    const p = clamp01(spring.current());
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Background: full-bleed → squircle landing on the slot. Animating the box
    // (not scale) keeps `background-size: cover` a clean center-crop all the way.
    const bg = bgRef.current;
    const t = target.current;
    if (bg && t) {
      bg.style.left = `${mix(0, t.x, p)}px`;
      bg.style.top = `${mix(0, t.y, p)}px`;
      bg.style.width = `${mix(vw, t.size, p)}px`;
      bg.style.height = `${mix(vh, t.size, p)}px`;
      bg.style.borderRadius = `${mix(0, t.size * 0.32, p)}px`;
      bg.style.boxShadow = `0 ${mix(0, 10, p)}px ${mix(0, 26, p)}px -6px rgba(80,40,10,${mix(0, 0.35, p)})`;
    }

    // Nav color rides between light (on hero) and dark (on cream).
    sectionRef.current?.style.setProperty("--nav", rgb(NAV_LIGHT, NAV_DARK, p));

    // Hero foreground exits UP — its lines leave one after another, each
    // fading and lifting with its own delay.
    if (heroRef.current)
      heroRef.current.style.pointerEvents = p > 0.5 ? "none" : "auto";
    const items = heroItemsRef.current;
    for (let j = 0; j < items.length; j++) {
      const el = items[j];
      if (!el) continue;
      const e = seg(p, j * HERO_STAGGER, j * HERO_STAGGER + HERO_DUR);
      el.style.opacity = String(1 - e);
      el.style.transform = `translateY(${-e * 80}px)`;
      el.style.filter = e > 0 ? `blur(${e * 4}px)` : "none";
    }
    const hint = hintRef.current;
    if (hint) hint.style.opacity = String(clamp01(1 - p * 4));

    // Paragraph enters WORD BY WORD — each word waits its turn, fades up, no
    // bounce.
    const para = paraRef.current;
    if (para) para.style.pointerEvents = p > 0.5 ? "auto" : "none";
    for (let i = 0; i < WORD_COUNT; i++) {
      const el = wordRefs.current[i];
      if (!el) continue;
      const lt = seg(p, WORD_START[i], WORD_START[i] + WORD_DUR);
      el.style.opacity = String(lt);
      el.style.transform = `translateY(${(1 - lt) * 16}px)`;
      el.style.filter = lt < 1 ? `blur(${(1 - lt) * 4}px)` : "none";
    }
  }, [spring]);

  // One-swipe (or wheel/drag) trigger with a cooldown — a single gesture fires
  // exactly one transition. preventDefault keeps the page from scrolling.
  useEffect(() => {
    paintRef.current = paint;
    measure();
    paint();

    let locked = false;
    const go = (dir: 1 | -1) => {
      const next: 0 | 1 = dir > 0 ? 1 : 0;
      if (locked || phaseRef.current === next) return;
      locked = true;
      measure();
      setPhase(next);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) spring.jump(next);
      else spring.set(next);
      window.setTimeout(() => {
        locked = false;
      }, 650);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaY) > 12) go(e.deltaY > 0 ? 1 : -1);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const d = touchY - e.touches[0].clientY;
      if (Math.abs(d) > 36) go(d > 0 ? 1 : -1);
    };
    const onResize = () => {
      measure();
      paint();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", onResize);
    };
  }, [spring, measure, paint]);

  // Approximate SSR styling for the ?p=1 preview (headless can't run the
  // measuring effect). Live, the client paint places everything exactly.
  const pv = initialPhase === 1;

  return (
    <div
      ref={sectionRef}
      className="fixed inset-0 overflow-hidden"
      style={
        {
          background: CREAM,
          "--nav": pv ? `rgb(${NAV_DARK})` : `rgb(${NAV_LIGHT})`,
        } as React.CSSProperties
      }
    >
      {/* The morphing background — full-bleed, then a squircle in the copy */}
      <div
        ref={bgRef}
        aria-hidden
        className="pointer-events-none absolute overflow-hidden"
        style={
          pv
            ? {
                left: "46.5%",
                top: "31%",
                width: SQUIRCLE,
                height: SQUIRCLE,
                borderRadius: SQUIRCLE * 0.32,
                background: HERO_BG,
              }
            : {
                left: 0,
                top: 0,
                width: "100vw",
                height: "100vh",
                background: HERO_BG,
              }
        }
      />

      {/* Persistent nav */}
      <nav
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-6 sm:px-10"
        style={{ color: "var(--nav)" }}
      >
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span
            className="grid size-6 place-items-center rounded-md text-[13px]"
            style={{ background: ACCENT, color: ACCENT_INK }}
          >
            ✦
          </span>
          Rank
        </div>
        <div className="flex items-center gap-3 text-[13px] font-medium">
          <span className="hidden sm:inline">Get the app</span>
          <span
            className="rounded-full px-4 py-2 font-semibold shadow-sm"
            style={{ background: ACCENT, color: ACCENT_INK }}
          >
            Download
          </span>
        </div>
      </nav>

      {/* Hero foreground — lines exit upward, staggered */}
      <div ref={heroRef} className="absolute inset-0 z-20">
        <div className="absolute bottom-16 left-6 max-w-[92%] sm:left-10">
          <h1
            className="font-bold leading-[0.9] tracking-tight text-white"
            style={{ fontSize: "clamp(2.4rem, 10.5vw, 8.1rem)" }}
          >
            <span
              ref={(el) => {
                heroItemsRef.current[0] = el;
              }}
              className="block"
              style={{ opacity: pv ? 0 : 1 }}
            >
              The money app
            </span>
            <span
              ref={(el) => {
                heroItemsRef.current[1] = el;
              }}
              className="block"
              style={{ opacity: pv ? 0 : 1 }}
            >
              for communities.
            </span>
          </h1>
          <p
            ref={(el) => {
              heroItemsRef.current[2] = el;
            }}
            className="mt-6 max-w-md text-[13px] leading-5 text-white/80"
            style={{ opacity: pv ? 0 : 1 }}
          >
            Access investments and savings with expert human guidance reserved
            for the ultra-wealthy. Rank gives you this through the power of
            people.
          </p>
        </div>
      </div>

      {/* Incoming paragraph — words cascade in, squircle lands in line 1 */}
      <div
        ref={paraRef}
        className="absolute inset-0 z-10 flex items-center justify-center px-6"
      >
        <div className="max-w-[1100px] text-center text-[1.75rem] font-medium leading-[1.5] tracking-tight text-[#a9967e] sm:text-[41px] sm:leading-[1.4]">
          {LINES.map((line, li) => (
            <div key={li}>
              {line.map((tok, ti) =>
                tok.kind === "slot" ? (
                  <span
                    key={ti}
                    ref={slotRef}
                    className="inline-block align-middle"
                    style={{
                      width: SQUIRCLE,
                      height: SQUIRCLE,
                      marginRight: WORD_GAP,
                    }}
                  />
                ) : (
                  <span
                    key={ti}
                    ref={(el) => {
                      wordRefs.current[tok.idx] = el;
                    }}
                    className="inline-block"
                    style={{ opacity: pv ? 1 : 0, marginRight: WORD_GAP }}
                  >
                    {tok.text}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Swipe hint */}
      <div
        ref={hintRef}
        className="absolute inset-x-0 bottom-6 z-20 flex justify-center text-[12px] font-medium tracking-wide text-white/70"
        style={{ opacity: pv ? 0 : 1 }}
      >
        Scroll or swipe ↓
      </div>

      {/* Low-key back link */}
      <a
        href="/"
        className="absolute left-6 top-20 z-40 text-[11px] font-medium sm:left-10"
        style={{ color: "var(--nav)", opacity: 0.6 }}
      >
        ← Playground
      </a>
    </div>
  );
}
