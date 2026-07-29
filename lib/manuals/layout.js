/**
 * Where the three books stand — in the fan, and once one has been opened.
 *
 * A slot is a position, a rotation and a scale. Nothing here touches the
 * scene: `computeSlots` is pure, and the caller applies `fit` to the group.
 */

import { clamp } from "@/lib/math";

/**
 * @param vw viewport width in px
 * @param vh viewport height in px
 * @returns hero slots (one per book), the detail slot, and the group scale
 */
export function computeSlots(vw, vh) {
  const aspect = vw / Math.max(1, vh);
  // Narrow or short windows shrink the whole rig rather than re-laying it out,
  // so the fan keeps its proportions instead of splaying.
  const fit = clamp(aspect / 1.75, 0.56, 1);
  const portrait = aspect < 0.85;

  const hero = portrait
    ? [
        { p: [-1.44, -1.42, -0.14], r: [-0.05, 0.42, 0.19], s: 1.2 },
        { p: [0.22, -1.06, 0.62], r: [-0.05, -0.11, -0.04], s: 1.34 },
        { p: [1.74, -1.5, -0.36], r: [-0.05, -0.44, -0.18], s: 1.2 },
      ]
    : [
        { p: [-2.2, -1.45, -0.14], r: [-0.05, 0.42, 0.19], s: 1.46 },
        { p: [0.3, -1.15, 0.62], r: [-0.05, -0.11, -0.04], s: 1.62 },
        { p: [2.6, -1.56, -0.36], r: [-0.05, -0.44, -0.18], s: 1.46 },
      ];

  // Landscape puts the open book left and leaves the right half for the sheet;
  // portrait centres it and the sheet goes underneath.
  const detail = portrait
    ? { p: [0, 0.55, 0.9], r: [-0.02, -0.4, 0.06], s: 1.02 }
    : { p: [-2.1, 0.05, 1.1], r: [0.02, -0.5, 0.1], s: 1.24 };

  return { hero, detail, portrait, fit, groupY: -(1 - fit) * 0.5 };
}

/** Aim every channel of a book at a slot. */
export function setTargets(b, slot) {
  const s = b.springs;
  s.px.t = slot.p[0];
  s.py.t = slot.p[1];
  s.pz.t = slot.p[2];
  s.rx.t = slot.r[0];
  s.ry.t = slot.r[1];
  s.rz.t = slot.r[2];
  b.slotScale = slot.s;
}

/** Where the camera sits and looks, per mode. */
export function cameraFor(mode, portrait) {
  const detail = mode === "detail";
  return {
    x: detail && !portrait ? -0.5 : 0,
    z: detail ? (portrait ? 9.9 : 8.9) : 9.6,
    lookX: detail && !portrait ? -0.6 : 0,
    lookY: detail && !portrait ? 0.14 : 0,
  };
}
