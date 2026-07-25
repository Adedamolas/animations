# Animations

A playground for pouring out motion ideas — physics-driven, fluid web
animations by [Adedamola](https://adedamola.work), following a house design &
motion system. Live at **[animations.adedamola.work](https://animations.adedamola.work)**.

Every experiment leans on the same foundations: [Lenis](https://lenis.darkroom.engineering)
for smooth scroll and a dependency-free spring integrator (`lib/use-spring.ts`)
that paints straight to the DOM — so nothing re-renders React mid-animation.

## Experiments

| | |
|---|---|
| **Inverted carousel** | A concave coverflow of squircle portraits that overshoots and rocks back into place on every step. Infinite loop via wrapped offsets. |
| **Liquid signup** | A pill that morphs into a close button while the signup card inflates from it like a balloon — through a droplet stage — and login/signup toggle bounces the height. |
| **Hero morph** | On one swipe a full-bleed hero collapses into a tiny squircle that lands inline in the copy, as the paragraph cascades in word by word. |

Add an entry to `lib/experiments.ts` and it shows up on the home gallery
automatically.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **Tailwind v4** — tokens live in `@theme` inside `app/globals.css`; there is no `tailwind.config`
- **Lenis** for smooth scroll (disabled under `prefers-reduced-motion`)
- Hand-rolled fixed-timestep spring — no motion library

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the next free port).

```bash
npm run build   # production build
npm run lint    # eslint
```

## Motion notes

- Animation is driven imperatively: a spring's `onChange` calls a single `paint()`
  that writes `transform` / geometry to refs. React state only flips discrete
  phases.
- Some pages accept a `?p=1` (or `defaultOpen`) query/prop to render an end
  state server-side — handy for previews and to avoid a hydration flash.
- Effects flatten `preserve-3d`, so 3D card work avoids `overflow`, `opacity`,
  `filter`, `mask`, `clip-path`, and `box-shadow` on rotated layers.

## Deploy

Hosted on Vercel. The social card (`public/og.png`) is a snapshot of the hero
experiment; OG/Twitter metadata and `metadataBase` live in `app/layout.tsx`.
