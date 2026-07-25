import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { InvertedCarousel } from "./inverted-carousel";

const meta = getExperiment("inverted-carousel");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-[1100px] px-8 pt-10">
        <Link
          href="/"
          className="text-[13px] text-text-secondary transition-colors duration-[var(--dur-fast)] hover:text-foreground"
        >
          ← Playground
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <InvertedCarousel />
      </div>

      <footer className="mx-auto w-full max-w-[1100px] px-8 pb-10 text-center">
        <p className="text-xs text-text-tertiary">
          Swipe, tap a card, use the arrows, or the ← / → keys.
        </p>
      </footer>
    </main>
  );
}
