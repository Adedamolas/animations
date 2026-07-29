"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";
import { clamp01 } from "@/lib/math";

/* The product every testimonial is about — one constant label, top-left. */
const BRAND = "Alta®";

type Person = {
  name: string;
  title: string;
  /** Quote pre-split into lines so each can cascade in on its own beat. */
  lines: string[];
  /** Deterministic avatar art — a two-stop gradient. */
  grad: [string, string];
};

const PEOPLE: Person[] = [
  {
    name: "Aisha Rahman",
    title: "CMO, Atlas Ventures",
    lines: [
      "“They presented one direction, not three.",
      "I pushed back on that in week one. By week",
      "six I understood it — every decision since",
      "has been faster because of it.”",
    ],
    grad: ["#f6a5c0", "#f0c27b"],
  },
  {
    name: "Marcus Lee",
    title: "Head of Design, Northwind",
    lines: [
      "“It’s the first tool that got out of the way.",
      "No ceremony, no dashboards to babysit —",
      "just the one number that actually moves",
      "the work forward.”",
    ],
    grad: ["#a1c4fd", "#c2e9fb"],
  },
  {
    name: "Priya Nair",
    title: "VP Engineering, Corva",
    lines: [
      "“We shipped in a weekend what used to take",
      "a quarter of meetings. The team stopped",
      "arguing about the plan and started",
      "arguing about the work.”",
    ],
    grad: ["#84fab0", "#8fd3f4"],
  },
  {
    name: "Diego Santos",
    title: "Founder, Lumen Studio",
    lines: [
      "“I expected another dashboard. What I got",
      "was a point of view — opinionated in all",
      "the right places, quiet everywhere else.”",
    ],
    grad: ["#fbc2eb", "#a6c1ee"],
  },
  {
    name: "Hana Kim",
    title: "Product Lead, Vela",
    lines: [
      "“Six months in and I still notice the craft.",
      "The small stuff is right, so I trust the big",
      "stuff. That trust is the whole product.”",
    ],
    grad: ["#ffd3a5", "#fd9a9a"],
  },
];
const COUNT = PEOPLE.length;

/* Motion — barely-there. A near-critical spring gives a whisper of settle, the
   line stagger does the "delay magic". Marketing surface, so a hair over the
   chrome ceiling is allowed, but we keep it restrained. */
const SPRING = { stiffness: 200, damping: 26, mass: 1 };
const DIST = 22; // px the quote slides in/out sideways
const ENTER = 0.16; // progress at which the first incoming line starts
const LINE_STAGGER = 0.07; // per-line delay (progress units)
const LINE_DUR = 0.6; // each line's own travel

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

