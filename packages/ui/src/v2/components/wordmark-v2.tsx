import { type ComponentProps } from "solid-js"

// Marid brand lockup (v2) — the README logo (flame + "Marid"), served as a
// transparent PNG so it sits on any surface (incl. true black) with no box and
// true colors. Size/placement come from the caller's class.
export function WordmarkV2(props: Pick<ComponentProps<"img">, "class">) {
  return <img src="/marid-logo.png" alt="Marid" classList={{ [props.class ?? ""]: !!props.class }} />
}
