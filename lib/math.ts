/**
 * The handful of scalar helpers every experiment reaches for. These were
 * redefined at the top of a dozen files; they live here now so a fix lands
 * once. Pure functions only — nothing here touches the DOM or React.
 */

/** Constrain to a range. */
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Constrain to 0…1 — the common case, for progress and opacity. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where `v` sits between a and b, as 0…1. The inverse of `lerp`. */
export const inverseLerp = (a: number, b: number, v: number) =>
  a === b ? 0 : (v - a) / (b - a);

/**
 * Interpolate a scale multiplicatively rather than linearly. In any layout
 * built on a ratio — each step ×R — lerping size directly reads as a lurch at
 * the large end, because equal steps of size are unequal steps of *apparent*
 * size. Lerping the exponent keeps the growth rate constant.
 */
export const lerpScale = (a: number, b: number, t: number) =>
  Math.exp(lerp(Math.log(a), Math.log(b), t));

/** Quadratic bézier on one axis — a start, a control point and an end. */
export const bez2 = (a: number, b: number, c: number, t: number) =>
  (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

/** 0…1 with a soft start and stop — zero velocity at both ends. */
export const smoothstep = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/**
 * Like `smoothstep`, but with zero *acceleration* at the ends too, so motion
 * has no detectable start or stop. Use where a curve must not show its corners.
 */
export const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** `smoothstep` across an arbitrary range. */
export const smoothRange = (edge0: number, edge1: number, x: number) =>
  smoothstep(inverseLerp(edge0, edge1, x));

/**
 * Nearest looped copy of `value` within a window of `period` centred on
 * `center`. Used to place one live copy of each item on an endless conveyor —
 * an item leaving one end reappears at the other, off-screen.
 */
export const wrapAround = (value: number, period: number, center = 0) =>
  value - period * Math.round((value - center) / period);
