/* ── Geometry & physics ──────────────────────────────────────────────────────
   The whole morph shares one top-right anchor. Closed: a pill. Open: the
   panel, whose top-right corner sits where the pill's was; the pill shrinks
   into the panel's close button. Two springs: one opens/closes, one morphs
   between login and signup (which changes the panel's height). */

export type Mode = "signup" | "login";

export const PANEL_W = 375;
export const LOGIN_H = 287; // no name field
export const NAME_INNER = 76; // label + input + a 16px gap below it
export const SIGNUP_H = LOGIN_H + NAME_INNER; // + the collapsible name row
export const PILL_W = 116;
export const PILL_H = 40;
export const X_SIZE = 28; // the close-circle the pill morphs into
export const X_INSET = 12; // its inset from the panel's top-right corner
export const RADIUS_OPEN = 24;

/* The droplet stage: mid-morph the surface passes through a circle. */
export const DROP_SIZE = 72;
export const DROP_AT = 0.3;

/* Open/close: one soft overshoot, then calm. */
export const OPEN_SPRING = { stiffness: 200, damping: 17, mass: 1 };
/* Mode-switch height: deliberately bouncier — the little razzle. */
export const MODE_SPRING = { stiffness: 240, damping: 12, mass: 1 };

/* How hard content rides the open overshoot. */
export const RIDE_X = 0.5;
export const RIDE_Y = 0.7;
/* Jelly: px of velocity-lag per row depth (from BOTH springs), so rows waver
   with the container on open AND on the mode-height bounce. */
export const OPEN_LAG = 30;
export const HEIGHT_LAG = 0.7;
export const LAG_MAX = 9;
export const ROWS = 7;

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
/** Remap p from [a,b] → [0,1], clamped. */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

/**
 * Smooth curve through three points: v0 at p=0, vMid at p=u, v1 at p=1.
 * Quadratic Bézier with its control solved to hit the midpoint — one
 * continuous liquid path (no kink at the droplet moment).
 */
export function through3(
  p: number,
  v0: number,
  vMid: number,
  v1: number,
  u: number,
) {
  const c = (vMid - (1 - u) * (1 - u) * v0 - u * u * v1) / (2 * u * (1 - u));
  return (1 - p) * (1 - p) * v0 + 2 * p * (1 - p) * c + p * p * v1;
}
