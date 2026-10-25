// Geometry for progress rings (SVG is rotated -90° so 0% starts at 12 o'clock).
export function ringGeometry(value: number, size: number, stroke: number, plan?: number | null) {
  const clamp = (v: number) => (Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - clamp(value) / 100)
  let planDot: { x: number; y: number } | null = null
  if (plan != null && Number.isFinite(plan)) {
    const a = (clamp(plan) / 100) * 2 * Math.PI
    planDot = { x: Math.round((size / 2 + r * Math.cos(a)) * 10) / 10, y: Math.round((size / 2 + r * Math.sin(a)) * 10) / 10 }
  }
  return { r, c, offset, planDot }
}
