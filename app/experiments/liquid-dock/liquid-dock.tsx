"use client";

// React overlay for the liquid-glass dock. The WebGL layer (the drifting
// backdrop + the glass dock body) lives in @/lib/liquid-dock/engine.js — this
// owns only the crisp DOM on top: the nav labels and the sliding "active" pill
// that springs directly to the tapped item with a liquid stretch. The dock's
// screen rect comes from the engine so the labels sit exactly on the glass.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSpring } from "@/lib/use-spring";
import { NAV, DOCK } from "@/lib/liquid-dock/config";
import { createDock } from "@/lib/liquid-dock/engine";

const N = NAV.length;
type Rect = { cx: number; cy: number; w: number; h: number };

export function LiquidDock() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createDock> | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const rectsRef = useRef<{ left: number; width: number }[]>([]);
  const lastP = useRef(0);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // paint the active pill from a continuous index value (with travel-stretch)
  const paintPill = (p: number) => {
    const rects = rectsRef.current;
    const el = pillRef.current;
    if (!rects.length || !el) return;
    const c = Math.max(0, Math.min(N - 1, p));
    const i0 = Math.floor(c);
    const i1 = Math.min(i0 + 1, N - 1);
    const f = c - i0;
    const left = rects[i0].left + (rects[i1].left - rects[i0].left) * f;
    const width = rects[i0].width + (rects[i1].width - rects[i0].width) * f;
    const dv = p - lastP.current;
    lastP.current = p;
    const stretch = Math.min(Math.abs(dv) * 2.6, 0.22); // faster travel = more stretch
    el.style.width = `${width}px`;
    el.style.transform = `translateX(${left}px) scaleX(${1 + stretch})`;
  };

  const pill = useSpring(0, paintPill, { stiffness: 320, damping: 26, mass: 1 });

  const measure = () => {
    const items = itemsRef.current;
    if (!items[0]) return;
    rectsRef.current = items.map((b) =>
      b ? { left: b.offsetLeft, width: b.offsetWidth } : { left: 0, width: 0 },
    );
    paintPill(pill.current());
  };

  // boot the engine
  useEffect(() => {
    if (!mountRef.current) return;
    const engine = createDock(mountRef.current, {
      onLayout: (r: Rect) => setRect(r),
      initialIndex: 0,
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // re-measure whenever the dock rect changes (mount / resize)
  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect]);

  // the pill springs STRAIGHT to the target — no scroll, no intermediate stops
  const go = (i: number) => {
    if (i < 0 || i >= N) return;
    setActive(i);
    pill.set(i);
    engineRef.current?.setActive(i);
  };

  // arrow keys cycle the dock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") go(activeRef.current + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") go(activeRef.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeRef = useRef(0);
  activeRef.current = active;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#08090c]">
      {/* WebGL: drifting backdrop + glass dock body */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* the dock DOM: nav labels + sliding active pill (glass body is WebGL) */}
      {rect && (
        <div
          className="absolute z-30"
          style={{
            left: rect.cx,
            top: rect.cy,
            width: rect.w,
            height: rect.h,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="relative flex h-full items-center justify-between"
            style={{ paddingLeft: DOCK.padX, paddingRight: DOCK.padX }}
          >
            {/* active pill (behind the labels) */}
            <div
              ref={pillRef}
              className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white/16 ring-1 ring-white/20"
              style={{ height: rect.h - 16, willChange: "transform, width" }}
            />
            {NAV.map((label, i) => (
              <button
                key={label}
                ref={(el) => {
                  itemsRef.current[i] = el;
                }}
                type="button"
                onClick={() => go(i)}
                className="relative z-10 px-2 text-[13px] font-medium tracking-tight text-white transition-opacity duration-200"
                style={{
                  opacity: active === i ? 1 : 0.6,
                  textShadow: "0 1px 6px rgba(0,0,0,0.4)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
