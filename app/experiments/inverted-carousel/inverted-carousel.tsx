"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";
import { people } from "./data";

/* ── Geometry of the concave ring ──────────────────────────────────────────
   Cards sit on an actual circle of radius RADIUS, each one STEP_DEG further
   around it. Because the path is a real arc (x = R·sinθ, z = R·(cosθ−1)), a
   leaving card curves BACK into depth and turns edge-on instead of sliding off
   the side — it reads as going round to the back of the ring. rotateY = θ so
   each card stays tangent to the circle (the inward, concave lean). */
const RADIUS = 480; // px — radius of the ring the cards ride (wider = more gap)
const STEP_DEG = 36; // deg between adjacent cards → ~282px between neighbours
// Cull just BEFORE a card reaches edge-on (90°/STEP_DEG = 2.5): past 90° a
// face would paint its mirrored backside. 2.45 → dies at 88.2°, a sliver.
const VISIBLE = 2.45;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const N = people.length;
// The ring loops seamlessly as long as cards vanish before they wrap to the
// far side — keep the visible arc inside the half-ring, whatever N is.
const CULL = Math.min(VISIBLE, N / 2 - 0.5);
const INITIAL_ACTIVE = Math.floor(N / 2);

const SPRING = { stiffness: 150, damping: 15, mass: 1 }; // underdamped → overshoot

// Shortest signed distance around the ring for card index `i` at ring position
// `pos` — each card rides its nearest copy and crosses the seam only while culled.
const wrappedOffset = (i: number, pos: number) => {
  const raw = i - pos;
  return raw - N * Math.round(raw / N);
};

type CardGeom = {
  hidden: boolean;
  transform: string;
  zIndex: number;
  scrim: number;
};

