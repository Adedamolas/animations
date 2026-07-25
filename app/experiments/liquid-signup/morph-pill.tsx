import type { RefObject } from "react";
import { PILL_W, PILL_H, X_SIZE, X_INSET } from "./geometry";

/**
 * The one button that IS the widget: a "Sign up" pill when closed, morphing
 * into the panel's ✕ close-circle when open. The parent animates its size and
 * position imperatively via the refs; this only owns markup + initial state.
 */
export function MorphPill({
  pillRef,
  labelRef,
  iconRef,
  open,
  defaultOpen,
  onToggle,
}: {
  pillRef: RefObject<HTMLButtonElement | null>;
  labelRef: RefObject<HTMLSpanElement | null>;
  iconRef: RefObject<HTMLSpanElement | null>;
  open: boolean;
  defaultOpen: boolean;
  onToggle: () => void;
}) {
  const p0 = defaultOpen
    ? { w: X_SIZE, h: X_SIZE, inset: X_INSET }
    : { w: PILL_W, h: PILL_H, inset: 0 };

  return (
    <button
      ref={pillRef}
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? "Close" : "Open sign up"}
      className="pointer-events-auto absolute flex items-center justify-center overflow-hidden border border-border bg-surface-2 shadow-sm transition-[background-color,border-color,box-shadow] duration-[var(--dur-fast)] ease hover:border-border-strong hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{
        width: p0.w,
        height: p0.h,
        borderRadius: p0.h / 2,
        right: p0.inset,
        top: p0.inset,
      }}
    >
      <span
        ref={labelRef}
        className="absolute whitespace-nowrap text-[13px] font-medium text-foreground"
        style={{ opacity: defaultOpen ? 0 : 1 }}
      >
        Sign up
      </span>
      <span
        ref={iconRef}
        className="absolute text-text-secondary"
        style={{ opacity: defaultOpen ? 1 : 0 }}
        aria-hidden
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
    </button>
  );
}
