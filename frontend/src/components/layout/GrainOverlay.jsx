export function GrainOverlay() {
  return (
    <svg className="grain" width="100%" height="100%" aria-hidden="true">
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves={2} stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noise)" />
    </svg>
  )
}
