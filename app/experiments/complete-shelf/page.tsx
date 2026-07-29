import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { CompleteShelf } from "./complete-shelf";

const meta = getExperiment("complete-shelf");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default function Page() {
  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed right-8 top-7 z-40 font-mono text-[11px] tracking-[0.18em] text-[#8a7d6d] transition-opacity hover:opacity-60"
      >
        ← PLAYGROUND
      </Link>
      <CompleteShelf />
    </main>
  );
}
