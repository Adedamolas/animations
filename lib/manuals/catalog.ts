// Three fictional manuals on motion — the subject matter of this playground,
// bound as hardcovers. Each entry drives both the 3D book (palette, motif) and
// the detail panel (blurb, year, rating).

export type Motif = "curve" | "wave" | "disc";

export type Manual = {
  title: string;
  /** how the title breaks across lines on the cover */
  lines: string[];
  subtitle: string;
  author: string;
  year: string;
  pages: number;
  rating: number;
  blurb: string;
  motif: Motif;
  /** cover cloth, the ink printed on it, and the foil accent */
  cloth: string;
  clothDark: string;
  ink: string;
  foil: string;
  /** page block + endpapers */
  paper: string;
  endpaper: string;
};

export const MANUALS: Manual[] = [
  {
    title: "Ease Out",
    lines: ["Ease", "Out"],
    subtitle: "A field guide to the last 200ms",
    author: "A. Sotire",
    year: "2024",
    pages: 168,
    rating: 5,
    blurb:
      "Everything an interface promises, it promises at the end. This is a close reading of the final fifth of a transition — where the deceleration lands, why a curve that arrives early feels honest and one that arrives late feels expensive, and how to tell the difference with your eyes closed.",
    motif: "curve",
    cloth: "#e8dfcd",
    clothDark: "#cbbfa6",
    ink: "#1c1a16",
    foil: "#c8552a",
    paper: "#f3ecdc",
    endpaper: "#d8caae",
  },
  {
    title: "Spring & Damping",
    lines: ["Spring", "&", "Damping"],
    subtitle: "Stiffness, mass, and the art of the settle",
    author: "A. Sotire",
    year: "2025",
    pages: 224,
    rating: 5,
    blurb:
      "A spring has no duration, which is the whole problem and the whole point. Two hundred pages on stiffness and damping ratios, on the single bounce that reads as confidence and the second one that reads as a bug, and on when to abandon the physics entirely and just author the curve.",
    motif: "wave",
    cloth: "#2b2f6e",
    clothDark: "#1a1d4a",
    ink: "#f0ecdd",
    foil: "#d9c076",
    paper: "#efe8d8",
    endpaper: "#3a3f86",
  },
  {
    title: "The Physics of Feel",
    lines: ["The", "Physics", "of Feel"],
    subtitle: "Why 0.97 reads as a press",
    author: "A. Sotire",
    year: "2026",
    pages: 192,
    rating: 4,
    blurb:
      "Scale a button to 0.97 and it has been pressed. Scale it to 0.90 and it has been tapped by someone else. This is an inquiry into the tiny numbers that carry intent — press scales, hover lifts, the 140ms that separates an acknowledgement from an animation.",
    motif: "disc",
    cloth: "#b8471c",
    clothDark: "#8d3312",
    ink: "#faf3e4",
    foil: "#f4d7a8",
    paper: "#f2ead9",
    endpaper: "#7d2c0f",
  },
];

/** The ground the fan floats against, and the wordmark behind it. */
export const LOOK = {
  ground: "#101018",
  wordmark: "#6e62f5",
};
