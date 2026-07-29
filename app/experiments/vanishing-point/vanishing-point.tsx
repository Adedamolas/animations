"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLenis, setInfiniteScroll } from "@/components/smooth-scroll";
import { clamp01 } from "@/lib/math";
import { GRAIN, N, PAGE, SCENES, type Scene } from "./scenes";
import {
  CYCLE,
  STEP,
  Z_HANDOVER,
  flightTransform,
  isOffscreen,
  localBlur,
  measureGeometry,
  rowLeft,
  scaleAt,
  smear,
  stackAt,
  stepOf,
  type Geo,
} from "./conveyor";
import { isHome, newFlight, settle, stepFlight } from "./flight";
import { Piece } from "./piece";

/* ── Vanishing point ───────────────────────────────────────────────────────
   A row of square posters receding toward a point just off the bottom-left.

   Scroll and the whole arrangement performs one continuous homothety about
   that point: every plate slides left and shrinks by the same ratio at the
   same time, so the composition — cadence, overlap, spacing — is self-similar
   at any offset. The geometry lives in `conveyor.ts`; this file owns the
   frame loop, the focus state and the chrome.

   The loop is endless: the page track is exactly one cycle tall and Lenis runs
   in `infinite` mode, so the scroll wraps at the seam while the plates — which
   repeat on the same period — never notice.

   Nothing is dragged. The scroll position IS the position, so a flick sends
   the row gliding on Lenis' easing and lands it.

   Click any plate and it leaves the row for the centre of the screen while the
   rest fall out of focus behind it. */

