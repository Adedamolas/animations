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
  {
    slug: "sliding-carousel",
    title: "Sliding carousel",
    blurb:
      "Photos ride a diagonal from top-right to bottom-left on momentum scroll, a sliding window opening and closing over each as it passes the focal point.",
    date: "2026-07-27",
  },
  {
    slug: "decade",
    title: "A decade in the making",
    blurb:
      "An arrow-key timeline where the active year expands into a big frame, pushing the years below down, while the title and sentence-staggered copy track its position.",
    date: "2026-07-27",
  },
  {
    slug: "paper-cards",
    title: "Paper cards",
    blurb:
      "Big tilted rectangles ride up from the corner and grow to full size at centre on momentum scroll, fluttering like waved paper that wobbles to a soft settle when it stops.",
    date: "2026-07-27",
  },
  {
    slug: "morph-menu",
    title: "Morph menu",
    blurb:
      "One container that springs between a collapsed pill, a menu, a tall inquiry form, a newsletter, and an about panel — the box overshooting as the content crossfades.",
    date: "2026-07-27",
  },
  {
    slug: "folder",
    title: "Folder",
    blurb:
      "A folder whose front sheet tips open while the files inside fan out and name themselves, staggered — with a springy back-out pop.",
    date: "2026-07-27",
  },
  {
    slug: "glass-carousel",
    title: "Glass carousel",
    blurb:
      "An infinite scroll-driven portfolio row rendered in WebGL through a liquid-glass lens shader — chromatic dispersion, a shimmer ring, and a click-to-focus mode. Adapted from Yousuf Soomro's MIT project.",
    date: "2026-07-27",
  },
  {
    slug: "liquid-dock",
    title: "Liquid dock",
    blurb:
      "A floating glass dock pinned to the bottom of a scrolling page, refracting whatever passes behind it through the same WebGL lens — the nav's active pill springing between items with a liquid stretch.",
    date: "2026-07-28",
  },
  {
    slug: "complete-shelf",
    title: "The Complete Shelf",
    blurb:
      "A warm editorial 3D library of nineteen procedural clothbound hardcovers on a continuous walnut shelf — browse by drag, wheel, arrows or markers, then pull any volume forward to orbit, pan, and zoom.",
    date: "2026-07-28",
  },
];

export function getExperiment(slug: string): Experiment | undefined {
  return experiments.find((e) => e.slug === slug);
}
