"use client";

// The Complete Shelf — DOM overlay. The 3D shelf, the pull-forward inspect rig,
// and the openable book live in @/lib/complete-shelf/engine.js; this owns the
// warm editorial chrome for three modes: browse (shelf), inspect (closed book,
// orbit), reading (open book, drag-to-turn pages).
import { useEffect, useRef, useState } from "react";
import { CATALOG, COUNT, ACCENT } from "@/lib/complete-shelf/catalog";
import { createShelf } from "@/lib/complete-shelf/engine";

type Mode = "browse" | "inspect" | "reading";

export function CompleteShelf() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createShelf> | null>(null);
  const [active, setActive] = useState(0);
  const [mode, setMode] = useState<Mode>("browse");

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = createShelf(mountRef.current, {
      onSelect: (i: number) => setActive(i),
      onMode: (m: Mode) => setMode(m),
      initialIndex: 0,
    });
    engineRef.current = engine;

    // deep-link: ?v=3 jumps to a volume, &inspect=1 opens the orbit view,
    // &open=1 opens the book, &p=2.4 sets a static page for screenshots.
    const params = new URLSearchParams(window.location.search);
    const v = parseInt(params.get("v") ?? "", 10);
    if (Number.isFinite(v) && v >= 1 && v <= COUNT) engine.select(v - 1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (params.get("inspect") || params.get("open")) timers.push(setTimeout(() => engine.inspect(), 500));
    if (params.get("open")) timers.push(setTimeout(() => engine.openBook(), 900));
    const p = parseFloat(params.get("p") ?? "");
    if (Number.isFinite(p)) timers.push(setTimeout(() => engine._debugPage(p), 1400));

    return () => {
      timers.forEach(clearTimeout);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const book = CATALOG[active];
  const browsing = mode === "browse";
  const inspecting = mode === "inspect";
  const reading = mode === "reading";

  return (
    <div
      data-lenis-prevent
      className="relative h-screen w-screen overflow-hidden"
      style={{ background: "#efe7d6", color: "#2a2420" }}
    >
      {/* WebGL shelf / book */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* paper scrims — keep the editorial text legible over the 3D */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[44%] transition-opacity duration-500"
        style={{
          background: "linear-gradient(to right, #efe7d6 0%, rgba(239,231,214,0.92) 28%, rgba(239,231,214,0) 100%)",
          opacity: browsing ? 1 : 0,
        }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[46%] transition-opacity duration-500"
        style={{
          background: "linear-gradient(to left, #efe7d6 0%, rgba(239,231,214,0.9) 30%, rgba(239,231,214,0) 100%)",
          opacity: browsing ? 0 : 1,
        }}
      />

      {/* masthead */}
      <div className="pointer-events-none absolute left-8 top-7 z-20 select-none">
        <p className="font-serif text-[13px] italic tracking-wide text-[#6b5f52]">The Complete Shelf</p>
      </div>

      {/* current volume — browse */}
      <div
        className="pointer-events-none absolute left-8 top-1/2 z-20 max-w-[min(36vw,420px)] -translate-y-1/2 select-none transition-all duration-500"
        style={{ opacity: browsing ? 1 : 0, transform: `translateY(-50%) translateX(${browsing ? 0 : -16}px)` }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8a7d6d]">{book.collection}</p>
        <h1 className="mt-3 font-serif text-[clamp(2rem,3.6vw,3.4rem)] leading-[1.04] text-[#2a2420]">{book.title}</h1>
        <p className="mt-3 font-serif text-[17px] italic text-[#6b5f52]">{book.author}</p>
        <p className="mt-4 font-mono text-[11px] tracking-[0.14em] text-[#a99c88]">
          {book.year} · VOL. {String(active + 1).padStart(2, "0")}
        </p>
        <button
          type="button"
          onClick={() => engineRef.current?.inspect()}
          className="pointer-events-auto mt-6 inline-flex items-center gap-1.5 border-b pb-0.5 font-serif text-[15px] italic transition-opacity hover:opacity-70"
          style={{ color: ACCENT, borderColor: ACCENT }}
        >
          Inspect this volume <span aria-hidden>↗</span>
        </button>
      </div>

      {/* inspect panel — closed book, orbit */}
      <div
        className="absolute right-8 top-1/2 z-20 max-w-[min(32vw,380px)] -translate-y-1/2 select-none text-right transition-all duration-500"
        style={{
          opacity: inspecting ? 1 : 0,
          transform: `translateY(-50%) translateX(${inspecting ? 0 : 16}px)`,
          pointerEvents: inspecting ? "auto" : "none",
        }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8a7d6d]">{book.collection}</p>
        <h2 className="mt-3 font-serif text-[clamp(1.8rem,3vw,2.8rem)] leading-[1.06] text-[#2a2420]">{book.title}</h2>
        <p className="mt-2 font-serif text-[16px] italic text-[#6b5f52]">{book.author}</p>
        <p className="mt-5 font-serif text-[15px] leading-relaxed text-[#4a4038]">{book.blurb}</p>
        <div className="mt-6 flex justify-end gap-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[#a99c88]">
          <span>{book.year}</span>
          <span>Clothbound</span>
          <span>{book.foil} foil</span>
        </div>
        <div className="mt-7 flex justify-end gap-6">
          <button
            type="button"
            onClick={() => engineRef.current?.openBook()}
            className="inline-flex items-center gap-1.5 border-b pb-0.5 font-serif text-[15px] italic transition-opacity hover:opacity-70"
            style={{ color: ACCENT, borderColor: ACCENT }}
          >
            Open the book <span aria-hidden>→</span>
          </button>
          <button
            type="button"
            onClick={() => engineRef.current?.close()}
            className="inline-flex items-center gap-1.5 border-b border-transparent pb-0.5 font-serif text-[15px] italic text-[#8a7d6d] transition-opacity hover:opacity-70"
          >
            <span aria-hidden>←</span> Shelf
          </button>
        </div>
        <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-[#a99c88]">DRAG TO ORBIT · SCROLL TO ZOOM · ESC</p>
      </div>

      {/* reading panel — open book, turn pages */}
      <div
        className="absolute right-8 top-1/2 z-20 max-w-[min(30vw,340px)] -translate-y-1/2 select-none text-right transition-all duration-500"
        style={{
          opacity: reading ? 1 : 0,
          transform: `translateY(-50%) translateX(${reading ? 0 : 16}px)`,
          pointerEvents: reading ? "auto" : "none",
        }}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#8a7d6d]">Now reading</p>
        <h2 className="mt-3 font-serif text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.08] text-[#2a2420]">{book.title}</h2>
        <p className="mt-2 font-serif text-[15px] italic text-[#6b5f52]">{book.author}</p>

        <div className="mt-7 flex items-center justify-end gap-5">
          <button
            type="button"
            onClick={() => engineRef.current?.closeBook()}
            className="font-serif text-[14px] italic text-[#8a7d6d] transition-opacity hover:opacity-70"
          >
            Close book
          </button>
          <button
            type="button"
            onClick={() => engineRef.current?.turnPage?.(-1)}
            aria-label="Previous page"
            className="font-serif text-[22px] text-[#6b5f52] transition-opacity hover:opacity-60"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => engineRef.current?.turnPage?.(1)}
            aria-label="Next page"
            className="font-serif text-[22px]"
            style={{ color: ACCENT }}
          >
            ›
          </button>
        </div>
        <p className="mt-4 font-mono text-[10px] tracking-[0.16em] text-[#a99c88]">DRAG A PAGE TO TURN · SCROLL TO ZOOM · ESC</p>
      </div>

      {/* browse controls: counter + markers + prev/next */}
      <div
        className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-4 transition-opacity duration-500"
        style={{ opacity: browsing ? 1 : 0, pointerEvents: browsing ? "auto" : "none" }}
      >
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => engineRef.current?.prev()}
            aria-label="Previous volume"
            className="font-serif text-[20px] text-[#6b5f52] transition-opacity hover:opacity-60"
          >
            ‹
          </button>
          <div className="flex items-end gap-[7px]">
            {CATALOG.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => engineRef.current?.select(i)}
                aria-label={`Go to ${b.title}`}
                className="group relative flex h-6 w-2 items-end justify-center"
              >
                <span
                  className="w-px transition-all duration-300"
                  style={{ height: i === active ? 24 : 12, background: i === active ? ACCENT : "#c3b7a3" }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => engineRef.current?.next()}
            aria-label="Next volume"
            className="font-serif text-[20px] text-[#6b5f52] transition-opacity hover:opacity-60"
          >
            ›
          </button>
        </div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[#a99c88]">
          {String(active + 1).padStart(2, "0")} / {COUNT}
          <span className="mx-3 text-[#cfc3af]">·</span>
          DRAG · SCROLL · ARROWS · CLICK TO INSPECT
        </p>
      </div>
    </div>
  );
}
