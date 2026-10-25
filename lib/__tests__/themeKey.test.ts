import { describe, it, expect } from 'vitest'
import { normalizeTheme } from '@/lib/themeKey'

describe('normalizeTheme', () => {
  it('maps the old dark-family themes to dark', () => {
    for (const t of ['dark', 'elegant', 'nature']) expect(normalizeTheme(t)).toBe('dark')
  })
  it('maps the old light-family themes to light', () => {
    for (const t of ['light', 'pastel', 'fresh', 'warm', 'minimal']) expect(normalizeTheme(t)).toBe('light')
  })
  it('falls back to system for unknown or missing values', () => {
    for (const t of [null, undefined, '', 'system', 'neon']) expect(normalizeTheme(t as any)).toBe('system')
  })
})
