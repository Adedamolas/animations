import Link from "next/link";
import { experiments } from "@/lib/experiments";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-8 py-20">
      <header className="max-w-[560px]">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Animations
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-text-secondary">
          A playground for pouring out motion ideas — built on Lenis and a
          hand-rolled spring, following the house design & motion system.
        </p>
      </header>

      <ul className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {experiments.map((exp) => (
          <li key={exp.slug}>
            <Link
              href={`/experiments/${exp.slug}`}
              className="group block rounded-lg border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-[var(--dur-fast)] ease-out hover:border-border-strong hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[13px] font-medium text-foreground">
                  {exp.title}
                </h2>
                <span className="text-xs text-text-tertiary tabular-nums">
                  {exp.date}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-text-secondary">
                {exp.blurb}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                Open
                <span className="transition-transform duration-[var(--dur-fast)] ease-out group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
