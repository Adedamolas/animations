export type Person = {
  name: string;
  role: string;
  /** Two-stop gradient standing in for a portrait — swap for a real image
   *  by adding an `image` field and rendering it in the card. */
  from: string;
  to: string;
};

export const people: Person[] = [
  { name: "Aarav Mehta", role: "Systems Design", from: "#4b4f57", to: "#0c0d10" },
  { name: "Lena Okoro", role: "Motion", from: "#ff6a2b", to: "#7a1c05" },
  { name: "Yuki Tanaka", role: "Interaction", from: "#5b7ba6", to: "#111827" },
  { name: "Sofia Reyes", role: "Brand", from: "#e6b980", to: "#6d4423" },
  { name: "Noah Feld", role: "Prototyping", from: "#3f7d63", to: "#0d1f18" },
  { name: "Amara Diallo", role: "Research", from: "#8b6bb1", to: "#2a1840" },
  { name: "Elias Vance", role: "Type", from: "#7c8794", to: "#15171b" },
];
