import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { CardFlight } from "./card-flight";

const meta = getExperiment("card-flight");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  // ?p=<0..1> freezes the choreography at a given progress for previewing.
  const { p } = await searchParams;
  const previewP = p !== undefined ? Math.max(0, Math.min(1, Number(p) || 0)) : undefined;

  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed left-6 top-6 z-50 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-secondary sm:left-10 sm:top-10"
      >
        ← Playground
      </Link>
      <CardFlight previewP={previewP} />
    </main>
  );
}
