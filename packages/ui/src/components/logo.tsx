import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 80H20V40H60V80Z" fill="var(--icon-base)" />
      <path d="M60 20H20V80H60V20ZM80 100H0V0H80V100Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

// Marid wordmark — block glyphs on the same 6px grid as the original opencode
// mark (strokes 6px, body y6..36), spelling "marid" so the web surfaces match
// the TUI "MARID" banner (P-2 branding). Solid --icon-base keeps it monochrome
// + theme-adaptive; rects over packed paths so the letterforms stay editable.
export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 132 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g fill="var(--icon-base)">
        {/* m (0–30): three posts + top bar */}
        <rect x="0" y="6" width="6" height="30" />
        <rect x="12" y="6" width="6" height="30" />
        <rect x="24" y="6" width="6" height="30" />
        <rect x="0" y="6" width="30" height="6" />
        {/* a (36–60): flat top bar + full right stem + lower bowl (single-story) */}
        <rect x="36" y="6" width="24" height="6" />
        <rect x="54" y="6" width="6" height="30" />
        <rect x="36" y="18" width="24" height="6" />
        <rect x="36" y="18" width="6" height="18" />
        <rect x="36" y="30" width="24" height="6" />
        {/* r (66–90): stem + arm + shoulder */}
        <rect x="66" y="6" width="6" height="30" />
        <rect x="66" y="6" width="24" height="6" />
        <rect x="84" y="12" width="6" height="6" />
        {/* i (96–102): dot + stem */}
        <rect x="96" y="6" width="6" height="6" />
        <rect x="96" y="18" width="6" height="18" />
        {/* d (108–132): left bowl + ascending right stem (rises above body, like the original) */}
        <rect x="126" y="0" width="6" height="36" />
        <rect x="108" y="18" width="6" height="18" />
        <rect x="108" y="18" width="24" height="6" />
        <rect x="108" y="30" width="24" height="6" />
      </g>
    </svg>
  )
}
