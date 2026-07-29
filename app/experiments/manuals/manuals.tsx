"use client";

// Manuals — DOM chrome. The fan, the peel and the tumble live in
// @/lib/manuals/engine.js; this owns the wordmark the books stand in front of,
// the label that tracks whichever book you are pointing at, and the detail
// sheet that slides in once one has left the fan.

import { useCallback, useEffect, useRef, useState } from "react";
import { MANUALS, LOOK } from "@/lib/manuals/catalog";
import { createManuals } from "@/lib/manuals/engine";

type Engine = ReturnType<typeof createManuals>;

export function Manuals() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [hover, setHover] = useState<{ i: number; x: number; y: number }>({ i: -1, x: 0, y: 0 });
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const onHover = useCallback((i: number, x: number, y: number) => setHover({ i, x, y }), []);
  const onOpen = useCallback((i: number) => setOpenIdx(i), []);
  const onClose = useCallback(() => setOpenIdx(null), []);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = createManuals(mountRef.current, { onHover, onOpen, onClose });
    engineRef.current = engine;

    // ?open=2 lands straight in the detail view, for previews
    const n = parseInt(new URLSearchParams(window.location.search).get("open") ?? "", 10);
    const timer = Number.isFinite(n) && n >= 1 && n <= MANUALS.length
      ? setTimeout(() => engine.open(n - 1), 900)
      : null;

    return () => {
      if (timer) clearTimeout(timer);
      engine.destroy();
      engineRef.current = null;
    };
  }, [onHover, onOpen, onClose]);

  const open = openIdx !== null ? MANUALS[openIdx] : null;
  const showing = openIdx !== null;

  return (
    <div
      data-lenis-prevent
      className="relative h-screen w-screen select-none overflow-hidden"
      style={{ background: LOOK.ground, color: "#f3f1ea" }}
    >
      {/* the wordmark the fan stands in front of */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[7vh] text-center font-semibold leading-[0.8] tracking-[-0.045em]"
        style={{
          color: LOOK.wordmark,
          fontSize: "clamp(84px, 20vw, 320px)",
          opacity: showing ? 0.16 : 1,
          transform: showing ? "translate3d(0,-3vh,0)" : "none",
          transition: "opacity 620ms var(--ease-out), transform 620ms var(--ease-out)",
        }}
      >
        Manuals
      </div>

      {/* WebGL fan */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* what you are pointing at */}
      <div
        className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium tracking-[0.06em] backdrop-blur-sm"
        style={{
          left: hover.x,
          top: hover.y,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.14)",
          opacity: hover.i >= 0 && !showing ? 1 : 0,
          transform: `translate3d(-50%, ${hover.i >= 0 && !showing ? "0" : "6px"}, 0)`,
          transition: "opacity 180ms var(--ease-out), transform 180ms var(--ease-out)",
        }}
      >
        {hover.i >= 0 ? MANUALS[hover.i].title : ""}
      </div>

      {/* the sheet, once a book has left the fan */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-6 pb-8 sm:inset-y-0 sm:left-auto sm:right-0 sm:flex sm:w-[min(46vw,520px)] sm:flex-col sm:justify-center sm:px-12 sm:pb-0"
        style={{
          opacity: showing ? 1 : 0,
          transform: showing ? "translate3d(0,0,0)" : "translate3d(0,22px,0)",
          transition: "opacity 420ms var(--ease-out), transform 480ms var(--ease-out)",
          transitionDelay: showing ? "420ms" : "0ms",
        }}
      >
        <div className="font-mono text-[11px] tracking-[0.22em] text-white/45">
          {open ? `${String((openIdx ?? 0) + 1).padStart(2, "0")} / ${String(MANUALS.length).padStart(2, "0")}` : ""}
        </div>
        <h2 className="mt-3 text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[42px]">
          {open?.title ?? ""}
        </h2>
        <p className="mt-2 text-[14px] italic leading-5 text-white/60">{open?.subtitle ?? ""}</p>

        <div className="mt-4 flex items-center gap-3 text-[11px] font-medium tracking-[0.08em] text-white/45">
          <span className="tabular-nums">{open?.year ?? ""}</span>
          <span className="h-3 w-px bg-white/15" />
          <span className="tabular-nums">{open?.pages ?? ""} pages</span>
          <span className="h-3 w-px bg-white/15" />
          <span aria-label={`${open?.rating ?? 0} out of 5`} style={{ color: LOOK.wordmark }}>
            {"★★★★★".slice(0, open?.rating ?? 0)}
            <span className="text-white/15">{"★★★★★".slice(open?.rating ?? 0)}</span>
          </span>
        </div>

        <p className="mt-5 max-w-[46ch] text-[13px] leading-6 text-white/70">{open?.blurb ?? ""}</p>

        <button
          type="button"
          onClick={() => engineRef.current?.close()}
          style={{ pointerEvents: showing ? "auto" : "none" }}
          className="mt-7 w-fit rounded-md border border-white/15 px-3 py-2 text-[11px] font-medium tracking-[0.14em] text-white/60 transition-[background-color,border-color,color] duration-fast ease-out hover:border-white/30 hover:text-white active:scale-[0.97]"
        >
          CLOSE · ESC
        </button>
      </div>

      {/* how to use it */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-6 z-10 text-center font-mono text-[11px] tracking-[0.2em] text-white/35"
        style={{
          opacity: showing ? 0 : 1,
          transition: "opacity 240ms var(--ease-out)",
        }}
      >
        HOVER TO PEEL &nbsp;·&nbsp; DRAG TO OPEN &nbsp;·&nbsp; CLICK FOR THE BOOK
      </div>
    </div>
  );
}
