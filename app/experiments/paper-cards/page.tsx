import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { PaperCards } from "./paper-cards";

const meta = getExperiment("paper-cards");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pos?: string }>;
}) {
  const { pos } = await searchParams;
  const previewPos = pos !== undefined ? Number(pos) || 0 : undefined;

  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed left-6 top-6 z-50 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-secondary sm:left-10 sm:top-10"
      >
        ← Playground
      </Link>
      <PaperCards previewPos={previewPos} />
    </main>
  );
}