export function Testimonials({ initialActive = 0 }: { initialActive?: number }) {
  const [active, setActive] = useState(initialActive);
  // The previous quote, kept mounted so it can slide out as the new one enters.
  const [outgoing, setOutgoing] = useState<{ index: number; dir: 1 | -1 } | null>(
    null,
  );

  const activeRef = useRef(initialActive);
  const prevRef = useRef(-1); // -1 = nothing to collapse (first paint)
  const dirRef = useRef<1 | -1>(1);

  const outRef = useRef<HTMLQuoteElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const avatarRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const widths = useRef<number[]>(new Array(COUNT).fill(0));

  const paintRef = useRef<() => void>(() => {});
  const spring = useSpring(1, () => paintRef.current(), SPRING);

  // One paint reads the spring and writes every layer straight to the DOM.
  // t: 0 → 1 over a single selection change (open at rest = 1).
  const paint = useCallback(() => {
    const t = spring.current();
    const tc = clamp01(t);
    const dir = dirRef.current;
    const a = activeRef.current;
    const prev = prevRef.current;

    // Outgoing quote — the whole block drifts out toward -dir and fades.
    const out = outRef.current;
    if (out) {
      const e = seg(t, 0, 0.5);
      out.style.opacity = String(1 - e);
      out.style.transform = `translateX(${-dir * DIST * e}px)`;
      out.style.filter = e > 0 ? `blur(${e * 3}px)` : "none";
    }

    // Incoming quote — each line slides in from +dir on its own delayed beat.
    const lines = lineRefs.current;
    for (let i = 0; i < lines.length; i++) {
      const el = lines[i];
      if (!el) continue;
      const l = seg(t, ENTER + i * LINE_STAGGER, ENTER + i * LINE_STAGGER + LINE_DUR);
      el.style.opacity = String(l);
      el.style.transform = `translateX(${dir * DIST * (1 - l)}px)`;
      el.style.filter = l < 1 ? `blur(${(1 - l) * 3}px)` : "none";
    }

    // Avatar row — the active pfp swells a touch and its name/title panel
    // expands; the one we just left collapses in step. All from one spring.
    for (let i = 0; i < COUNT; i++) {
      const open = i === a ? tc : i === prev ? 1 - tc : i === a ? 1 : 0;
      const panel = panelRefs.current[i];
      if (panel) panel.style.width = `${widths.current[i] * open}px`;
      const measure = measureRefs.current[i];
      if (measure) {
        const o =
          i === a ? seg(t, 0.35, 1) : i === prev ? 1 - seg(t, 0, 0.5) : 0;
        measure.style.opacity = String(o);
      }
      const av = avatarRefs.current[i];
      if (av) av.style.transform = `scale(${mix(1, 1.06, open)})`;
    }
  }, [spring]);

  const measure = useCallback(() => {
    for (let i = 0; i < COUNT; i++) {
      const m = measureRefs.current[i];
      // The inner is inline-block, so its bounding box is the full natural
      // width including BOTH paddings (scrollWidth would drop the right one).
      if (m) widths.current[i] = Math.ceil(m.getBoundingClientRect().width);
    }
  }, []);

  const select = useCallback(
    (i: number) => {
      if (i === activeRef.current) return;
      const prev = activeRef.current;
      const dir: 1 | -1 = i > prev ? 1 : -1;
      prevRef.current = prev;
      dirRef.current = dir;
      activeRef.current = i;
      setOutgoing({ index: prev, dir });
      setActive(i);

      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        spring.jump(1);
      } else {
        spring.jump(0);
        spring.set(1);
      }

      // Keep the freshly-expanded avatar in view when the row has to scroll
      // (mobile). Wait a frame so the panel has started widening.
      requestAnimationFrame(() => {
        avatarRefs.current[i]?.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          inline: "center",
          block: "nearest",
        });
      });
    },
    [spring],
  );

  // Measure natural panel widths, wire paint, keep both fresh on resize.
  useEffect(() => {
    paintRef.current = paint;
    measure();
    paint();
    // First measure can size to the fallback font; re-measure once Inter
    // settles so a title is never clipped by an under-sized panel.
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        measure();
        paint();
      });
    }
    const onResize = () => {
      measure();
      paint();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paint, measure]);

  const current = PEOPLE[active];
  const out = outgoing ? PEOPLE[outgoing.index] : null;

  return (
    <section className="force-light flex min-h-screen items-center justify-center bg-background px-6">
      <a
        href="/"
        className="absolute left-6 top-6 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-secondary sm:left-10 sm:top-10"
      >
        ← Playground
      </a>

      <div className="w-full min-w-0 max-w-[680px] rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="text-[13px] font-medium text-text-tertiary">{BRAND}</div>

        {/* Quote area — the current quote sits in flow (so the card height
            adapts to however the copy wraps on any screen); the outgoing one
            overlays it and slides away. */}
        <div className="relative mt-6">
          {out && (
            <blockquote
              ref={outRef}
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 text-[19px] font-medium leading-snug tracking-tight text-foreground sm:text-[26px]"
            >
              {out.lines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </blockquote>
          )}
          <blockquote className="relative z-10 text-[19px] font-medium leading-snug tracking-tight text-foreground sm:text-[26px]">
            {current.lines.map((line, i) => (
              <span
                key={i}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                className="block will-change-transform"
              >
                {line}
              </span>
            ))}
          </blockquote>
        </div>

        {/* Avatar row — click to expand name + title. Scrolls horizontally
            when it can't all fit (mobile); the active one is kept in view. */}
        <div className="mt-8 -m-1 min-w-0 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center">
            {PEOPLE.map((p, i) => (
            <div key={p.name} className="flex items-center">
              <button
                ref={(el) => {
                  avatarRefs.current[i] = el;
                }}
                type="button"
                onClick={() => select(i)}
                aria-pressed={i === active}
                aria-label={`${p.name}, ${p.title}`}
                className={`relative grid size-11 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white ring-2 transition-[box-shadow] duration-fast ease-out will-change-transform focus-visible:outline-none focus-visible:ring-primary active:scale-90 ${
                  i === active
                    ? "z-10 ring-primary ring-offset-2 ring-offset-card"
                    : "z-0 ring-card hover:ring-border-strong"
                } ${i > 0 ? "-ml-3" : ""}`}
                style={{
                  background: `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})`,
                }}
              >
                <span className="mix-blend-overlay">{initials(p.name)}</span>
              </button>

              <div
                ref={(el) => {
                  panelRefs.current[i] = el;
                }}
                className="overflow-hidden"
                style={{ width: i === active ? undefined : 0 }}
              >
                <div
                  ref={(el) => {
                    measureRefs.current[i] = el;
                  }}
                  className="inline-block whitespace-nowrap pl-3 pr-8"
                  style={{ opacity: i === active ? 1 : 0 }}
                >
                  <div className="text-[13px] font-semibold leading-tight text-foreground">
                    {p.name}
                  </div>
                  <div className="text-[11px] leading-tight text-text-secondary">
                    {p.title}
                  </div>
                </div>
              </div>
            </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
