import { describe, expect, it } from 'vitest'
import { heroFor, isHeroKind, otherYearHint } from '../hero'

describe('hero', () => {
  it('validasi & fallback', () => {
    expect(isHeroKind('presensi')).toBe(true); expect(isHeroKind('x')).toBe(false)
    expect(heroFor('agenda', true)).toBe('agenda'); expect(heroFor(undefined, true)).toBe('progress')
    expect(heroFor('fokus', false)).toBe('progress'); expect(heroFor('fokus', true)).toBe('fokus')
  })
  it('petunjuk tahun lain terdekat', () => {
    const items = [...Array(24)].map(() => ({ year: 2027 })).concat([{ year: 2025 }, { year: 2026 }])
    expect(otherYearHint(items, 2026)).toEqual({ year: 2027, n: 24 })
    expect(otherYearHint([{ year: 2026 }], 2026)).toBeNull()
    expect(otherYearHint([{ year: 2024 }, { year: 2028 }], 2026)).toEqual({ year: 2028, n: 1 })
  })
})
