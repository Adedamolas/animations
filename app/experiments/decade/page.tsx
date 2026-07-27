import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { Decade } from "./decade";

const meta = getExperiment("decade");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ a?: string }>;
}) {
  // ?a=<n> selects the initially-active year for previewing.
  const { a } = await searchParams;
  const initialActive = a !== undefined ? Math.max(0, Math.min(8, Number(a) || 0)) : 3;

  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed right-6 top-7 z-50 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-secondary sm:right-8"
      >
        ← Playground
      </Link>
      <Decade initialActive={initialActive} />
    </main>
  );
}
