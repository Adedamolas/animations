"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/* ── The choreography, in scroll-progress space (p: 0 → 1) ──────────────────
   A tall track pins a 3D stage. As you scroll, three tilted cyanotype cards
   drop in from ABOVE the viewport, growing the whole way (the "coming toward
   me" illusion), sink to the bottom, rise back to centre, then un-stack into a
   row and flip to their backs. */
const CARD_W = 264;
const CARD_H = 360;

// Growth + vertical path keypoints.
const GROW_END = 0.8; // scale reaches full here
const DESCEND_END = 0.4; // top → bottom
const ASCEND_END = 0.8; // bottom → centre
const UNSTACK = [0.8, 0.98] as const; // cascade → spread row
const FLIP = [0.84, 1] as const; // reveal the backs

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type CardDef = {
  theme: string;
  bg: string; // cyanotype blue
  off: { x: number; y: number; z: number }; // cascade offset (at full scale)
  tilt: number; // left lean, degrees
  z: number; // paint order
  shape: "leaf" | "star" | "orb";
  tags: string[];
};

// Front-to-back: the lily-of-the-valley card sits front/bottom-left.
const CARDS: CardDef[] = [
  {
    theme: "Design",
    bg: "radial-gradient(120% 100% at 30% 20%, #17427f, #0b2a5a 55%, #071d40)",
    off: { x: -78, y: 86, z: 60 },
    tilt: -13,
    z: 30,
    shape: "leaf",
    tags: ["ui", "ux", "prototype", "human", "flow", "systems", "interaction", "wireframe", "tokens", "a11y", "research"],
  },
  {
    theme: "Photography",
    bg: "radial-gradient(120% 100% at 60% 25%, #1a4a86, #103a6f 55%, #0a2a55)",
    off: { x: 4, y: 0, z: 0 },
    tilt: -6,
    z: 20,
    shape: "star",
    tags: ["light", "frame", "moment", "composition", "texture", "contrast", "exposure", "aperture", "raw", "grading", "lens"],
  },
  {
    theme: "Development",
    bg: "radial-gradient(120% 100% at 45% 30%, #123f78, #0a2c58 55%, #06203f)",
    off: { x: 84, y: -84, z: -60 },
    tilt: -1,
    z: 10,
    shape: "orb",
    tags: ["html", "css", "javascript", "frontend", "microinteractions", "motion", "gsap", "webgl", "performance", "canvas", "shader"],
  },
];

// ── ASCII art generator — maps a shape field to a character ramp ────────────
const RAMP = "  ...::;;+=xX8#";
function asciiArt(rows: number, cols: number, shape: CardDef["shape"], seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 8) & 0xffff) / 0x10000;
  };
  const field = (nx: number, ny: number): number => {
    const r = Math.hypot(nx, ny);
    const a = Math.atan2(ny, nx);
    if (shape === "orb") return 1 - r + Math.sin(nx * 6) * 0.08;
    if (shape === "star") {
      const pts = 5;
      const k = 0.55 + 0.45 * Math.cos(pts * a);
      return (k - r) * 1.6 + 0.35;
    }
    // leaf: a pointed vertical almond
    const leaf = 1 - Math.hypot(nx * 2.1, ny * 0.9);
    return leaf + Math.sin(ny * 5) * 0.05;
  };
  let out = "";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const nx = (x / (cols - 1)) * 2 - 1;
      const ny = (y / (rows - 1)) * 2 - 1;
      const v = clamp01(field(nx, ny) + (rnd() - 0.5) * 0.14);
      out += RAMP[Math.floor(v * (RAMP.length - 1))];
    }
    out += "\n";
  }
  return out;
}

// ── Cyanotype front motif ───────────────────────────────────────────────────
function Motif({ shape }: { shape: CardDef["shape"] }) {
  const common = { fill: "none", stroke: "rgba(233,242,255,0.82)", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 200 260" className="absolute inset-0 h-full w-full" aria-hidden>
      {shape === "leaf" && (
        <g {...common}>
          <path d="M100 232 C100 150 100 96 100 60" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <ellipse cx={100 - 22} cy={80 + i * 30} rx="12" ry="7" transform={`rotate(-32 ${100 - 22} ${80 + i * 30})`} />
              <ellipse cx={100 + 22} cy={92 + i * 30} rx="12" ry="7" transform={`rotate(32 ${100 + 22} ${92 + i * 30})`} />
            </g>
          ))}
          <path d="M70 236 C88 214 112 214 130 236" />
        </g>
      )}
      {shape === "star" && (
        <g {...common}>
          <circle cx="100" cy="120" r="52" />
          <circle cx="100" cy="120" r="30" />
          <circle cx="100" cy="120" r="10" fill="rgba(233,242,255,0.82)" />
          <path d="M100 40 L100 20 M160 120 L182 120 M100 200 L100 222 M40 120 L18 120" />
        </g>
      )}
      {shape === "orb" && (
        <g {...common}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx="100" cy="120" rx="58" ry="22" transform={`rotate(${i * 30} 100 120)`} />
          ))}
        </g>
      )}
    </svg>
  );
}

