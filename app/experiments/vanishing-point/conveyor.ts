/**
 * The geometry of the row — everything about where a plate sits and how big it
 * is, with no DOM in sight. The component walks these functions once per plate
 * per frame and writes the results to style.
 *
 * Each step of the conveyor multiplies a plate's size by R and pushes its right
 * edge R× further from the vanishing point. The two together are the
 * perspective: the whole arrangement is one homothety about that point, so
 * scrolling scales the entire composition rather than sliding items past.
 */

import { bez2, clamp, lerp, lerpScale, wrapAround } from "@/lib/math";
import { N } from "./scenes";

/* ── the composition ────────────────────────────────────────────────────────
   R and OVERLAP fix the look between them. A plate covers a constant fraction
   of the one behind it:

     cover = R − K·(R − 1),   where K = (distance to the point) / (plate size)

   so solving that for K pins the row at a chosen overlap forever, at every
   scale. Near-tangent is the look: plates sit shoulder to shoulder, each just
   kissing the edge of its neighbour, and the eye reads the whole staircase. */
export const R = 1.34; // size ratio between neighbours — an even, gentle taper
const OVERLAP = 0.05; // how much of a plate its neighbour hides
const K = (R - OVERLAP) / (R - 1); // ≈ 3.79 plate-widths out to the point
const LN_R = Math.log(R);

/* ── the scroll ─────────────────────────────────────────────────────────── */
export const STEP = 310; // scroll px per step — one flick clears a plate or two
export const CYCLE = N * STEP; // the page track: exactly one lap of the row
/** Centre of the wrap window. It is N steps wide, so each plate has exactly one
    live copy. The visible band is only ~5 steps — the point sits well off the
    left edge, so plates leave past it rather than shrinking away — which keeps
    the recycle seam deep off-screen at both ends. */
const WRAP_C = -1.75;

const LAG = 0.42; // how far a plate trails its scroll position
const STRETCH = 0.2; // horizontal smear at speed

/* ── the flight ─────────────────────────────────────────────────────────── */
export const FOCUS_BLUR = 12; // screen px of defocus on everything left behind
export const Z_HANDOVER = 0.62; // how far out a returning plate rejoins the stack

/** Geometry for the current viewport. Recomputed only on resize. */
export type Geo = {
  /** plate size at scale 1 — plates are square */
  w: number;
  /** vanishing point → the s=1 plate's right edge */
  d: number;
  /** the vanishing point itself */
  vx: number;
  vy: number;
  vh: number;
  /** where a focused plate comes to rest, and how big it gets */
  cx: number;
  cy: number;
  target: number;
};

/**
 * Only about four plates on screen at a time — which is one decision, not two.
 * How many fit is set purely by how far the vanishing point sits off to the
 * left: pushing it out stretches the same taper across more room, so each plate
 * has to be bigger to reach the next.
 *
 * `near` is the size a plate has grown to by the time it clears the right edge
 * — the largest thing you ever see, kept just under the viewport height so it
 * is never cropped from the top. `reach` then places the point four steps of R
 * behind it.
 */
export function measureGeometry(vw: number, vh: number): Geo {
  const narrow = vw < 720;
  const near = Math.min(vw * (narrow ? 0.72 : 0.62), vh * 0.95);
  const reach = Math.max(near, vw * 0.58); // short windows: don't crowd

  return {
    w: near,
    d: K * near,
    vx: vw - (K - 1) * reach,
    vy: vh + 6, // baseline a hair below the fold — every plate sits on it
    vh,
    cx: vw / 2,
    cy: vh * 0.4, // lifted, to leave the info room below
    // bigger than anything the row itself reaches, or stepping out of the row
    // reads as stepping back into it
    target: Math.min(vh * 0.78, vw * (narrow ? 0.86 : 0.62), 760),
  };
}

/** Which step plate `i` is standing on, given the conveyor position. */
export const stepOf = (i: number, pos: number) => wrapAround(i - pos, N, WRAP_C);

/** A plate's size relative to the s=1 reference. */
export const scaleAt = (step: number) => Math.pow(R, step);

/**
 * The plate's left edge in the row. A plate's screen speed is d·s·ln R per
 * step, so trailing it by a fraction of that leaves the row smearing behind a
 * fast scroll instead of snapping to it.
 */
export const rowLeft = (geo: Geo, s: number, vel: number) =>
  geo.vx + (geo.d - geo.w) * s - vel * LAG * geo.d * s * LN_R;

/** Squash and stretch from scroll speed, killed off as a plate takes flight. */
export const smear = (vel: number, flight: number) =>
  Math.min(Math.abs(vel) * STRETCH, 0.055) * Math.max(0, 1 - flight);

/**
 * Done at the left edge, not yet due at the right. Plates leave past the edge
 * rather than shrinking into the point, so both bounds are edge tests.
 */
export const isOffscreen = (geo: Geo, left: number, s: number, vw: number) =>
  left + geo.w * s < -2 || left > vw + 2;

/**
 * The path out of the row: one shallow bow into the middle of the screen — no
 * hop. The control point sits most of the way across but only a little of the
 * way up, so the curve leaves along the row's own direction and turns upward
 * late. Positioned by CENTRE rather than the layout box's bottom-left origin,
 * so the plate itself travels the curve.
 *
 * `t` is free to pass 0 and 1: it comes from a spring, and the overshoot at
 * each end is the settle.
 */
export function flightTransform(geo: Geo, left: number, s: number, t: number) {
  const rowCx = left + (geo.w * s) / 2;
  const rowCy = geo.vy - (geo.w * s) / 2;

  const ctrlX = lerp(rowCx, geo.cx, 0.66);
  const ctrlY = lerp(rowCy, geo.cy, 0.22) - geo.vh * 0.03;

  const sc = lerpScale(s, geo.target / geo.w, t);
  const cx = bez2(rowCx, ctrlX, geo.cx, t);
  const cy = bez2(rowCy, ctrlY, geo.cy, t);

  return {
    sc,
    x: cx - (geo.w * sc) / 2,
    y: cy + (geo.w * sc) / 2 - geo.vy,
  };
}

/** Nearer plates draw in front. Offset to keep every value positive. */
export const stackAt = (step: number) => Math.round((step + 12) * 10);

/** Blur is applied before a plate's own scale, so convert to its local units. */
export const localBlur = (s: number) => clamp(FOCUS_BLUR / s, 0, 34);
