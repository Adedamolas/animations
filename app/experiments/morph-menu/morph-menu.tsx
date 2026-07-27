"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSpring } from "@/lib/use-spring";

/* ── Morphing menu ───────────────────────────────────────────────────────────
   One container that morphs between very different forms — a collapsed pill, a
   menu list, a tall inquiry form, a compact newsletter, an about panel. The box
   springs between each form's size while the content crossfades, so it reads as
   a single object reshaping itself (à la the liquid signup). */

export type View = "collapsed" | "menu" | "inquiry" | "newsletter" | "about";

const SIZE: Record<View, { w: number; h: number }> = {
  collapsed: { w: 132, h: 44 },
  menu: { w: 316, h: 252 },
  inquiry: { w: 372, h: 548 },
  newsletter: { w: 344, h: 198 },
  about: { w: 344, h: 292 },
};
const TITLE: Record<View, string> = {
  collapsed: "",
  menu: "Menu",
  inquiry: "Inquiry",
  newsletter: "Newsletter",
  about: "About",
};
const HEADER_H = 46;

// Underdamped → the box overshoots its target size and springs back, so the
// morph has that liquid-signup bounce.
const SPRING = { stiffness: 260, damping: 17, mass: 1 };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export function MorphMenu({ initialView = "collapsed" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [outgoing, setOutgoing] = useState<View>(initialView);
  const viewRef = useRef<View>(initialView);
  const prevRef = useRef<View>(initialView);

  const boxRef = useRef<HTMLDivElement>(null);
  const bodyCurRef = useRef<HTMLDivElement>(null);
  const bodyPrevRef = useRef<HTMLDivElement>(null);
  const titleCurRef = useRef<HTMLDivElement>(null);
  const titlePrevRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);

  const paintRef = useRef<() => void>(() => {});
  const spring = useSpring(1, () => paintRef.current(), SPRING);

  const paint = useCallback(() => {
    const tr = spring.current(); // raw — can overshoot past 1 for the bounce
    const t = clamp01(tr);
    const a = prevRef.current;
    const b = viewRef.current;

    const box = boxRef.current;
    if (box) {
      box.style.width = `${mix(SIZE[a].w, SIZE[b].w, tr)}px`;
      box.style.height = `${mix(SIZE[a].h, SIZE[b].h, tr)}px`;
    }
    if (bodyPrevRef.current) bodyPrevRef.current.style.opacity = String(1 - seg(t, 0, 0.42));
    if (bodyCurRef.current) bodyCurRef.current.style.opacity = String(seg(t, 0.42, 1));
    if (titlePrevRef.current) titlePrevRef.current.style.opacity = String(1 - seg(t, 0, 0.45));
    if (titleCurRef.current) titleCurRef.current.style.opacity = String(seg(t, 0.45, 1));
    // the back chevron fades in once we're past the collapsed pill
    if (chevronRef.current) {
      chevronRef.current.style.opacity = String(b === "collapsed" ? 1 - t : t);
      chevronRef.current.style.pointerEvents = b === "collapsed" ? "none" : "auto";
    }
  }, [spring]);

  const go = useCallback(
    (next: View) => {
      if (next === viewRef.current) return;
      prevRef.current = viewRef.current;
      viewRef.current = next;
      setOutgoing(prevRef.current);
      setView(next);
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) spring.jump(1);
      else {
        spring.jump(0);
        spring.set(1);
      }
    },
    [spring],
  );

  useEffect(() => {
    paintRef.current = paint;
    paint();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") go(viewRef.current === "menu" ? "collapsed" : "menu");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paint, go]);

  const back = () => go(view === "menu" ? "collapsed" : "menu");

  return (
    <div
      ref={boxRef}
      onClick={() => view === "collapsed" && go("menu")}
      className={`relative overflow-hidden rounded-[26px] bg-[#4a4a4d] text-white shadow-2xl ${
        view === "collapsed" ? "cursor-pointer" : ""
      }`}
      style={{ width: SIZE[initialView].w, height: SIZE[initialView].h }}
    >
      {/* Header */}
      <div className="absolute inset-x-0 top-0 flex items-center px-4" style={{ height: HEADER_H }}>
        <button
          ref={chevronRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            back();
          }}
          aria-label="Back"
          className="grid size-6 place-items-center rounded-full text-white/80 transition-colors hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="relative flex-1 text-center text-[13px] font-medium">
          <div ref={titlePrevRef} className="absolute inset-0">{TITLE[outgoing]}</div>
          <div ref={titleCurRef}>{TITLE[view]}</div>
        </div>
        <div className="size-6" />
      </div>

      {/* Collapsed handle */}
      {view === "collapsed" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-1 w-8 rounded-full bg-white/50" />
        </div>
      )}

      {/* Body — white card holding the active form, crossfaded */}
      <div className="absolute inset-x-[6px] bottom-[6px]" style={{ top: HEADER_H }}>
        <div className="relative h-full overflow-hidden rounded-[20px] bg-white text-foreground">
          <div ref={bodyPrevRef} className="absolute inset-0">
            <Body view={outgoing} go={go} />
          </div>
          <div ref={bodyCurRef} className="absolute inset-0">
            <Body view={view} go={go} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Body({ view, go }: { view: View; go: (v: View) => void }) {
  if (view === "menu") return <MenuBody go={go} />;
  if (view === "inquiry") return <InquiryBody />;
  if (view === "newsletter") return <NewsletterBody />;
  if (view === "about") return <AboutBody />;
  return null;
}

function Row({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2 active:scale-[0.99]"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-text-secondary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-text-tertiary">{sub}</span>
      </span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

function MenuBody({ go }: { go: (v: View) => void }) {
  return (
    <div className="flex h-full flex-col gap-1 p-2.5">
      <Row onClick={() => go("inquiry")} label="Submit a Project" sub="Brand collab or a build" icon={<IconSend />} />
      <Row onClick={() => go("about")} label="About Me" sub="Who's behind the work" icon={<IconUser />} />
      <Row onClick={() => go("newsletter")} label="Newsletter" sub="Occasional, worth it" icon={<IconMail />} />
    </div>
  );
}

function Option({ label, sub, active, onClick }: { label: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-[border-color,background-color] ${
        active ? "border-foreground/70 bg-surface-2" : "border-border hover:border-border-strong"
      }`}
    >
      <span>
        <span className="block text-[13px] font-semibold text-foreground">{label}</span>
        <span className="block text-[11px] text-text-tertiary">{sub}</span>
      </span>
      <span className={`grid size-4 place-items-center rounded-full border ${active ? "border-foreground" : "border-border-strong"}`}>
        {active && <span className="size-2 rounded-full bg-foreground" />}
      </span>
    </button>
  );
}

function InquiryBody() {
  const [type, setType] = useState<"brand" | "project">("project");
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="text-[12px] font-medium text-text-secondary">Select inquiry type</div>
      <Option label="Brand Collab" sub="Partnerships & sponsorships" active={type === "brand"} onClick={() => setType("brand")} />
      <Option label="Project" sub="A product, site, or system" active={type === "project"} onClick={() => setType("project")} />

      <div className="mt-1 grid size-9 place-items-center rounded-lg bg-surface-2 text-text-secondary"><IconSend /></div>
      <div>
        <div className="text-[17px] font-semibold tracking-tight text-foreground">Business Inquiry</div>
        <div className="text-[12px] text-text-tertiary">Tell me what you have in mind.</div>
      </div>

      <input placeholder="Company or brand" className="h-10 rounded-lg bg-surface-2 px-3 text-[13px] outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-ring/30" />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex h-10 items-center justify-between rounded-lg bg-surface-2 px-3 text-[13px] text-text-tertiary">Budget <IconChevron /></div>
        <div className="flex h-10 items-center justify-between rounded-lg bg-surface-2 px-3 text-[13px] text-text-tertiary">Timeline <IconChevron /></div>
      </div>
      <textarea placeholder="Tell us about the project" rows={3} className="resize-none rounded-lg bg-surface-2 p-3 text-[13px] outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-ring/30" />
      <button type="button" className="mt-auto h-11 rounded-xl bg-[#4a4a4d] text-[13px] font-medium text-white transition-transform active:scale-[0.98]">Submit</button>
    </div>
  );
}

function NewsletterBody() {
  return (
    <div className="flex h-full flex-col justify-center gap-3.5 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-surface-2 text-text-secondary"><IconMail /></span>
        <div>
          <div className="text-[15px] font-semibold text-foreground">Sign up for the newsletter</div>
          <div className="text-[12px] text-text-tertiary">Occasional notes on the craft.</div>
        </div>
      </div>
      <div className="flex gap-2">
        <input placeholder="Your email" className="h-10 flex-1 rounded-lg bg-surface-2 px-3 text-[13px] outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-ring/30" />
        <button type="button" className="h-10 shrink-0 rounded-lg bg-[#4a4a4d] px-4 text-[13px] font-medium text-white transition-transform active:scale-[0.98]">Subscribe</button>
      </div>
    </div>
  );
}

function AboutBody() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="size-12 rounded-full bg-gradient-to-br from-[#c9b8d8] to-[#3a3550]" />
      <div className="text-[15px] font-semibold text-foreground">Adedamola</div>
      <p className="text-[13px] leading-5 text-text-secondary">
        Design engineer building fluid, physics-driven interfaces. This playground is where the motion ideas get poured out.
      </p>
      <div className="mt-auto flex gap-2">
        <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] text-text-secondary">Design</span>
        <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] text-text-secondary">Engineering</span>
        <span className="rounded-md bg-surface-2 px-2.5 py-1 text-[11px] text-text-secondary">Motion</span>
      </div>
    </div>
  );
}

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
);
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21a8 8 0 1 0-16 0" /><circle cx="12" cy="7" r="4" /></svg>
);
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="m3 6 9 6 9-6" /></svg>
);
const IconChevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);
