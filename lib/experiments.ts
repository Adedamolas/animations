/**
 * The registry of animation experiments. Add an entry here and it shows up on
 * the home gallery automatically — one source of truth for the playground.
 */
export type Experiment = {
  slug: string;
  title: string;
  blurb: string;
  /** ISO date, for ordering + display. */
  date: string;
};

export const experiments: Experiment[] = [
  {
    slug: "inverted-carousel",
    title: "Inverted carousel",
    blurb:
      "A concave coverflow of squircle portraits that overshoots and rocks back into place on every step.",
    date: "2026-07-24",
  },
  {
    slug: "liquid-signup",
    
    title: "Liquid signup",
    blurb:
      "A pill that morphs into a close button while the signup card inflates from it like a balloon — overshooting before it settles.",
    date: "2026-07-24",
  },
  {
    
    slug: "hero-morph",
    title: "Hero morph",
    blurb:
      "On one swipe the full-bleed hero collapses into a tiny squircle that lands inline in the copy, as the paragraph bounces in around it.",
    date: "2026-07-24",
  },
  {
    slug: "testimonials",
    title: "Testimonials",
    blurb:
      "A row of avatars where the active one expands to reveal its name and title, while the quote slides out one side and cascades back in line by line.",
    date: "2026-07-25",
  },
  {
    slug: "hidden-balance",
    title: "Hidden balance",
    blurb:
      "Hide your balance and a shimmer sweeps across, shattering the number into shards that scatter — then reassembles them when you reveal it again.",
    date: "2026-07-26",
  },
  {
    slug: "card-flight",
    title: "Card flight",
    blurb:
      "Three tilted cyanotype cards drop in from above and grow as you scroll — sinking, rising to centre, then un-stacking and flipping to their backs.",
    date: "2026-07-27",
  },
];

export function getExperiment(slug: string): Experiment | undefined {
  return experiments.find((e) => e.slug === slug);
}