export function CardFlight({ previewP }: { previewP?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hintRef = useRef<HTMLDivElement>(null);

  const asciis = useMemo(
    () => CARDS.map((c, i) => asciiArt(15, 30, c.shape, 1000 + i * 77)),
    [],
  );

  const paint = useCallback(
    (p: number) => {
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const s = mix(0.32, 1, easeOut(seg(p, 0, GROW_END)));

      // Vertical path: above-top → bottom → centre → hold.
      let gy: number;
      if (p < DESCEND_END) gy = mix(-vh * 0.66, vh * 0.4, easeInOut(seg(p, 0, DESCEND_END)));
      else if (p < ASCEND_END) gy = mix(vh * 0.4, 0, easeInOut(seg(p, DESCEND_END, ASCEND_END)));
      else gy = 0;

      const u = easeOut(seg(p, UNSTACK[0], UNSTACK[1]));
      const f = easeInOut(seg(p, FLIP[0], FLIP[1]));
      const spread = Math.min(300, (typeof window !== "undefined" ? window.innerWidth : 1200) * 0.3);

      for (let i = 0; i < CARDS.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const c = CARDS[i];
        const stackX = c.off.x * s;
        const stackY = gy + c.off.y * s;
        const stackZ = c.off.z * s;
        const rowX = (i - 1) * spread;
        const x = mix(stackX, rowX, u);
        const y = mix(stackY, 0, u);
        const z = mix(stackZ, 0, u);
        const tilt = mix(c.tilt, 0, u);
        el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateZ(${tilt}deg) rotateY(${f * 180}deg) scale(${s})`;
        el.style.zIndex = String(f > 0.5 ? 100 - c.z : c.z);
      }

      if (hintRef.current) hintRef.current.style.opacity = String(clamp01(1 - p * 6));
    },
    [],
  );

  useEffect(() => {
    // Preview mode: paint a fixed progress and skip the scroll wiring.
    if (previewP !== undefined) {
      paint(previewP);
      return;
    }
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const dist = track.offsetHeight - window.innerHeight;
        paint(clamp01(-rect.top / Math.max(1, dist)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [paint, previewP]);

  return (
    <div ref={trackRef} className="relative" style={{ height: previewP !== undefined ? "100vh" : "360vh" }}>
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden" style={{ perspective: "1300px" }}>
        {/* faint kicker */}
        <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-text-tertiary">Selected craft</p>
        </div>

        <div className="relative" style={{ transformStyle: "preserve-3d" }}>
          {CARDS.map((c, i) => (
            <div
              key={c.theme}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="absolute left-1/2 top-1/2 will-change-transform"
              style={{
                width: CARD_W,
                height: CARD_H,
                marginLeft: -CARD_W / 2,
                marginTop: -CARD_H / 2,
                transformStyle: "preserve-3d",
              }}
            >
              {/* FRONT — cyanotype */}
              <div
                className="absolute inset-0 overflow-hidden rounded-[20px] border border-white/10 [backface-visibility:hidden]"
                style={{ background: c.bg }}
              >
                <Motif shape={c.shape} />
                <div
                  className="absolute inset-x-0 bottom-0 h-24"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.35), transparent)" }}
                />
                <div className="absolute bottom-4 left-5 text-[13px] font-medium tracking-wide text-white/90">
                  {c.theme}
                </div>
              </div>

              {/* BACK — light card, ASCII + skill chips */}
              <div
                className="absolute inset-0 overflow-hidden rounded-[20px] border border-border bg-card [backface-visibility:hidden]"
                style={{ transform: "rotateY(180deg)" }}
              >
                <pre className="mt-4 select-none text-center text-[7px] leading-[7px] tracking-[0.12em] text-primary/70" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
                  {asciis[i]}
                </pre>
                <div className="mt-3 flex flex-wrap gap-1.5 px-4">
                  {c.tags.map((t) => (
                    <span key={t} className="rounded-sm bg-surface-2 px-2 py-0.5 text-[11px] text-text-secondary">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div ref={hintRef} className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-[12px] font-medium tracking-wide text-text-tertiary">
          Scroll ↓
        </div>
      </div>
    </div>
  );
}
