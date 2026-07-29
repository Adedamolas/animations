"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";
import { clamp01 } from "@/lib/math";

const DEFAULT_VALUE = "$5,000.20";
const NUM_CLASS =
  "text-[46px] font-semibold tracking-tight tabular-nums leading-none text-foreground";

/* Shard grid over the balance. Small blocks → it reads as shattered glass. */
const COLS = 16;
const ROWS = 4;

/* One spring drives everything. h: 0 = shown/assembled, 1 = hidden/shattered.
   Smooth, barely any bounce — the shimmer sweep should feel like a wipe. */
const SPRING = { stiffness: 120, damping: 22, mass: 1 };
/* How far behind the shimmer front a shard fully breaks (fraction of width). */
const TRAIL = 0.42;

const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

// Deterministic per-shard randomness (stable across renders / SSR).
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Shard = {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number; // center x, for the sweep timing
  dx: number; // scatter target
  dy: number;
  rot: number;
};

export function HiddenBalance({ initialHidden = false }: { initialHidden?: boolean }) {
  const [hidden, setHidden] = useState(initialHidden);
  const hiddenRef = useRef(initialHidden);
  hiddenRef.current = hidden;

  // The balance is editable — any value still shatters, because the shard grid
  // is measured off whatever number is currently rendered.
  const [value, setValue] = useState(DEFAULT_VALUE);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_VALUE);

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const realRef = useRef<HTMLDivElement>(null);
  const tilesWrapRef = useRef<HTMLDivElement>(null);
  const shimmerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Build the shard grid once we know the balance's rendered size.
  const shards = useMemo<Shard[]>(() => {
    if (!box) return [];
    const tw = box.w / COLS;
    const th = box.h / ROWS;
    const rnd = mulberry32(0x51ade);
    const out: Shard[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * tw;
        const cx = x + tw / 2;
        // Explode outward from center-x, always drift downward a little.
        const dir = cx < box.w / 2 ? -1 : 1;
        out.push({
          x,
          y: r * th,
          w: tw,
          h: th,
          cx,
          // Kept small + centered so shards stay around the balance line and
          // never reach the buttons below.
          dx: dir * (12 + rnd() * 30),
          dy: (rnd() - 0.5) * 30,
          rot: (rnd() - 0.5) * 52,
        });
      }
    }
    return out;
  }, [box]);
  const shardsRef = useRef<Shard[]>(shards);
  shardsRef.current = shards;

  const paintRef = useRef<() => void>(() => {});
  const spring = useSpring(initialHidden ? 1 : 0, () => paintRef.current(), SPRING);

  const paint = useCallback(() => {
    const h = clamp01(spring.current());
    const b = box;
    if (!b) return;
    const span = b.w * TRAIL;
    // Sweep the front PAST the right edge by `span` so the last shards get the
    // full break too — otherwise the trailing digits never shatter.
    const front = h * (b.w + span);

    // Real number crossfades out the instant shards take over (identical then,
    // so the swap is invisible), and back in on the way home.
    const realO = 1 - seg(h, 0, 0.06);
    if (realRef.current) realRef.current.style.opacity = String(realO);
    if (tilesWrapRef.current)
      tilesWrapRef.current.style.opacity = String(seg(h, 0, 0.06));

    const sh = shardsRef.current;
    for (let i = 0; i < sh.length; i++) {
      const el = tileRefs.current[i];
      if (!el) continue;
      const s = sh[i];
      // Local break progress: 0 until the front reaches this shard, then it
      // breaks over `span`. This is what makes the shatter chase the shimmer.
      const l = clamp01((front - s.cx) / span);
      const drift = l * l; // ease-in — clings, then lets go
      el.style.transform = `translate(${s.dx * drift}px, ${s.dy * drift}px) rotate(${s.rot * drift}deg) scale(${1 - 0.28 * l})`;
      // Stay clearly visible even fully scattered — the shards ARE the point.
      el.style.opacity = String(1 - 0.2 * l);
      // Just a whisper of blur as each one breaks, gone once it's a shard.
      el.style.filter = l > 0 && l < 1 ? `blur(${Math.sin(l * Math.PI) * 1}px)` : "none";
    }

    // Shimmer band rides the front; fades in and out at the extremes.
    const shimmer = shimmerRef.current;
    if (shimmer) {
      shimmer.style.transform = `translateX(${front - b.w / 2}px)`;
      shimmer.style.opacity = String(
        Math.min(seg(h, 0.02, 0.16), 1 - seg(h, 0.84, 0.99)),
      );
    }
  }, [box, spring]);

  const measure = useCallback(() => {
    const r = realRef.current?.getBoundingClientRect();
    if (r) setBox({ w: r.width, h: r.height });
  }, []);

  const startEdit = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const commit = useCallback(() => {
    setValue((prev) => (draft.trim() ? draft : prev));
    setEditing(false);
  }, [draft]);

  const toggle = useCallback(() => {
    const next = !hiddenRef.current;
    setHidden(next);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) spring.jump(next ? 1 : 0);
    else spring.set(next ? 1 : 0);
  }, [spring]);

  useEffect(() => {
    paintRef.current = paint;
    paint();
  }, [paint]);

  // Measure the balance once (after fonts settle) so the shard grid lines up.
  useEffect(() => {
    measure();
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(measure);
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Re-measure whenever the committed value changes so the shard grid re-fits.
  useEffect(() => {
    measure();
  }, [value, measure]);

  const tw = box ? box.w / COLS : 0;
  const th = box ? box.h / ROWS : 0;

  return (
    <div className="w-full max-w-[380px] rounded-xl border border-border bg-card p-6 shadow-sm">
      {/* Wallet header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-full bg-primary/15 text-[13px] text-primary">
            ◈
          </span>
          <div className="text-[13px] font-medium text-foreground">Main wallet</div>
        </div>
        <span className="rounded-sm border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-text-secondary">
          0x7a3…9762
        </span>
      </div>

      {/* Balance */}
      <div className="mt-6 text-[13px] text-text-secondary">Total balance</div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative inline-block select-none" aria-hidden>
          {/* Real number — defines the box, shown at rest. Sizes to the draft
              while editing so the box (and shards) fit whatever you type. */}
          <div ref={realRef} className={NUM_CLASS}>
            {editing ? draft || " " : value}
          </div>

          {/* Inline editor — an opaque field laid right over the number */}
          {editing && (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label="Balance"
              className={`${NUM_CLASS} absolute inset-0 w-full bg-card outline-none`}
            />
          )}

          {/* Shard layer — copies of the number sliced into a grid */}
          <div
            ref={tilesWrapRef}
            className="pointer-events-none absolute inset-0"
            style={{ opacity: 0 }}
          >
            {shards.map((s, i) => (
              <div
                key={i}
                ref={(el) => {
                  tileRefs.current[i] = el;
                }}
                className="absolute overflow-hidden will-change-transform"
                style={{ left: s.x, top: s.y, width: tw + 1, height: th + 1 }}
              >
                <div
                  className={`absolute ${NUM_CLASS}`}
                  style={{ left: -s.x, top: -s.y, width: box?.w, height: box?.h }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Shimmer band — clipped to the box so nothing bleeds outside */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              ref={shimmerRef}
              className="absolute inset-y-0 left-0 w-1/3"
              style={{
                opacity: 0,
                background:
                  "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.16), transparent)",
                filter: "blur(2px)",
              }}
            />
          </div>
        </div>

        {/* Edit the balance */}
        {!hidden && !editing && (
          <button
            type="button"
            onClick={startEdit}
            aria-label="Edit balance"
            className="grid size-7 shrink-0 place-items-center rounded-md text-text-tertiary transition-[color,transform] duration-[var(--dur-press)] ease-out hover:text-text-secondary active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Pencil />
          </button>
        )}

        {/* Screen-reader truth */}
        <span className="sr-only">
          {hidden ? "Balance hidden" : `Balance ${value}`}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          className="flex-1 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-sm transition-[background-color,transform] duration-[var(--dur-press)] ease-out hover:bg-primary-hover active:scale-[0.97]"
        >
          Deposit
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground shadow-sm transition-[border-color,transform] duration-[var(--dur-press)] ease-out hover:border-border-strong active:scale-[0.97]"
        >
          Withdraw
        </button>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={hidden}
          aria-label={hidden ? "Show balance" : "Hide balance"}
          className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-card text-text-secondary shadow-sm transition-[border-color,color,transform] duration-[var(--dur-press)] ease-out hover:border-border-strong hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {hidden ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </div>
  );
}

function Pencil() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Eye() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.6 6.6A18.5 18.5 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 3.4-.65M14.1 14.1a3 3 0 1 1-4.2-4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}
