import type { CSSProperties, ReactNode } from "react";

/**
 * Two stacked layers whose opacity + blur are driven purely by the `--m`
 * custom property (signup=1, login=0), set once per frame on the content root.
 * opacity self-clamps; blur is floored at 0 so overshoot can't produce an
 * invalid negative blur. Used for every label that swaps between modes.
 */
const SIGNUP_LAYER: CSSProperties = {
  gridArea: "1 / 1",
  opacity: "var(--m)",
  filter: "blur(max(0px, calc((1 - var(--m)) * 4px)))",
};
const LOGIN_LAYER: CSSProperties = {
  gridArea: "1 / 1",
  opacity: "calc(1 - var(--m))",
  filter: "blur(max(0px, calc(var(--m) * 4px)))",
};

export function Cross({
  signup,
  login,
  className,
}: {
  signup: ReactNode;
  login: ReactNode;
  className?: string;
}) {
  return (
    <span className={`grid ${className ?? ""}`}>
      <span style={SIGNUP_LAYER}>{signup}</span>
      <span style={LOGIN_LAYER} aria-hidden>
        {login}
      </span>
    </span>
  );
}
