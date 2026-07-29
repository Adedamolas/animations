import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { LiquidDock } from "./liquid-dock";

const meta = getExperiment("liquid-dock");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default function Page() {
  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed left-6 top-16 z-40 text-[13px] font-medium text-white mix-blend-exclusion transition-opacity hover:opacity-70"
      >
        ← Playground
      </Link>
      <LiquidDock />
    </main>
  );
}