// The single source of truth for where a card sits, so server-render and the
// per-frame client update agree exactly.
function cardGeom(offset: number): CardGeom {
  const dist = Math.abs(offset);
  if (dist > CULL) {
    return { hidden: true, transform: "", zIndex: 0, scrim: 0 };
  }
  // Ride the circle: as |offset| grows the card sweeps out along the arc and,
  // past a quarter turn, curls back toward center and deep into z — never
  // reaching the screen edge to "slide off".
  const theta = offset * STEP_DEG * (Math.PI / 180);
  const x = RADIUS * Math.sin(theta);
  const z = RADIUS * (Math.cos(theta) - 1);
  const ry = offset * STEP_DEG; // tangent to the ring (inward lean)
  return {
    hidden: false,
    transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg)`,
    zIndex: Math.round(1000 + z),
    // Cards recede through their scrim, fully dark by the cull edge so a card
    // is invisible before it's hidden (no pop).
    scrim: clamp(dist / CULL, 0, 1),
  };
}

export function InvertedCarousel() {
  // `active` is an UNBOUNDED virtual index — it just keeps counting up/down as
  // you step. The displayed person is active mod N, so the ring never ends.
  const [active, setActive] = useState(INITIAL_ACTIVE);

  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrimRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevPos = useRef(active);

  // Paint every card from a (possibly fractional) ring position. Called each
  // spring frame — writes straight to the DOM, no React re-render.
  const render = useCallback((position: number) => {
    // Bank the whole ring slightly toward travel direction — the extra
    // physical "weight" you feel when it overshoots and rocks back.
    const velocity = position - prevPos.current;
    prevPos.current = position;
    if (stageRef.current) {
      const bank = clamp(velocity * 60, -7, 7);
      stageRef.current.style.transform = `rotateY(${bank}deg)`;
    }

    for (let i = 0; i < N; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      const g = cardGeom(wrappedOffset(i, position));

      if (g.hidden) {
        card.style.visibility = "hidden";
        card.style.pointerEvents = "none";
        continue;
      }
      card.style.visibility = "visible";
      // Every visible card is tappable — the front one advances, the rest
      // travel to themselves (see goToCard).
      card.style.pointerEvents = "auto";
      card.style.transform = g.transform;
      card.style.zIndex = String(g.zIndex);
      const scrim = scrimRefs.current[i];
      if (scrim) scrim.style.opacity = String(g.scrim);
    }
  }, []);

  const spring = useSpring(active, render, SPRING);

  const animateTo = useCallback(
    (target: number) => {
      setActive(target);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduced) spring.jump(target);
      else spring.set(target);
    },
    [spring],
  );

  // Arrows / keys: step one card in a direction (unbounded — loops forever).
  const step = useCallback(
    (dir: 1 | -1) => animateTo(active + dir),
    [active, animateTo],
  );

  // Tapping a card: a side card travels to that person via the shortest way
  // round; the front card just advances to the next one.
  const goToCard = useCallback(
    (i: number) => {
      const cur = ((active % N) + N) % N;
      let delta = (((i - cur) % N) + N) % N; // 0..N-1
      if (delta > N / 2) delta -= N; // take the shorter direction
      animateTo(active + (delta !== 0 ? delta : 1));
    },
    [active, animateTo],
  );

  // Touch swipe (mobile): a horizontal drag steps the ring; swipe left → next.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = touchStart.current;
      touchStart.current = null;
      if (!s) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      // Horizontal intent only, past a comfortable threshold.
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    },
    [step],
  );

  // Initial paint of the ring on mount.
  useEffect(() => {
    spring.jump(active);
    render(active);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: left/right step the ring.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const current = people[((active % N) + N) % N];

  return (
    <div className="flex w-full flex-col items-center">
      {/* Stage — perspective wrapper holds the 3D scene */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative h-[440px] w-full origin-center scale-[0.58] touch-pan-y select-none sm:scale-90 lg:scale-100"
        style={{ perspective: "1500px" }}
      >
        <div
          ref={stageRef}
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
        >
          {people.map((person, i) => {
            // Server-render the ring in place so there's no flash of stacked
            // cards before hydration; the client render() takes over on mount.
            const g = cardGeom(wrappedOffset(i, INITIAL_ACTIVE));
            return (
              <div
                key={person.name}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                onClick={() => goToCard(i)}
                className="absolute left-1/2 top-1/2 h-[252px] w-[280px] cursor-pointer overflow-hidden rounded-[56px] shadow-xl [backface-visibility:hidden] will-change-transform"
                style={{
                  transform: g.transform || undefined,
                  zIndex: g.zIndex,
                  visibility: g.hidden ? "hidden" : "visible",
                  background: `linear-gradient(150deg, ${person.from}, ${person.to})`,
                }}
                aria-label={`${person.name}, ${person.role}`}
              >
                {/* soft studio highlight + vignette to read as a portrait */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(120% 80% at 30% 15%, rgba(255,255,255,0.28), transparent 55%), radial-gradient(140% 120% at 70% 120%, rgba(0,0,0,0.55), transparent 60%)",
                  }}
                />
                {/* initial, standing in for a face */}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[120px] font-semibold text-white/12">
                  {person.name.charAt(0)}
                </span>
                {/* distance scrim — cards recede into shadow */}
                <div
                  ref={(el) => {
                    scrimRefs.current[i] = el;
                  }}
                  className="pointer-events-none absolute inset-0 bg-black"
                  style={{ opacity: g.scrim }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Caption — crossfades in on each step */}
      <div className="mt-2 flex h-[72px] flex-col items-center justify-center text-center">
        <h2
          key={`name-${active}`}
          className="caption-in text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          {current.name}
        </h2>
        <p
          key={`role-${active}`}
          className="caption-in mt-1 text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary"
        >
          {current.role}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-4">
        <ArrowButton direction="left" onClick={() => step(-1)} />
        <ArrowButton direction="right" onClick={() => step(1)} />
      </div>
    </div>
  );
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous" : "Next"}
      className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-text-secondary shadow-sm transition-[background-color,border-color,color,transform] duration-[var(--dur-fast)] ease-out hover:border-border-strong hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ transform: direction === "left" ? "scaleX(-1)" : undefined }}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}