export function VanishingPoint({ previewPos }: { previewPos?: number }) {
  const plateRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nameRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);

  const pos = useRef(previewPos ?? 0);
  const vel = useRef(0);
  const hintDone = useRef(false);
  /** live scale of each plate, so the defocus blur can be sized in screen px */
  const scales = useRef<number[]>(new Array(N).fill(1));
  const geo = useRef<Geo>(measureGeometry(1440, 900));

  const [focus, setFocus] = useState<number | null>(null);
  // The info block keeps the last plate's copy so it can fade out with its
  // text intact instead of emptying the moment you close it.
  const [info, setInfo] = useState<{ i: number; scene: Scene } | null>(null);
  const focusRef = useRef<number | null>(null);
  /** the plate currently off the rail — held until it has fully flown home */
  const flyRef = useRef<number | null>(null);
  const flight = useRef(newFlight());

  const measure = useCallback(() => {
    const g = measureGeometry(window.innerWidth, window.innerHeight);
    geo.current = g;
    for (const el of plateRefs.current) {
      if (!el) continue;
      el.style.width = `${g.w}px`;
      el.style.height = `${g.w}px`;
      el.style.top = `${g.vy - g.w}px`;
    }
  }, []);

  /* Depth of field is set once per focus change, not per frame: the row is
     frozen while a plate is out, so CSS can ease the blur on its own. */
  const applyDepth = useCallback((idx: number | null) => {
    plateRefs.current.forEach((el, i) => {
      if (!el) return;
      const sharp = idx === null || i === idx;
      el.style.filter = sharp ? "blur(0px)" : `blur(${localBlur(scales.current[i] || 1).toFixed(2)}px)`;
      el.style.opacity = sharp ? "1" : "0.45";
    });
    // The scrim paints nothing — a wash in the page colour only ever read as
    // dimming because it sat ON the plates, and anything sitting on the plates
    // fights the returning one for stacking order. The blur above does that
    // work now; this is left as the click-anywhere-to-close target.
    if (scrimRef.current) {
      scrimRef.current.style.pointerEvents = idx === null ? "none" : "auto";
    }
  }, []);

  const paint = useCallback(() => {
    const g = geo.current;
    const p = pos.current;
    const v = vel.current;
    const fly = flyRef.current;
    const t = flight.current.u; // the spring value IS the curve — no easing on top
    const stretch = smear(v, t);
    const vw = window.innerWidth;

    let bestStep = Infinity;
    let focal = 0;

    for (let i = 0; i < N; i++) {
      const el = plateRefs.current[i];
      if (!el) continue;

      const step = stepOf(i, p);
      const s = scaleAt(step);
      scales.current[i] = s;
      const left = rowLeft(g, s, v);

      // Stays "flying" for the whole round trip, including the settle, where
      // the parameter dips just below zero on its way back to rest.
      const flying = i === fly;
      if (!flying && isOffscreen(g, left, s, vw)) {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";

      const { x, y, sc } = flying
        ? flightTransform(g, left, s, t)
        : { x: left, y: 0, sc: s };

      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sc * (1 + stretch)}, ${sc * (1 - stretch * 0.5)})`;
      /* Hand the stacking order back EARLY on the way home — while the plate
         is still out in open space, moving at speed, with nothing overlapping
         it. Held to the end instead, the neighbour's edge snaps over it on the
         last frame, after the settle, with the eye parked right there. Below
         the threshold the plate slides into its slot already correctly
         ordered, so the occlusion returns gradually, as geometry. */
      el.style.zIndex =
        flying && (focusRef.current !== null || t > Z_HANDOVER)
          ? "6000"
          : String(stackAt(step));

      const near = Math.abs(step);
      if (near < bestStep) {
        bestStep = near;
        focal = i;
      }
    }

    const chrome = clamp01(1 - t);
    if (nameRef.current) {
      nameRef.current.textContent = SCENES[focal].name;
      nameRef.current.style.opacity = String(clamp01(1 - bestStep * 1.7) * chrome);
      nameRef.current.style.transform = `translate3d(0, ${(-v * 26).toFixed(2)}px, 0)`;
    }
    if (countRef.current) {
      countRef.current.textContent = `${String(focal + 1).padStart(2, "0")} / ${N}`;
      countRef.current.style.opacity = String(chrome);
    }
    if (barRef.current) {
      barRef.current.style.transform = `scaleX(${clamp01(p / N)})`;
    }
    if (hintRef.current) {
      if (p > 0.3) hintDone.current = true;
      hintRef.current.style.opacity = hintDone.current ? "0" : String(chrome);
    }
  }, []);

  /* Endless page scroll, for as long as this experiment is mounted. */
  useEffect(() => {
    setInfiniteScroll(true);
    return () => setInfiniteScroll(false);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);

    let raf = 0;
    let prev = pos.current;
    let last = 0;
    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;

      const held = focusRef.current !== null;
      // The row stays parked for the whole round trip, not just while a plate
      // is out — so it lands back in the exact slot it left.
      if (previewPos === undefined && flyRef.current === null) {
        const lenis = getLenis();
        pos.current = (lenis ? lenis.scroll : window.scrollY) / STEP;
      }

      // Velocity off the smoothed position, so it inherits Lenis' easing — it
      // builds and releases with the scroll instead of spiking. The delta is
      // wrapped too, or the loop seam would register as one huge flick.
      let dp = pos.current - prev;
      if (dp > N / 2) dp -= N;
      else if (dp < -N / 2) dp += N;
      vel.current += (dp - vel.current) * 0.25;
      prev = pos.current;

      if (flyRef.current !== null) {
        stepFlight(flight.current, held ? 1 : 0, dt);
        if (!held && isHome(flight.current)) {
          settle(flight.current);
          flyRef.current = null; // back on the rail, scrolling resumes
          getLenis()?.start();
        }
      }

      paint();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      // Leaving mid-focus must not strand the page with scrolling switched off.
      getLenis()?.start();
    };
  }, [measure, paint, previewPos]);

  const open = useCallback(
    (i: number) => {
      if (focusRef.current !== null) return;
      // one plate is off the rail at a time; let a returning one finish
      if (flyRef.current !== null && flyRef.current !== i) return;
      flyRef.current = i;
      focusRef.current = i;
      setFocus(i);
      setInfo({ i, scene: SCENES[i] });
      applyDepth(i);
      getLenis()?.stop();
    },
    [applyDepth],
  );

  // The flight home keeps running after this — the loop clears flyRef and
  // releases the scroll on landing.
  const close = useCallback(() => {
    if (focusRef.current === null) return;
    focusRef.current = null;
    setFocus(null);
    applyDepth(null);
  }, [applyDepth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const shown = focus !== null;

  return (
    <>
      {/* the scroll track — exactly one lap, wrapped by Lenis */}
      <div aria-hidden style={{ height: `calc(100vh + ${CYCLE}px)` }} />

      <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ background: PAGE }}>
        <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.055 }} />

        {SCENES.map((sc, i) => (
          <div
            key={sc.name}
            ref={(el) => {
              plateRefs.current[i] = el;
            }}
            onClick={() => (focusRef.current === null ? open(i) : close())}
            className="pointer-events-auto absolute left-0 cursor-pointer overflow-hidden rounded-[3px] will-change-transform"
            style={{
              width: 400,
              height: 400,
              transformOrigin: "0 100%",
              visibility: "hidden",
              filter: "blur(0px)",
              boxShadow: "-34px 10px 70px -24px rgba(48,36,24,0.34)",
              transition: "filter 420ms var(--ease-out), opacity 420ms var(--ease-out)",
            }}
          >
            {/* the ground */}
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(168deg, ${sc.ground[0]} 0%, ${sc.ground[1]} 100%)` }}
            />

            {/* the composition */}
            {sc.shapes.map((s, k) => (
              <Piece key={k} s={s} />
            ))}

            <div
              className="absolute inset-0"
              style={{ backgroundImage: GRAIN, opacity: 0.09, mixBlendMode: "overlay" }}
            />
            <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 80px rgba(0,0,0,0.13)" }} />
          </div>
        ))}

        {/* click anywhere to send the plate home */}
        <div ref={scrimRef} onClick={close} className="absolute inset-0 z-4000" style={{ pointerEvents: "none" }} />

        {/* the plate nearest the focal step names itself */}
        <div className="absolute left-6 top-6 sm:left-10 sm:top-10">
          <div ref={countRef} className="mb-1.5 font-mono text-[11px] tracking-[0.22em] text-[#8d8880]" />
          <div
            ref={nameRef}
            className="text-[26px] font-medium leading-none tracking-[-0.02em] text-[#211f1c] sm:text-[34px]"
            style={{ willChange: "transform" }}
          />
        </div>

        <div className="absolute right-6 top-8 text-right sm:right-10 sm:top-11">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#8d8880]">Vanishing point</div>
        </div>

        {/* cycle hairline */}
        <div className="absolute left-0 right-0 top-0 h-px bg-[#211f1c]/8">
          <div ref={barRef} className="h-px origin-left bg-[#211f1c]/45" style={{ transform: "scaleX(0)" }} />
        </div>

        <div
          ref={hintRef}
          className="absolute bottom-5 left-6 font-mono text-[11px] tracking-[0.2em] text-[#8d8880] sm:left-10"
        >
          SCROLL ↓ &nbsp;·&nbsp; CLICK A PLATE
        </div>

        {/* info for the plate that stepped out */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-7000 flex flex-col items-center px-6 pb-9 text-center sm:pb-12"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? "translate3d(0,0,0)" : "translate3d(0,16px,0)",
            transition: "opacity 380ms var(--ease-out), transform 380ms var(--ease-out)",
            transitionDelay: shown ? "260ms" : "0ms", // arrives as the plate lands
          }}
        >
          <div className="mb-2 font-mono text-[11px] tracking-[0.22em] text-[#8d8880]">
            {info ? `${String(info.i + 1).padStart(2, "0")} / ${N}` : ""}
          </div>
          <div className="text-[30px] font-medium leading-none tracking-[-0.02em] text-[#211f1c] sm:text-[40px]">
            {info?.scene.name ?? ""}
          </div>
          <div className="mt-3 max-w-[38ch] text-[13px] leading-5 text-[#6b6660]">{info?.scene.caption ?? ""}</div>
          <button
            type="button"
            onClick={close}
            style={{ pointerEvents: shown ? "auto" : "none" }}
            className="mt-5 font-mono text-[11px] tracking-[0.22em] text-[#8d8880] transition-colors duration-fast ease-out hover:text-[#211f1c] active:scale-[0.97]"
          >
            CLOSE · ESC
          </button>
        </div>
      </div>
    </>
  );
}
