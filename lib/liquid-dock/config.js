// Liquid-glass dock — a single, centered glass pill that refracts a calm,
// near-monochrome backdrop drifting behind it. The dock body is the same lens
// shader the glass carousel uses (lib/glass-lens), here a wide rounded-rect.
// The nav labels + the sliding active pill live in the React overlay; the
// engine owns the glass + the drifting background it bends.

export const NAV = ["Home", "Work", "About", "Journal", "Contact"];

// A restrained cool backdrop: near-black + a few soft drifting orbs in one
// blue-violet family (deliberately low-chroma so it reads calm, not busy) and
// a huge ghosted wordmark of the active item that the glass magnifies.
export const BG = {
  base: "#08090c",
  ink: "#e6e9f2",
  orbs: [
    { color: "#5b63b0", ax: 0.16, ay: 0.1, sp: 0.05, ph: 0.0, r: 0.62, o: 0.5 },
    { color: "#3f6f8a", ax: 0.12, ay: 0.14, sp: 0.07, ph: 2.1, r: 0.5, o: 0.42 },
    { color: "#6a5aa0", ax: 0.2, ay: 0.08, sp: 0.04, ph: 4.2, r: 0.7, o: 0.36 },
  ],
};

// Dock geometry (CSS px) + the lens look. sizeX/sizeY/posY are derived at
// runtime (the lens speaks in viewport-height fractions).
export const DOCK = {
  widthPx: 452,
  heightPx: 58,
  centerYFrac: 0.52, // vertical center of the dock, as a fraction from the top
  padX: 24,
  round: 1, // fully rounded ends (pill)

  // lens look — a clean glass slab: gentle magnify, cool rim, no loud nova
  tint: "#aebfe8",
  dispersion: 4.5,
  zoom: 0.2,
  glow: 2.6,
  whiteGlow: 0.045,
  novaSize: 5,
  blueRing: 0.9,
  ringRadius: 0.475,
  ringWidth: 0.03,
  shimmer: true,
  shimmerFreq: 8,
  shimmerSpeed: 1.8,
  shimmerDepth: 0.08,
  rimStart: 0.64,
  rimTangential: 0.2,
  rimFreq1: 2,
  rimFreq2: 1,
  rimLine: 1.05,
  rimLinePos: 0.47,
  rimLineWidth: 0.016,
  samples: 12,
};
