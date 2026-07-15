import { type ComponentProps } from "solid-js"

// Marid flame mark. Same teardrop silhouette as the TUI glyph (packages/tui/src/logo.ts) and the
// full-color favicon — here monochrome via the theme `--icon-*` fills so it matches the surrounding
// icon color at its call sites (session panel). Outer flame + inner core keep the two-tone structure.
export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        data-slot="logo-logo-mark-flame"
        d="M8 1.5C10.5 5 13 7 13 10.5C13 15 10.7 18.3 8 18.5C5.3 18.3 3 15 3 10.5C3 7 5.5 5 8 1.5Z"
        fill="var(--icon-strong-base)"
      />
      <path
        data-slot="logo-logo-mark-core"
        d="M8 6.5C9.4 8.6 10.5 9.9 10.5 12C10.5 14.4 9.4 16 8 16.2C6.6 16 5.5 14.4 5.5 12C5.5 9.9 6.6 8.6 8 6.5Z"
        fill="var(--icon-weak-base)"
      />
    </svg>
  )
}

// Marid flame splash (loading). Same silhouette as Mark, scaled to the 80x100 viewBox; monochrome
// via `--icon-*` so it matches the loading surface.
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
      <path
        data-slot="logo-splash-flame"
        d="M40 7.5C52.5 25 65 35 65 52.5C65 75 53.5 91.5 40 92.5C26.5 91.5 15 75 15 52.5C15 35 27.5 25 40 7.5Z"
        fill="var(--icon-strong-base)"
      />
      <path
        data-slot="logo-splash-core"
        d="M40 32.5C47 43 52.5 49.5 52.5 60C52.5 72 47 80 40 81C33 80 27.5 72 27.5 60C27.5 49.5 33 43 40 32.5Z"
        fill="var(--icon-base)"
      />
    </svg>
  )
}

// Full-color Marid flame (the promised gradient flame — same silhouette as Mark/Splash + the favicon).
// Used where the flame is the brand first-impression (boot, connection/unauthorized states) rather than
// a small monochrome UI glyph. Gradients match the favicon + TUI (#FBD24A→#F5901E→#DC2A16, core gold).
export const Flame = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-flame"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="marid-flame-edge" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stop-color="#FBD24A" />
          <stop offset="0.5" stop-color="#F5901E" />
          <stop offset="1" stop-color="#DC2A16" />
        </linearGradient>
        <linearGradient id="marid-flame-core" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stop-color="#FDEFB0" />
          <stop offset="1" stop-color="#F8B73C" />
        </linearGradient>
      </defs>
      <path
        d="M40 7.5C52.5 25 65 35 65 52.5C65 75 53.5 91.5 40 92.5C26.5 91.5 15 75 15 52.5C15 35 27.5 25 40 7.5Z"
        fill="url(#marid-flame-edge)"
      />
      <path
        d="M40 32.5C47 43 52.5 49.5 52.5 60C52.5 72 47 80 40 81C33 80 27.5 72 27.5 60C27.5 49.5 33 43 40 32.5Z"
        fill="url(#marid-flame-core)"
      />
    </svg>
  )
}

// Marid brand lockup (the README logo: flame mark + "Marid" wordmark), served as a
// transparent PNG so it drops onto any surface — including true black — with no box
// and true colors. Size/placement come from the caller's class.
export const Logo = (props: { class?: string }) => {
  return <img src="/marid-logo.png" alt="Marid" classList={{ [props.class ?? ""]: !!props.class }} />
}
