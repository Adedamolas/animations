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

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return children;
}
