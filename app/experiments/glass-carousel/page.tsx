import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { GlassCarousel } from "./glass-carousel";

const meta = getExperiment("glass-carousel");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default function Page() {
  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed left-6 top-6 z-[60] text-[13px] font-medium text-white mix-blend-exclusion transition-opacity hover:opacity-70"
      >
        ← Playground
      </Link>
      <GlassCarousel />
    </main>
  );
}
