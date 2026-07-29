import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { Manuals } from "./manuals";

const meta = getExperiment("manuals");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default function Page() {
  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed left-6 top-6 z-50 text-[11px] font-medium text-white/45 transition-colors hover:text-white sm:left-10 sm:top-10"
      >
        ← Playground
      </Link>
      <Manuals />
    </main>
  );
}
