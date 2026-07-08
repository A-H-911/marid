import { createUniqueId, type ComponentProps } from "solid-js"

// Marid wordmark (v2) — "marid" block glyphs on the same 18.4286px module grid as
// the original opencode v2 wordmark, centered in the unchanged 720×129 canvas so the
// fade-mask + inner-shadow and the w-full/h-auto layout footprint are preserved. Same
// letterforms as the smaller ui Logo and the TUI MARID banner (P-2 branding).
export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  const filter = createUniqueId()
  const mask = createUniqueId()
  const maskGradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720.002 129.001"
      fill="none"
      preserveAspectRatio="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g opacity="0.16" filter={`url(#${filter})`} mask={`url(#${mask})`}>
        <g opacity="0.7" fill="currentColor">
          {/* m */}
          <rect x="157.29" y="18.43" width="18.43" height="92.14" />
          <rect x="194.15" y="18.43" width="18.43" height="92.14" />
          <rect x="231.00" y="18.43" width="18.43" height="92.14" />
          <rect x="157.29" y="18.43" width="92.14" height="18.43" />
          {/* a */}
          <rect x="267.86" y="18.43" width="73.71" height="18.43" />
          <rect x="323.15" y="18.43" width="18.43" height="92.14" />
          <rect x="267.86" y="55.29" width="73.71" height="18.43" />
          <rect x="267.86" y="55.29" width="18.43" height="55.29" />
          <rect x="267.86" y="92.14" width="73.71" height="18.43" />
          {/* r */}
          <rect x="360.00" y="18.43" width="18.43" height="92.14" />
          <rect x="360.00" y="18.43" width="73.71" height="18.43" />
          <rect x="415.29" y="36.86" width="18.43" height="18.43" />
          {/* i */}
          <rect x="452.15" y="18.43" width="18.43" height="18.43" />
          <rect x="452.15" y="55.29" width="18.43" height="55.29" />
          {/* d */}
          <rect x="544.29" y="0" width="18.43" height="110.57" />
          <rect x="489.00" y="55.29" width="18.43" height="55.29" />
          <rect x="489.00" y="55.29" width="73.71" height="18.43" />
          <rect x="489.00" y="92.14" width="73.71" height="18.43" />
        </g>
      </g>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="720" height="129">
          <rect width="720" height="129" fill={`url(#${maskGradient})`} />
        </mask>
        <linearGradient id={maskGradient} x1="360" y1="0" x2="360" y2="112" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" stop-opacity="0.7" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
        <filter
          id={filter}
          x="0"
          y="0"
          width="720.002"
          height="130.001"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          <feBlend mode="normal" in2="shape" result="effect1_innerShadow_4938_16028" />
        </filter>
      </defs>
    </svg>
  )
}
