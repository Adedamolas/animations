/**
 * What the plates look like: the ground the row sits on, and the fourteen
 * poster compositions carried by the conveyor in `conveyor.ts`.
 */

export const PAGE = "#e9e7e2";

/* Each plate is one poster: two or three big shapes on a coloured ground —
   a disc, an arc, a bar, a ring — cut and counterweighted the Swiss way.
   Everything is positioned and sized in percentages of the plate, so a
   composition reads exactly the same as a 265px sliver at the screen edge and
   at full size in the middle. Coordinates are the CENTRE of the shape. */
const INK = "#221d18";
const CREAM = "#f6efe0";
const BONE = "#e7dbc2";
const ORANGE = "#e8752c";
const RUST = "#a83c14";
const GOLD = "#e5a92a";
const OLIVE = "#5e7a30";
const SAGE = "#aabf83";

export type Shape =
  | { t: "disc"; x: number; y: number; r: number; c: string }
  /** k = stroke weight, as a fraction of the radius */
  | { t: "ring"; x: number; y: number; r: number; k: number; c: string }
  /** half disc, dome up before rotation */
  | { t: "half"; x: number; y: number; r: number; c: string; rot?: number }
  /** quarter disc, curve facing bottom-right before rotation */
  | { t: "quad"; x: number; y: number; r: number; c: string; rot?: number }
  | { t: "bar"; x: number; y: number; w: number; h: number; c: string; rot?: number };

export type Scene = {
  name: string;
  caption: string;
  ground: [string, string];
  shapes: Shape[];
};

export const SCENES: Scene[] = [
  {
    name: "Marigold", caption: "Disc held high, one rule under it",
    ground: ["#ef8331", "#d96a22"],
    shapes: [
      { t: "disc", x: 0.6, y: 0.36, r: 0.29, c: CREAM },
      { t: "bar", x: 0.5, y: 0.79, w: 1.1, h: 0.075, c: INK },
      { t: "disc", x: 0.24, y: 0.62, r: 0.1, c: RUST },
    ],
  },
  {
    name: "Fern", caption: "A ring, and a column to hold it",
    ground: ["#65822f", "#4d6626"],
    shapes: [
      { t: "ring", x: 0.43, y: 0.47, r: 0.31, k: 0.17, c: CREAM },
      { t: "bar", x: 0.83, y: 0.5, w: 0.075, h: 0.84, c: INK },
    ],
  },
  {
    name: "Almond", caption: "Sun coming up through the lower edge",
    ground: ["#f7ecd6", "#e9d5b0"],
    shapes: [
      { t: "half", x: 0.5, y: 0.84, r: 0.42, c: ORANGE },
      { t: "bar", x: 0.5, y: 0.29, w: 0.72, h: 0.05, c: INK },
    ],
  },
  {
    name: "Cinder", caption: "One warm mark on a dark field",
    ground: ["#3b3833", "#26241f"],
    shapes: [
      { t: "disc", x: 0.36, y: 0.4, r: 0.17, c: GOLD },
      { t: "bar", x: 0.5, y: 0.7, w: 1.2, h: 0.022, c: CREAM, rot: -12 },
    ],
  },
  {
    name: "Saffron", caption: "Ring, quarter, and a dot dead centre",
    ground: ["#eeb43a", "#dc9d22"],
    shapes: [
      { t: "ring", x: 0.47, y: 0.48, r: 0.34, k: 0.11, c: INK },
      { t: "quad", x: 0.86, y: 0.86, r: 0.34, c: RUST, rot: 180 },
      { t: "disc", x: 0.47, y: 0.48, r: 0.08, c: CREAM },
    ],
  },
  {
    name: "Basil", caption: "A bar laid across the diagonal",
    ground: ["#4e6a34", "#3a5027"],
    shapes: [
      { t: "bar", x: 0.5, y: 0.55, w: 1.35, h: 0.11, c: CREAM, rot: -29 },
      { t: "disc", x: 0.73, y: 0.25, r: 0.13, c: ORANGE },
    ],
  },
  {
    name: "Clay", caption: "The corner taken out in one curve",
    ground: ["#cd6142", "#b04f33"],
    shapes: [
      { t: "quad", x: 0.22, y: 0.22, r: 0.5, c: CREAM },
      { t: "bar", x: 0.56, y: 0.85, w: 0.8, h: 0.07, c: OLIVE },
    ],
  },
  {
    name: "Linen", caption: "Two circles, one drawn and one filled",
    ground: ["#f4efe3", "#e4dbc7"],
    shapes: [
      { t: "ring", x: 0.39, y: 0.44, r: 0.31, k: 0.13, c: INK },
      { t: "disc", x: 0.67, y: 0.63, r: 0.22, c: ORANGE },
    ],
  },
  {
    name: "Rust", caption: "Dome pushed off the right edge",
    ground: ["#b3511c", "#8f3d14"],
    shapes: [
      { t: "half", x: 0.85, y: 0.5, r: 0.36, c: CREAM, rot: -90 },
      { t: "bar", x: 0.21, y: 0.5, w: 0.055, h: 0.96, c: INK },
    ],
  },
  {
    name: "Moss", caption: "Three rules stepping down, one weight",
    ground: ["#7d9a4c", "#63803a"],
    shapes: [
      { t: "bar", x: 0.42, y: 0.33, w: 0.66, h: 0.055, c: CREAM },
      { t: "bar", x: 0.35, y: 0.48, w: 0.48, h: 0.055, c: CREAM },
      { t: "bar", x: 0.29, y: 0.63, w: 0.3, h: 0.055, c: CREAM },
      { t: "disc", x: 0.77, y: 0.75, r: 0.13, c: INK },
    ],
  },
  {
    name: "Sable", caption: "Big pale disc, cut by a thin one",
    ground: ["#5d554c", "#443d37"],
    shapes: [
      { t: "disc", x: 0.36, y: 0.5, r: 0.33, c: BONE },
      { t: "bar", x: 0.71, y: 0.5, w: 0.05, h: 0.88, c: RUST },
    ],
  },
  {
    name: "Ember", caption: "Dark arc rising in the corner",
    ground: ["#ee7d2c", "#d3651b"],
    shapes: [
      { t: "half", x: 0.18, y: 0.92, r: 0.4, c: INK },
      { t: "disc", x: 0.71, y: 0.29, r: 0.13, c: CREAM },
    ],
  },
  {
    name: "Ochre", caption: "One line straight through the ring",
    ground: ["#d9a63c", "#c08f2c"],
    shapes: [
      { t: "ring", x: 0.46, y: 0.48, r: 0.33, k: 0.1, c: INK },
      { t: "bar", x: 0.5, y: 0.48, w: 1.3, h: 0.055, c: CREAM, rot: -21 },
    ],
  },
  {
    name: "Slate", caption: "Warm circle against a cold quarter",
    ground: ["#6a7477", "#525b5e"],
    shapes: [
      { t: "quad", x: 0.16, y: 0.16, r: 0.36, c: SAGE },
      { t: "disc", x: 0.59, y: 0.57, r: 0.27, c: ORANGE },
    ],
  },
];
export const N = SCENES.length;

/** Film grain, laid over the page and every plate. */
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
