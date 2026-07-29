// The Complete Shelf — the 19-volume library. Every title, author, colour and
// motif here is original; the reference experience was read for behaviour only.
//
// Each book is a clothbound hardcover with its own proportions (so the shelf
// reads as a real, varied run of spines), a muted cloth colour, a foil family,
// and one abstract foil motif stamped on the spine + cover. `cover-art.ts`
// turns these fields into canvas textures; `engine.ts` turns `dims` into a box.

export type Motif =
  | "arcs"
  | "rings"
  | "grid"
  | "waves"
  | "sunburst"
  | "bars"
  | "diamond"
  | "columns"
  | "monogram"
  | "orbit"
  | "peaks"
  | "weave";

export type Foil = "gold" | "copper" | "silver" | "bronze";

export type Book = {
  id: string;
  title: string;
  author: string;
  collection: string;
  year: string;
  /** Muted clothbound cover colour (hex). */
  cloth: string;
  foil: Foil;
  motif: Motif;
  /** World-unit dimensions of the standing book. */
  dims: { height: number; thickness: number; depth: number };
  blurb: string;
  seed: number;
};

// Metallic foil stops (highlight → base → shadow) keyed by family.
export const FOILS: Record<Foil, [string, string, string]> = {
  gold: ["#f2dd9c", "#c9a24b", "#7c5f23"],
  copper: ["#e7a877", "#b06a3a", "#6d3a1e"],
  silver: ["#eef1f6", "#b8bcc4", "#6f747d"],
  bronze: ["#d8bd85", "#9a7b45", "#5b4522"],
};

export const ACCENT = "#4d746d"; // muted teal — the experience's accent

// Warm editorial defaults, shared by the scene + UI.
export const LOOK = {
  paper: "#efe7d6", // cream background
  paperWarm: "#f4eede",
  walnut: "#5b3f2b",
  walnutDark: "#432d1e",
  ink: "#2a2420",
};

const B = (
  id: string,
  title: string,
  author: string,
  collection: string,
  year: string,
  cloth: string,
  foil: Foil,
  motif: Motif,
  height: number,
  thickness: number,
  depth: number,
  blurb: string,
  seed: number,
): Book => ({ id, title, author, collection, year, cloth, foil, motif, dims: { height, thickness, depth }, blurb, seed });

export const CATALOG: Book[] = [
  B("vol-01", "The Shape of Afternoons", "Ivo Marchetti", "The Quiet Editions", "2021", "#5b6b7e", "gold", "arcs", 2.55, 0.34, 1.74, "Twelve essays on light, idleness, and the long middle of a day.", 11),
  B("vol-02", "Notes Toward a Quiet Room", "Hester Vale", "Marginalia", "2019", "#6b6a3f", "bronze", "grid", 2.32, 0.24, 1.62, "A working notebook on space, silence, and the rooms we keep.", 27),
  B("vol-03", "On Longhand", "Piers Aldous", "Foundations", "2020", "#a8763e", "copper", "columns", 2.68, 0.4, 1.66, "In praise of the slow sentence and the ink that carries it.", 5),
  B("vol-04", "The Weight of Small Things", "Cordelia Fenn", "The Quiet Editions", "2022", "#6e3a34", "gold", "diamond", 2.18, 0.2, 1.52, "How the minor objects of a life quietly hold it together.", 42),
  B("vol-05", "A Grammar of Light", "Tomas Rune", "Field Notes", "2023", "#4a5560", "silver", "waves", 2.6, 0.3, 1.8, "Seasons of weather, seen as a language with its own rules.", 8),
  B("vol-06", "Provisions", "Marlowe Yi", "The Walnut Press", "2021", "#6f7d63", "bronze", "bars", 2.28, 0.26, 1.58, "A field cook's ledger of what to carry and what to leave.", 19),
  B("vol-07", "The Slow Harvest", "Agnes Bardo", "Field Notes", "2018", "#9c5a44", "copper", "sunburst", 2.72, 0.38, 1.7, "A year in a walled garden, told one ripening at a time.", 33),
  B("vol-08", "Interiors", "Frederic Hale", "The Quiet Editions", "2024", "#2f3a4d", "gold", "rings", 2.4, 0.28, 1.64, "On the architecture of rooms and the moods they hold.", 14),
  B("vol-09", "Meridian", "Saoirse Kell", "Foundations", "2020", "#8a7d6d", "bronze", "orbit", 2.5, 0.22, 1.9, "Crossings, longitudes, and the pull of the middle distance.", 51),
  B("vol-10", "The Common Hours", "Bede Ansel", "Marginalia", "2022", "#4d746d", "gold", "columns", 2.34, 0.32, 1.56, "Devotions for the ordinary hours between waking and rest.", 3),
  B("vol-11", "Foldings", "Lira Novak", "The Walnut Press", "2023", "#5a4658", "silver", "peaks", 2.62, 0.24, 1.76, "Paper, pleat, and the quiet mathematics of the crease.", 22),
  B("vol-12", "Understory", "Emmett Crowe", "Field Notes", "2019", "#4f5e3f", "bronze", "weave", 2.44, 0.36, 1.6, "The low, green world beneath the canopy, named at last.", 37),
  B("vol-13", "Terracotta", "Nadia Sol", "The Quiet Editions", "2021", "#97614a", "copper", "arcs", 2.2, 0.2, 1.5, "Earth, kiln, and colour: a short history of fired clay.", 9),
  B("vol-14", "Weather Systems", "Gil Amos", "Foundations", "2024", "#566270", "silver", "waves", 2.66, 0.3, 1.82, "Fronts, pressures, and the moods that move across a map.", 45),
  B("vol-15", "The Amber Index", "Odette Rhys", "Marginalia", "2020", "#9a8340", "gold", "monogram", 2.3, 0.26, 1.58, "A catalogue of warm light, arranged from dawn to ember.", 16),
  B("vol-16", "Timberline", "Caleb Munro", "The Walnut Press", "2022", "#3b4d40", "bronze", "peaks", 2.58, 0.34, 1.72, "Where the forest thins to stone — an account of the edge.", 28),
  B("vol-17", "Soft Cartography", "Wren Halloway", "The Quiet Editions", "2023", "#8a6a66", "copper", "grid", 2.26, 0.22, 1.54, "Maps for feeling rather than finding — the terrain of a mood.", 6),
  B("vol-18", "Blue Hour", "Ines Okafor", "Field Notes", "2025", "#47566b", "silver", "orbit", 2.5, 0.3, 1.78, "The short, deepening blue between the sun and the dark.", 40),
  B("vol-19", "Groundwork", "Silas Pemberton", "Foundations", "2018", "#6a4f3a", "gold", "diamond", 2.7, 0.42, 1.68, "First principles for building slowly, and to last.", 24),
];

export const COUNT = CATALOG.length;
