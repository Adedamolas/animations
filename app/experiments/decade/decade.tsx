"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";

/* ── A Decade in the Making ──────────────────────────────────────────────────
   A vertical timeline of years. Arrow keys (or a click) move the active year;
   its thumbnail expands into a big image, pushing the years below it down. The
   title + paragraph + giant year on the right follow the active item's height
   on screen — early years read near the top, late years near the bottom — and
   the paragraph reveals sentence by sentence on every change. */

type Entry = {
  year: string;
  title: [string, string];
  body: string[];
  tone: [string, string]; // grayscale gradient
};

const ENTRIES: Entry[] = [
  { year: "2016", title: ["Small Rooms,", "Big Ideas"], tone: ["#d9d9dc", "#a8a8ac"], body: ["It starts in a borrowed room with one desk and too much ambition.", "Every project is a first of its kind.", "Nothing is polished; everything is possible."] },
  { year: "2017", title: ["Learning", "to Listen"], tone: ["#c7c7cb", "#8f9094"], body: ["The work slows down on purpose.", "We stop pitching and start asking better questions.", "The answers reshape how we design."] },
  { year: "2018", title: ["The First", "Real Clients"], tone: ["#cfcfd3", "#7c7d81"], body: ["Names we recognise start signing off on the work.", "Deadlines get sharper, standards higher.", "We learn to ship without losing the craft."] },
  { year: "2019", title: ["Beyond the", "City Limits"], tone: ["#2a2a2e", "#0d0d10"], body: ["Word travels further than expected.", "The first international projects land on the table, and with them a new rhythm.", "Video calls across time zones, briefs in foreign languages, deadlines that never sleep."] },
  { year: "2020", title: ["A Quiet", "Reset"], tone: ["#dcdce0", "#b4b4b8"], body: ["The world stops and so, for a moment, do we.", "Remote becomes the default, not the exception.", "We rebuild the studio around trust instead of desks."] },
  { year: "2021–2023", title: ["Building", "the Bench"], tone: ["#c2c2c6", "#86868a"], body: ["Three years blur into one long sprint of hiring and shipping.", "The team doubles, then doubles again.", "Culture becomes the product we protect most."] },
  { year: "2024", title: ["Systems", "over Sparks"], tone: ["#1c1c20", "#0a0a0d"], body: ["We trade heroics for systems that hold.", "Design tokens, shared language, fewer surprises.", "The magic stops depending on any one person."] },
  { year: "2025", title: ["The Long", "Game"], tone: ["#d0d0d4", "#9a9a9e"], body: ["Growth gives way to depth.", "We say no more than we say yes.", "The projects we keep are the ones we believe in."] },
  { year: "2026", title: ["What Comes", "Next"], tone: ["#cacace", "#7f8084"], body: ["A decade in, the questions are bigger than the answers.", "That still feels like the right place to be.", "The next room is already half-built."] },
];
const N = ENTRIES.length;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const SPRING = { stiffness: 90, damping: 20, mass: 1 }; // slow, no bounce

