import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { FolderInteraction } from "./folder-interaction";

const meta = getExperiment("folder");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  return (
    <main className="relative">
      <Link
        href="/"
        className="fixed left-6 top-6 z-[500] text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-secondary sm:left-10 sm:top-10"
      >
        ← Playground
      </Link>
      <FolderInteraction initialOpen={open === "1"} />
    </main>
  );
}
