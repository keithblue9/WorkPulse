/** Selectable years: earliest year with data → max(latest data year, next year). */
export function yearsRange(dataYears: number[], now: number): number[] {
  const ys = dataYears.filter(y => Number.isInteger(y) && y > 1900)
  const lo = Math.min(now, ...ys), hi = Math.max(now + 1, ...ys)
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}

/** A saved year if it is still selectable, otherwise the current year. */
export function clampYear(saved: string | number | null | undefined, years: number[], now: number): number {
  const y = Number(saved)
  return years.includes(y) ? y : now
}