export function Decade({ initialActive = 3 }: { initialActive?: number }) {
  const [active, setActive] = useState(initialActive);
  const [ready, setReady] = useState(false);
  const activeRef = useRef(initialActive);
  const prevRef = useRef(initialActive);

  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tickRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rightRef = useRef<HTMLDivElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);

  const paintRef = useRef<() => void>(() => {});
  const spring = useSpring(1, () => paintRef.current(), SPRING);

  const paint = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const t = clamp01(spring.current());
    const A0 = prevRef.current;
    const A1 = activeRef.current;

    // On narrow screens the copy stacks BELOW the active image instead of to
    // its right, so we widen the image and reserve extra vertical room for it.
    const narrow = vw < 720;
    const imgLeft = narrow ? vw * 0.28 : Math.min(vw * 0.22, 430);
    const activeW = narrow ? vw * 0.66 : Math.min(vw * 0.44, 660);
    const activeH = activeW * 0.56;
    const smallW = Math.min(vw * 0.12, 150);
    const smallH = smallW * 0.46;
    const GAP = 22;
    const tickX = imgLeft - (narrow ? 26 : 30);
    const labelW = tickX - (narrow ? 10 : 16);
    const EXTRA = narrow ? 300 : 0; // room below the active image for the copy

    const geo = (A: number) => {
      const tops: number[] = [];
      let y = 0;
      for (let i = 0; i < N; i++) {
        tops[i] = y;
        y += (i === A ? activeH + EXTRA : smallH) + GAP;
      }
      const bandY = mix(vh * (narrow ? 0.17 : 0.15), vh * (narrow ? 0.34 : 0.6), N > 1 ? A / (N - 1) : 0);
      const offset = bandY - (tops[A] + activeH / 2);
      return { top: tops.map((v) => v + offset), activeTop: tops[A] + offset };
    };
    const gA = geo(A0);
    const gB = geo(A1);

    for (let i = 0; i < N; i++) {
      const wrap = itemRefs.current[i];
      const img = imgRefs.current[i];
      if (!wrap || !img) continue;
      const y = mix(gA.top[i], gB.top[i], t);
      const a = i === A1 ? t : i === A0 ? 1 - t : 0;
      wrap.style.transform = `translateY(${y}px)`;
      wrap.style.zIndex = String(1 + Math.round(a * 20));

      img.style.left = `${imgLeft}px`;
      img.style.width = `${mix(smallW, activeW, a)}px`;
      img.style.height = `${mix(smallH, activeH, a)}px`;

      const label = labelRefs.current[i];
      if (label) {
        label.style.width = `${labelW}px`;
        label.style.opacity = String(mix(0.3, 1, a));
      }
      const tick = tickRefs.current[i];
      if (tick) {
        tick.style.left = `${tickX}px`;
        tick.style.width = `${mix(14, 30, a)}px`;
        tick.style.opacity = String(mix(0.28, 1, a));
      }
    }

    if (rightRef.current) {
      if (narrow) {
        // stacked below the active image
        rightRef.current.style.left = `${imgLeft}px`;
        rightRef.current.style.width = `${Math.min(activeW, vw - imgLeft - 16)}px`;
        rightRef.current.style.transform = `translateY(${mix(gA.activeTop, gB.activeTop, t) + activeH + 18}px)`;
      } else {
        rightRef.current.style.left = `${imgLeft + activeW + Math.min(vw * 0.05, 70)}px`;
        rightRef.current.style.width = `${Math.max(220, vw - (imgLeft + activeW + Math.min(vw * 0.05, 70)) - Math.min(vw * 0.05, 64))}px`;
        rightRef.current.style.transform = `translateY(${mix(gA.activeTop, gB.activeTop, t)}px)`;
      }
    }
    if (axisRef.current) axisRef.current.style.left = `${tickX}px`;
  }, [spring]);

  const go = useCallback(
    (next: number) => {
      const n = clamp(next, 0, N - 1);
      if (n === activeRef.current) return;
      prevRef.current = activeRef.current;
      activeRef.current = n;
      setActive(n);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) spring.jump(1);
      else {
        spring.jump(0);
        spring.set(1);
      }
    },
    [spring],
  );

  useEffect(() => {
    paintRef.current = paint;
    paint();
    setReady(true);
    const onResize = () => paint();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        go(activeRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        go(activeRef.current - 1);
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [paint, go]);

  const cur = ENTRIES[active];

  return (
    <div
      className="force-light fixed inset-0 overflow-hidden bg-background text-foreground"
      style={{ opacity: ready ? 1 : 0, transition: "opacity 240ms ease" }}
    >
      {/* top-left tag + section label */}
      <div className="absolute left-6 top-6 z-40 rounded-sm bg-foreground px-2 py-1 text-[11px] font-medium text-background sm:left-8">
        A Decade in the Making
      </div>
      <div className="absolute left-6 top-1/2 z-40 hidden -translate-y-1/2 text-[13px] font-medium text-text-secondary min-[720px]:block sm:left-8">
        Growth
      </div>

      {/* vertical axis line */}
      <div ref={axisRef} className="absolute top-0 h-full w-px bg-border" style={{ left: 400 }} />

      {/* timeline items */}
      {ENTRIES.map((e, i) => (
        <div
          key={e.year}
          ref={(el) => {
            itemRefs.current[i] = el;
          }}
          className="absolute inset-x-0 top-0 will-change-transform"
        >
          {/* year label (right-aligned to the tick) */}
          <div
            ref={(el) => {
              labelRefs.current[i] = el;
            }}
            className="absolute top-0 pr-4 text-right font-mono text-[13px] tabular-nums tracking-tight"
            style={{ width: 360 }}
          >
            {e.year}
          </div>
          {/* tick */}
          <div
            ref={(el) => {
              tickRefs.current[i] = el;
            }}
            className="absolute top-[9px] h-px bg-foreground"
            style={{ left: 370, width: 14 }}
          />
          {/* image */}
          <button
            type="button"
            onClick={() => go(i)}
            aria-label={`${e.year} — ${e.title.join(" ")}`}
            ref={(el) => {
              imgRefs.current[i] = el as unknown as HTMLDivElement;
            }}
            className="absolute top-0 overflow-hidden rounded-[3px]"
            style={{ left: 410, width: 150, height: 70, background: `linear-gradient(155deg, ${e.tone[0]}, ${e.tone[1]})` }}
          >
            <span className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.12, mixBlendMode: "overlay" }} />
            <span className="absolute inset-0" style={{ boxShadow: "inset 0 0 90px rgba(0,0,0,0.3)" }} />
          </button>
        </div>
      ))}

      {/* right panel — title + paragraph, remounted per active so it re-staggers */}
      <div ref={rightRef} className="absolute top-0 z-30" style={{ left: 1120, width: 560 }}>
        <div key={active}>
          <h2 className="text-[clamp(1.65rem,3.4vw,3.4rem)] font-semibold leading-[1.04] tracking-tight">
            {cur.title.map((line, i) => (
              <span key={i} className="block" style={{ animation: "caption-in 0.6s var(--ease-out) both", animationDelay: `${i * 0.08}s` }}>
                {line}
              </span>
            ))}
          </h2>
          <div
            className="mt-10 max-w-[440px] text-[15px] leading-6 text-text-secondary"
            style={{ maskImage: "linear-gradient(to bottom, #000 62%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, #000 62%, transparent)" }}
          >
            {cur.body.map((s, i) => (
              <span key={i} className="mr-1 inline" style={{ animation: "caption-in 0.6s var(--ease-out) both", animationDelay: `${0.25 + i * 0.16}s` }}>
                {s}{" "}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* giant active year, bottom-right */}
      <div key={`yr-${active}`} className="pointer-events-none absolute bottom-6 right-8 z-30 text-[clamp(3rem,7vw,7rem)] font-semibold leading-none tracking-tight sm:right-12" style={{ animation: "caption-in 0.5s var(--ease-out) both" }}>
        {cur.year}
      </div>

      {/* hint */}
      <div className="absolute bottom-7 left-6 z-40 text-[12px] font-medium text-text-tertiary sm:left-8">
        ↑ ↓ to move through the years
      </div>
    </div>
  );
}
