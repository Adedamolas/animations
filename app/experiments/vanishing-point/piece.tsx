import type { Shape } from "./scenes";

/**
 * One shape of a poster. Plates are square, so a percentage is the same number
 * of pixels on both axes and the whole composition scales by itself — a plate
 * reads identically as a 265px sliver at the screen edge and at full size in
 * the middle. Coordinates are the CENTRE of the shape.
 */
const pc = (v: number) => `${(v * 100).toFixed(3)}%`;

const spin = (rot?: number) => (rot ? `rotate(${rot}deg)` : undefined);

export function Piece({ s }: { s: Shape }) {
  switch (s.t) {
    case "bar":
      return (
        <div
          className="absolute"
          style={{
            left: pc(s.x - s.w / 2),
            top: pc(s.y - s.h / 2),
            width: pc(s.w),
            height: pc(s.h),
            background: s.c,
            transform: spin(s.rot),
          }}
        />
      );

    case "disc":
      return (
        <div
          className="absolute rounded-full"
          style={{
            left: pc(s.x - s.r),
            top: pc(s.y - s.r),
            width: pc(s.r * 2),
            height: pc(s.r * 2),
            background: s.c,
          }}
        />
      );

    case "ring": {
      // Drawn as a gradient rather than a border: border-width can't be a
      // percentage, and the stroke has to scale with the plate like everything
      // else. `closest-side` puts 100% exactly on the box edge.
      const inner = (1 - s.k) * 100;
      return (
        <div
          className="absolute rounded-full"
          style={{
            left: pc(s.x - s.r),
            top: pc(s.y - s.r),
            width: pc(s.r * 2),
            height: pc(s.r * 2),
            background: `radial-gradient(circle closest-side, transparent 0 ${(inner - 0.6).toFixed(2)}%, ${s.c} ${inner.toFixed(2)}% 99.4%, transparent 100%)`,
          }}
        />
      );
    }

    case "half":
      return (
        <div
          className="absolute"
          style={{
            left: pc(s.x - s.r),
            top: pc(s.y - s.r / 2),
            width: pc(s.r * 2),
            height: pc(s.r),
            background: s.c,
            borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
            transform: spin(s.rot),
          }}
        />
      );

    case "quad":
      return (
        <div
          className="absolute"
          style={{
            left: pc(s.x - s.r / 2),
            top: pc(s.y - s.r / 2),
            width: pc(s.r),
            height: pc(s.r),
            background: s.c,
            borderRadius: "0 0 100% 0",
            transform: spin(s.rot),
          }}
        />
      );
  }
}
