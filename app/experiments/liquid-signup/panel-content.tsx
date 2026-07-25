import type { RefObject } from "react";
import { Cross } from "./cross";
import { SsoButton, GoogleIcon, AppleIcon } from "./sso";
import { NAME_INNER, type Mode } from "./geometry";

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-card px-3 text-[13px] text-foreground shadow-sm transition-[border-color,box-shadow] duration-[var(--dur-fast)] ease-out placeholder:text-text-tertiary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

function Field({
  id,
  label,
  type,
  placeholder,
  aside,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className={INPUT_CLASS}
      />
    </div>
  );
}

/**
 * The panel's form. Purely presentational — the parent drives all motion
 * imperatively through the refs it registers here (per-row for the entrance +
 * jelly, the content root for the mode crossfade `--m`, the name row for its
 * collapse). Mode-swapping labels use <Cross>.
 */
export function PanelContent({
  contentRef,
  rowRefs,
  nameRef,
  open,
  onToggleMode,
  defaultOpen,
  defaultMode,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  rowRefs: RefObject<(HTMLDivElement | null)[]>;
  nameRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  onToggleMode: () => void;
  defaultOpen: boolean;
  defaultMode: Mode;
}) {
  const rowStyle = { opacity: defaultOpen ? 1 : 0 };

  return (
    <div
      ref={contentRef}
      className="pointer-events-auto absolute inset-0 flex origin-top-right flex-col p-5 will-change-transform"
      style={
        {
          "--m": defaultMode === "signup" ? 1 : 0,
          visibility: defaultOpen ? "visible" : "hidden",
        } as React.CSSProperties
      }
      aria-hidden={!open}
    >
      <div ref={(el) => { rowRefs.current[0] = el; }} style={rowStyle}>
        <h2 className="text-lg font-semibold leading-none tracking-tight text-foreground">
          <Cross signup="Sign up" login="Log in" />
        </h2>
      </div>

      <div
        ref={(el) => { rowRefs.current[1] = el; }}
        style={rowStyle}
        className="mt-2 flex items-center gap-1 text-[13px] text-text-secondary"
      >
        <Cross
          signup="Already have an account?"
          login="Don't have an account?"
        />
        <button
          type="button"
          onClick={onToggleMode}
          className="font-medium text-primary hover:underline"
        >
          <Cross signup="Log in" login="Sign up" />
        </button>
      </div>

      <div ref={(el) => { rowRefs.current[2] = el; }} style={rowStyle} className="mt-4 flex gap-2">
        <SsoButton label="Continue with Google" icon={<GoogleIcon />} />
        <SsoButton label="Continue with Apple" icon={<AppleIcon />} />
      </div>

      <div
        ref={(el) => { rowRefs.current[3] = el; }}
        style={rowStyle}
        className="my-3 flex items-center gap-3"
      >
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* Name — signup-only, collapses in login mode */}
      <div ref={(el) => { rowRefs.current[4] = el; }} style={rowStyle}>
        <div
          ref={nameRef}
          className="overflow-hidden"
          style={{
            height: NAME_INNER * (defaultMode === "signup" ? 1 : 0),
            opacity: "var(--m)",
            filter: "blur(max(0px, calc((1 - var(--m)) * 5px)))",
          }}
        >
          <div className="flex flex-col gap-1.5 pb-4">
            <Field
              id="liquid-name"
              label="Full name"
              type="text"
              placeholder="Ada Lovelace"
            />
          </div>
        </div>
      </div>

      <div ref={(el) => { rowRefs.current[5] = el; }} style={rowStyle} className="grid grid-cols-2 gap-2">
        <Field
          id="liquid-email"
          label="Email"
          type="email"
          placeholder="you@example.com"
        />
        <Field
          id="liquid-password"
          label="Password"
          type="password"
          placeholder="Password"
          aside={
            <button
              type="button"
              className="text-xs text-text-tertiary hover:text-text-secondary"
            >
              Forgot?
            </button>
          }
        />
      </div>

      <div ref={(el) => { rowRefs.current[6] = el; }} style={rowStyle} className="mt-auto">
        <button
          type="button"
          className="flex h-9 w-full items-center justify-center rounded-md bg-primary text-[13px] font-medium text-primary-foreground shadow-sm transition-[background-color,transform] duration-[var(--dur-press)] ease-out hover:bg-primary-hover active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1"
        >
          <Cross signup="Create account" login="Log in" />
        </button>
      </div>
    </div>
  );
}
