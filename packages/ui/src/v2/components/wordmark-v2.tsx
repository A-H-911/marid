import { type ComponentProps } from "solid-js"

// Marid brand lockup (v2) — the README logo (flame mark + "Marid" wordmark). The
// asset is an opaque-background PNG, so `mix-blend-mode: lighten` drops its
// near-black backdrop against the app's dark surface (#131010); only the flame +
// letters show. Kept faint (opacity + bottom fade) to preserve the watermark feel
// the v2 SVG had. App is dark-themed; a light source is a follow-up if ever needed.
export function WordmarkV2(props: Pick<ComponentProps<"img">, "class">) {
  return (
    <img
      src="/marid-logo.png"
      alt="Marid"
      classList={{ [props.class ?? ""]: !!props.class }}
      style={{
        opacity: 0.22,
        "mix-blend-mode": "lighten",
        "object-fit": "contain",
        "mask-image": "linear-gradient(to bottom, black 55%, transparent)",
        "-webkit-mask-image": "linear-gradient(to bottom, black 55%, transparent)",
      }}
    />
  )
}
