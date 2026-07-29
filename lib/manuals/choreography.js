/**
 * Getting a book out of frame, and back.
 *
 * A spring aimed far below the frame accelerates the whole way down, which
 * reads as a drop rather than a departure. So for the length of the move the
 * vertical axis is taken off its spring and handed to a small keyframed tween:
 * a decelerating lift, a beat of hang time, then a long glide out that eases at
 * both ends. Coming back is the same idea, reversed.
 *
 * This is the one place in the engine that is authored rather than simulated —
 * because the curve is the point, and no spring produces it.
 */

export const EASE = {
  hold: () => 1,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

const LIFT = 0.42; // how far a book floats up before it is let go
const CLEAR = 4.6; // …and how far below its slot counts as out of frame

/** Queue a set of segments on the book's vertical axis. */
function playY(b, segs) {
  b.exit = { segs, i: 0, t: 0 };
}

/**
 * Advance the tween and write straight into the y spring, keeping that spring
 * inert so it neither fights the curve nor snaps at handover.
 */
export function stepY(b, dt) {
  const ex = b.exit;
  const s = b.springs;
  const was = s.py.v;

  ex.t += dt;
  let seg = ex.segs[ex.i];
  while (seg && ex.t >= seg.d) {
    ex.t -= seg.d;
    s.py.v = seg.to;
    if (seg.end) seg.end();
    seg = ex.segs[++ex.i];
  }
  if (seg) s.py.v = seg.from + (seg.to - seg.from) * seg.ease(ex.t / seg.d);
  else b.exit = null;
  s.py.t = s.py.v;
  s.py.vel = 0;

  // Report how fast the curve is travelling so the book can stretch into it.
  // Read off the curve rather than the spring, which is deliberately inert
  // here and would report zero.
  b.exitVel = dt > 0 ? (s.py.v - was) / dt : 0;
  if (!b.exit) b.exitVel = 0; // landed
}

/**
 * Pin x, z and rotation wherever the book currently stands, so it leaves
 * straight down instead of sliding sideways on its way out.
 */
function pinInPlace(b) {
  const s = b.springs;
  s.px.t = s.px.v;
  s.pz.t = s.pz.v;
  s.rx.t = s.rx.v;
  s.ry.t = s.ry.v;
  s.rz.t = s.rz.v;
}

/** Lift, hang, then glide out of frame — and stop drawing once gone. */
export function sendOut(b, slotY, delay) {
  const here = b.springs.py.v;
  const apex = slotY + LIFT;
  b.root.visible = true;
  pinInPlace(b);
  playY(b, [
    { d: delay, from: here, to: here, ease: EASE.hold },
    { d: 0.28, from: here, to: apex, ease: EASE.outQuad },
    {
      d: 0.9,
      from: apex,
      to: slotY - CLEAR,
      ease: EASE.inOutSine,
      end: () => {
        b.root.visible = false;
      },
    },
  ]);
}

/** Rise back into the fan on one long decelerating curve. */
export function bringBack(b, slotY, delay) {
  const here = b.springs.py.v;
  b.root.visible = true;
  pinInPlace(b);
  playY(b, [
    { d: delay, from: here, to: here, ease: EASE.hold },
    { d: 1.0, from: here, to: slotY, ease: EASE.outQuint },
  ]);
}
