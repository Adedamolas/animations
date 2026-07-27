import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { MorphMenu, type View } from "./morph-menu";

const meta = getExperiment("morph-menu");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

const VIEWS = ["collapsed", "menu", "inquiry", "newsletter", "about"];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const { v } = await searchParams;
  const initialView = (VIEWS.includes(v ?? "") ? v : "collapsed") as View;
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 py-16">
      <Link
        href="/"
        className="fixed left-6 top-6 z-50 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-secondary sm:left-10 sm:top-10"
      >
        ← Playground
      </Link>

      <div className="grid min-h-[580px] place-items-center">
        <MorphMenu initialView={initialView} />
      </div>
    </main>
  );
}
