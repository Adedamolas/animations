import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { HiddenBalance } from "./hidden-balance";

const meta = getExperiment("hidden-balance");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ hidden?: string }>;
}) {
  const { hidden } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-[1100px] px-6 pt-10 sm:px-8">
        <Link
          href="/"
          className="text-[13px] text-text-secondary transition-colors duration-[var(--dur-fast)] hover:text-foreground"
        >
          ← Playground
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <HiddenBalance initialHidden={hidden === "1"} />
      </div>

      <footer className="mx-auto w-full max-w-[1100px] px-6 pb-10 text-center sm:px-8">
        <p className="text-xs text-text-tertiary">
          Tap the eye — the shimmer sweeps and shatters the balance, and
          reassembles it on the way back.
        </p>
      </footer>
    </main>
  );
}
