/**
 * The parameter that carries a plate out of the row and back.
 *
 * It runs on a spring rather than a clock, so the plate has mass: it arrives a
 * little past where it was going and settles back — the thing a duration-and-
 * easing pair can never do, because a curve that ends at 1 ends at 1.
 * Under-damped on purpose.
 *
 *   ζ = D / (2√K)        overshoot = e^(−πζ/√(1−ζ²))
 *   K = 196, D = 17.4  →  ζ ≈ 0.62  →  ~9% overshoot, no second bounce
 *
 * Because the *parameter* is what overshoots, everything downstream inherits
 * the settle for free: the plate drifts past centre and eases back, and its
 * scale swells a hair past full before it lands. Same on the way home.
 */

const K = 196; // ω ≈ 14 rad/s — reaches the target in ~285ms
const D = 17.4; // ζ ≈ 0.62 — settled by ~460ms

const REST_DELTA = 0.0015;
const REST_SPEED = 0.012;

/** 0 in the row, 1 centred — and free to pass either on the way. */
export type Flight = { u: number; v: number };

export const newFlight = (): Flight => ({ u: 0, v: 0 });

/**
 * Advance toward `goal`. Substepped: one long frame taken in a single step can
 * overshoot far enough to look like a glitch.
 *
 * Velocity is never reset, so reversing mid-flight bends the path instead of
 * restarting it — close while a plate is still on its way out and it curves
 * back from wherever it had got to, at whatever speed it had.
 */
export function stepFlight(f: Flight, goal: number, dt: number) {
  const steps = dt > 0.022 ? 3 : 1;
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    f.v += (K * (goal - f.u) - D * f.v) * h;
    f.u += f.v * h;
  }
}

/**
 * Home only once it has stopped moving as well as arrived. Testing position
 * alone cuts the plate off mid-settle — which is the whole point of the
 * spring, so it would defeat the exercise.
 */
export const isHome = (f: Flight) =>
  Math.abs(f.u) < REST_DELTA && Math.abs(f.v) < REST_SPEED;

export function settle(f: Flight) {
  f.u = 0;
  f.v = 0;
}
