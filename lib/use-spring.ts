"use client";

import { useEffect, useRef } from "react";

export type SpringConfig = {
  /** Pull toward target. Higher = snappier. */
  stiffness: number;
  /** Resistance. Lower = more overshoot/bounce. Underdamped when
   *  damping < 2·√(stiffness·mass). */
  damping: number;
  /** Heavier = slower, more momentum. */
  mass?: number;
  /** Settle thresholds — animation stops once within both. */
  restDelta?: number;
  restSpeed?: number;
};

export type SpringHandle = {
  /** Animate toward a new target, preserving current velocity (interruptible). */
  set: (target: number) => void;
  /** Snap to a value instantly, killing velocity (no animation). */
  jump: (value: number) => void;
  /** Current live value. */
  current: () => number;
};

// Fixed timestep keeps the integration identical regardless of display Hz —
// a 144Hz monitor and a 60Hz one feel the same, and a stalled tab can't blow
// the simulation up with one giant dt.
const STEP = 1 / 240;

/**
 * A dependency-free spring. Drives a single scalar and reports every frame
 * through `onChange` — the caller writes it straight to the DOM (transforms),
 * so React never re-renders at 60fps.
 *
 * The overshoot → rock-back → settle you get from an underdamped config is the
 * whole point: a click sets a new integer target, the spring sails past it and
 * eases back. Click again mid-flight and it retargets carrying its velocity.
 */
export function useSpring(
  initial: number,
  onChange: (value: number) => void,
  config: SpringConfig,
): SpringHandle {
  const cfg = useRef(config);
  cfg.current = config;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const state = useRef({
    value: initial,
    velocity: 0,
    target: initial,
    accumulator: 0,
    lastTime: 0,
    raf: 0,
    running: false,
  });

  const tick = useRef((time: number) => {
    const s = state.current;
    const { stiffness, damping, mass = 1 } = cfg.current;
    const restDelta = cfg.current.restDelta ?? 0.002;
    const restSpeed = cfg.current.restSpeed ?? 0.02;

    if (s.lastTime === 0) s.lastTime = time;
    // Clamp elapsed so a backgrounded tab resumes calmly instead of exploding.
    let elapsed = (time - s.lastTime) / 1000;
    if (elapsed > 0.064) elapsed = 0.064;
    s.lastTime = time;
    s.accumulator += elapsed;

    while (s.accumulator >= STEP) {
      // F = -k·x - c·v   (Hooke's law + viscous damping)
      const displacement = s.value - s.target;
      const springForce = -stiffness * displacement;
      const dampingForce = -damping * s.velocity;
      const acceleration = (springForce + dampingForce) / mass;
      s.velocity += acceleration * STEP;
      s.value += s.velocity * STEP;
      s.accumulator -= STEP;
    }

    onChangeRef.current(s.value);

    const settled =
      Math.abs(s.value - s.target) < restDelta &&
      Math.abs(s.velocity) < restSpeed;

    if (settled) {
      s.value = s.target;
      s.velocity = 0;
      s.running = false;
      s.lastTime = 0;
      s.accumulator = 0;
      onChangeRef.current(s.value);
      return;
    }

    s.raf = requestAnimationFrame(tick.current);
  });

  const start = useRef(() => {
    const s = state.current;
    if (s.running) return;
    s.running = true;
    s.lastTime = 0;
    s.accumulator = 0;
    s.raf = requestAnimationFrame(tick.current);
  });

  useEffect(() => {
    const s = state.current;
    return () => {
      cancelAnimationFrame(s.raf);
      s.running = false;
    };
  }, []);

  const handle = useRef<SpringHandle>({
    set: (target: number) => {
      state.current.target = target;
      start.current();
    },
    jump: (value: number) => {
      const s = state.current;
      cancelAnimationFrame(s.raf);
      s.value = value;
      s.target = value;
      s.velocity = 0;
      s.running = false;
      s.lastTime = 0;
      s.accumulator = 0;
      onChangeRef.current(value);
    },
    current: () => state.current.value,
  });

  return handle.current;
}
