"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";
import {
  type Mode,
  PANEL_W,
  LOGIN_H,
  SIGNUP_H,
  NAME_INNER,
  PILL_W,
  PILL_H,
  X_SIZE,
  X_INSET,
  RADIUS_OPEN,
  DROP_SIZE,
  DROP_AT,
  OPEN_SPRING,
  MODE_SPRING,
  RIDE_X,
  RIDE_Y,
  OPEN_LAG,
  HEIGHT_LAG,
  LAG_MAX,
  ROWS,
  mix,
  clamp,
  clamp01,
  seg,
  through3,
} from "./geometry";
import { PanelContent } from "./panel-content";
import { MorphPill } from "./morph-pill";

export function LiquidSignup({
  defaultOpen = false,
  defaultMode = "signup",
}: {
  defaultOpen?: boolean;
  defaultMode?: Mode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<Mode>(defaultMode);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nameRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const prevP = useRef(defaultOpen ? 1 : 0);
  const prevH = useRef(defaultMode === "signup" ? SIGNUP_H : LOGIN_H);
  const paintRef = useRef<() => void>(() => {});

  const openSpring = useSpring(
    defaultOpen ? 1 : 0,
    () => paintRef.current(),
    OPEN_SPRING,
  );
  const modeSpring = useSpring(
    defaultMode === "signup" ? 1 : 0,
    () => paintRef.current(),
    MODE_SPRING,
  );

  // One paint reads both springs and writes every layer straight to the DOM —
  // React never re-renders during the morph. p = open progress (0 pill → 1
  // panel), m = mode progress (0 login → 1 signup). Both can overshoot.
  const paint = useCallback(() => {
    const p = openSpring.current();
    const m = modeSpring.current();
    const pc = clamp01(p);
    const mc = clamp01(m);

    // Live panel height from the mode spring (bouncy — can overshoot).
    const liveH = mix(LOGIN_H, SIGNUP_H, m);
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.style.height = `${liveH}px`;

    // Velocities → jelly. Combine the open morph and the height bounce.
    const vP = p - prevP.current;
    prevP.current = p;
    const vH = liveH - prevH.current;
    prevH.current = liveH;
    const lag = clamp(-vP * OPEN_LAG - vH * HEIGHT_LAG, -LAG_MAX, LAG_MAX);

    // Surface — the droplet. width/height/radius each travel through the
    // circle stage; overshoot is a gentle multiplicative breath shared with
    // the content, so surface + text expand and settle as one body.
    const surface = surfaceRef.current;
    if (surface) {
      const over = p - pc;
      const w = Math.max(
        through3(pc, PILL_W, DROP_SIZE, PANEL_W, DROP_AT) * (1 + over * RIDE_X),
        14,
      );
      const h = Math.max(
        through3(pc, PILL_H, DROP_SIZE, liveH, DROP_AT) * (1 + over * RIDE_Y),
        8,
      );
      const r = clamp(
        through3(pc, PILL_H / 2, DROP_SIZE / 2, RADIUS_OPEN, DROP_AT),
        0,
        Math.min(w, h) / 2,
      );
      const sx = w / PANEL_W;
      const sy = h / liveH;
      surface.style.transform = `scaleX(${sx}) scaleY(${sy})`;
      surface.style.borderRadius = `${r / sx}px / ${r / sy}px`;
    }

    // Content — mode crossfades via --m; the open morph rides its scale.
    const content = contentRef.current;
    if (content) {
      content.style.setProperty("--m", String(mc));
      const grow = mix(0.92, 1, seg(p, 0.45, 1));
      const over = Math.max(p - 1, 0);
      content.style.transform = `scaleX(${1 + over * RIDE_X - (1 - grow)}) scaleY(${1 + over * RIDE_Y - (1 - grow)})`;
      content.style.visibility = p > 0.05 ? "visible" : "hidden";
    }

    // Name row — signup-only, collapses in login (height + blur, in step with
    // the wrapper's height so nothing else jumps).
    const name = nameRef.current;
    if (name) name.style.height = `${NAME_INNER * clamp(m, 0, 1.12)}px`;

    // Rows — staggered entrance on open + the combined jelly lag.
    for (let i = 0; i < ROWS; i++) {
      const row = rowRefs.current[i];
      if (!row) continue;
      const start = 0.5 + i * 0.045;
      const t = seg(p, start, start + 0.2);
      row.style.opacity = String(t);
      row.style.filter = t < 1 ? `blur(${(1 - t) * 5}px)` : "none";
      row.style.transform = `translateY(${(1 - t) * 14 + lag * (i + 1) * 0.32}px)`;
    }

    // Pill → close-circle morph (unclamped a hair so the ✕ squishes and
    // springs back with the liquid).
    const pill = pillRef.current;
    if (pill) {
      const pu = clamp(p, -0.04, 1.06);
      const w = mix(PILL_W, X_SIZE, pu);
      const h = mix(PILL_H, X_SIZE, pu);
      pill.style.width = `${w}px`;
      pill.style.height = `${h}px`;
      pill.style.borderRadius = `${h / 2}px`;
      pill.style.right = `${mix(0, X_INSET, pc)}px`;
      pill.style.top = `${mix(0, X_INSET, pc)}px`;
    }

    // Label ⇄ ✕ crossfade on the pill.
    const label = labelRef.current;
    if (label) {
      const t = 1 - seg(p, 0.1, 0.45);
      label.style.opacity = String(t);
      label.style.filter = t < 1 ? `blur(${(1 - t) * 3}px)` : "none";
    }
    const icon = iconRef.current;
    if (icon) {
      const t = seg(p, 0.5, 0.85);
      icon.style.opacity = String(t);
      icon.style.filter = t < 1 ? `blur(${(1 - t) * 3}px)` : "none";
    }
  }, [openSpring, modeSpring]);

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (reduced()) openSpring.jump(next ? 1 : 0);
      else openSpring.set(next ? 1 : 0);
    },
    [openSpring],
  );

  const toggleMode = useCallback(() => {
    const next: Mode = mode === "signup" ? "login" : "signup";
    setMode(next);
    if (reduced()) modeSpring.jump(next === "signup" ? 1 : 0);
    else modeSpring.set(next === "signup" ? 1 : 0);
  }, [mode, modeSpring]);

  // First paint + keep paintRef current.
  useEffect(() => {
    paintRef.current = paint;
    paint();
  }, [paint]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenState(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpenState]);

  // SSR initial surface geometry so there's no flash before hydration.
  const H0 = defaultMode === "signup" ? SIGNUP_H : LOGIN_H;
  const s0 = defaultOpen
    ? { sx: 1, sy: 1, rx: RADIUS_OPEN, ry: RADIUS_OPEN }
    : (() => {
        const sx = PILL_W / PANEL_W;
        const sy = PILL_H / H0;
        return { sx, sy, rx: PILL_H / 2 / sx, ry: PILL_H / 2 / sy };
      })();

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute right-6 top-6"
      style={{ width: PANEL_W, height: H0 }}
    >
      {/* The droplet — quietly frosted so it stays glassy over any content */}
      <div
        ref={surfaceRef}
        className="absolute inset-0 origin-top-right border border-border bg-card/85 shadow-xl backdrop-blur-lg will-change-transform"
        style={{
          transform: `scaleX(${s0.sx}) scaleY(${s0.sy})`,
          borderRadius: `${s0.rx}px / ${s0.ry}px`,
        }}
      />

      <PanelContent
        contentRef={contentRef}
        rowRefs={rowRefs}
        nameRef={nameRef}
        open={open}
        onToggleMode={toggleMode}
        defaultOpen={defaultOpen}
        defaultMode={defaultMode}
      />

      <MorphPill
        pillRef={pillRef}
        labelRef={labelRef}
        iconRef={iconRef}
        open={open}
        defaultOpen={defaultOpen}
        onToggle={() => setOpenState(!open)}
      />
    </div>
  );
}
