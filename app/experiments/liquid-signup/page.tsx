import Link from "next/link";
import type { Metadata } from "next";
import { getExperiment } from "@/lib/experiments";
import { LiquidSignup } from "./liquid-signup";

const meta = getExperiment("liquid-signup");

export const metadata: Metadata = {
  title: meta ? `${meta.title} — Animations` : "Animations",
  description: meta?.blurb,
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; mode?: string }>;
}) {
  // Dev convenience: ?open=1 renders open; ?mode=login renders login mode.
  const { open, mode } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-[1100px] px-8 pt-10">
        <Link
          href="/"
          className="text-[13px] text-text-secondary transition-colors duration-[var(--dur-fast)] hover:text-foreground"
        >
          ← Playground
        </Link>
      </header>

      {/* The stage — the widget lives at the top right, like real site chrome */}
      <div className="relative mx-auto mt-6 w-full max-w-[1100px] flex-1 px-8">
        <div className="relative h-[560px] overflow-hidden rounded-lg border border-dashed border-border-strong">
          <LiquidSignup
            defaultOpen={open === "1"}
            defaultMode={mode === "login" ? "login" : "signup"}
          />
        </div>
      </div>

      <footer className="mx-auto w-full max-w-[1100px] px-8 pb-10 pt-6 text-center">
        <p className="text-xs text-text-tertiary">
          Click the pill — and try clicking ✕ mid-inflate. The spring carries
          the velocity both ways.
        </p>
      </footer>
    </main>
  );
}
