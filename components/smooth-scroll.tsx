"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Global smooth-scroll foundation for the playground.
 *
 * Wraps the app once (in the root layout) and runs a single Lenis instance on
 * a rAF loop. Individual experiments never touch this — they get buttery page
 * scrolling for free. Honors prefers-reduced-motion by not smoothing at all.
 *
 * Opt an inner scroll container out with `data-lenis-prevent`.
 */
let instance: Lenis | null = null;
/* Remembered separately from the instance: React runs child effects before
   parent ones, so an experiment asks for infinite scrolling BEFORE this
   provider has built its Lenis. The wish is recorded here and applied on
   creation. */
let wantInfinite = false;

/** The live page-scroll instance, or null under prefers-reduced-motion. */
export function getLenis() {
  return instance;
}

/**
 * Flip the page into (or out of) endless scrolling. Lenis reads `infinite`
 * live every frame and wraps both its own scroll value and the DOM scrollTop
 * by the page limit, so a looping experiment gets a seamless seam for free —
 * as long as its content repeats every `limit` pixels. Always restore this on
 * unmount; it is a global.
 */
export function setInfiniteScroll(on: boolean) {
  wantInfinite = on;
  if (instance) (instance.options as { infinite?: boolean }).infinite = on;
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.1,
      // mirror of --ease-out so page scroll shares the house easing
      easing: (t) => 1 - Math.pow(1 - t, 3.2),
      smoothWheel: true,
    });
    instance = lenis;
    (lenis.options as { infinite?: boolean }).infinite = wantInfinite;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      instance = null;
    };
  }, []);

  return children;
}
