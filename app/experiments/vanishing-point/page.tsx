import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { VanishingPoint } from "./vanishing-point";

const meta = getExperiment("vanishing-point");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pos?: string }>;
}) {
  // ?pos=<n> freezes the row at a step for previewing.
  const { pos } = await searchParams;
  const previewPos = pos !== undefined ? Number(pos) || 0 : undefined;

  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed bottom-5 right-6 z-50 text-[11px] font-medium text-[#8d8880] transition-colors hover:text-[#211f1c] sm:right-10"
      >
        ← Playground
      </Link>
      <VanishingPoint previewPos={previewPos} />
    </main>
  );
}
