import { describe, it, expect } from 'vitest'
import { yearsRange, clampYear } from '@/lib/yearRange'

describe('yearsRange', () => {
  it('runs from the earliest data year to next year', () => {
    expect(yearsRange([2025, 2026], 2026)).toEqual([2025, 2026, 2027])
  })
  it('includes older data years', () => {
    expect(yearsRange([2023], 2026)).toEqual([2023, 2024, 2025, 2026, 2027])
  })
  it('includes a planned year beyond next year', () => {
    expect(yearsRange([2025, 2029], 2026)).toEqual([2025, 2026, 2027, 2028, 2029])
  })
  it('ignores junk values', () => {
    expect(yearsRange([NaN as any, 0, 2026], 2026)).toEqual([2026, 2027])
  })
})

describe('clampYear', () => {
  it('keeps a saved year inside the range, otherwise falls back to now', () => {
    expect(clampYear('2025', [2025, 2026, 2027], 2026)).toBe(2025)
    expect(clampYear('1999', [2025, 2026, 2027], 2026)).toBe(2026)
    expect(clampYear(null, [2025, 2026, 2027], 2026)).toBe(2026)
  })
})
