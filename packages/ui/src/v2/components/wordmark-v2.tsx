import { type ComponentProps } from "solid-js"
import { Logo } from "../../components/logo"

// Marid brand lockup (v2) — the flame + "Marid" wordmark on the new-session hero. Renders the
// shared inline-SVG Logo lockup (crisp, transparent, no box/halo, two-tone wordmark) so it matches
// the flame/favicon rebrand and the review artifact. Size/placement come from the caller's class.
export function WordmarkV2(props: Pick<ComponentProps<"img">, "class">) {
  return <Logo class={props.class} />
}
