import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { HeroMorph } from "./hero-morph";

const meta = getExperiment("hero-morph");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  // Full-viewport takeover — the component owns the whole screen and the swipe.
  // ?p=1 renders the morphed (paragraph) state for previewing.
  const { p } = await searchParams;
  return <HeroMorph initialPhase={p === "1" ? 1 : 0} />;
}
