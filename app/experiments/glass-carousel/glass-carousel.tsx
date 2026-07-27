"use client";

// React wrapper around the WebGL carousel. All the three.js / GSAP / shader
// logic lives in @/lib/glass-carousel/engine.js — this owns only the DOM
// overlay (heading, counter, "View" cursor, Close button) and the lifecycle.
// Adapted from Yousuf Soomro's liquid-glass-carousel (MIT).
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { PROJECTS, ENTRY, UI_ANIM } from "@/lib/glass-carousel/config";
import { createCarousel } from "@/lib/glass-carousel/engine";
import { createCarouselGui } from "@/lib/glass-carousel/gui";

// The carousel is a desktop experience (wheel-driven, heavy shader work).
const MIN_VIEWPORT_WIDTH = 1025; // px

export function GlassCarousel() {
  const mountRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const topTextRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ReturnType<typeof createCarousel> | null>(null);
  const revealPlayedRef = useRef(false);

  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [entryDone, setEntryDone] = useState(false);
  const [screen, setScreen] = useState<"pending" | "ok" | "small">("pending");

  // viewport gate
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MIN_VIEWPORT_WIDTH - 1}px)`);
    const update = () => setScreen(mq.matches ? "small" : "ok");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // engine lifecycle
  useEffect(() => {
    if (screen !== "ok" || !mountRef.current) return;
    const engine = createCarousel(mountRef.current, {
      cursorElement: cursorRef.current,
      onActiveChange: setActive,
      onFocusChange: setFocused,
      onEntryDone: setEntryDone,
    });
    engineRef.current = engine;
    const gui = createCarouselGui(engine);
    return () => {
      gui.destroy();
      engine.destroy();
      engineRef.current = null;
    };
  }, [screen]);

  // overlay text transitions (GSAP — same easing vocabulary as the canvas)
  useEffect(() => {
    if (!topTextRef.current || !counterRef.current) return;
    if (!entryDone && ENTRY.enabled) {
      gsap.set([topTextRef.current, counterRef.current], { autoAlpha: 0 });
      revealPlayedRef.current = false;
      return;
    }
    gsap.set(topTextRef.current, { xPercent: -50 });
    gsap.set(counterRef.current, { xPercent: -50 });
    const y = focused ? (UI_ANIM.topShiftVh / 100) * window.innerHeight : 0;

    if (entryDone && !focused && !revealPlayedRef.current) {
      revealPlayedRef.current = true;
      gsap.fromTo(topTextRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: UI_ANIM.revealDuration, ease: UI_ANIM.revealEase });
      gsap.fromTo(counterRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: UI_ANIM.revealDuration, ease: UI_ANIM.revealEase, delay: UI_ANIM.revealStagger });
      return;
    }

    gsap.to(topTextRef.current, { y, autoAlpha: 1, duration: UI_ANIM.duration, ease: UI_ANIM.ease });
    gsap.to(counterRef.current, { autoAlpha: focused ? 0 : 1, duration: UI_ANIM.duration, ease: UI_ANIM.ease });
  }, [focused, entryDone]);

  if (screen !== "ok") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        {screen === "small" && (
          <p className="px-8 text-center text-sm text-white/70">
            This experience is designed for larger screens.
            <br />
            Please visit on a display wider than 1024px.
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={mountRef} className="relative h-screen w-screen bg-white">
      <div
        ref={topTextRef}
        className="absolute left-1/2 top-[15%] px-4 text-white mix-blend-exclusion"
        style={ENTRY.enabled ? { opacity: 0, visibility: "hidden" } : undefined}
      >
        <div className="flex flex-col items-center justify-center">
          <p className="text-center text-base">{PROJECTS[active].brand}</p>
          <p className="text-center">{PROJECTS[active].desc}</p>
        </div>
      </div>

      <div
        ref={counterRef}
        className="absolute bottom-[15%] left-1/2 px-4 text-black"
        style={ENTRY.enabled ? { opacity: 0, visibility: "hidden" } : undefined}
      >
        <p className="text-center text-base tabular-nums">
          {String(active + 1).padStart(2, "0")}/{String(PROJECTS.length).padStart(2, "0")}
        </p>
      </div>

      <div
        ref={cursorRef}
        className="pointer-events-none fixed left-4 top-4 z-50 whitespace-nowrap text-sm text-white mix-blend-exclusion"
        style={{ willChange: "transform" }}
      >
        View
      </div>

      <button
        type="button"
        onClick={() => engineRef.current?.closeFocus()}
        aria-label="Close"
        className="fixed z-50 whitespace-nowrap text-sm text-white mix-blend-exclusion transition-opacity duration-300"
        style={{ top: "2vh", right: "4vw", opacity: focused ? 1 : 0, pointerEvents: focused ? "auto" : "none", cursor: "pointer" }}
      >
        Close
      </button>
    </div>
  );
}
