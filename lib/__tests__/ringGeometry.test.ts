import { describe, it, expect } from 'vitest'
import { ringGeometry } from '@/lib/ringGeometry'

describe('ringGeometry', () => {
  it('computes radius, circumference and the offset for a value', () => {
    const g = ringGeometry(50, 100, 10)
    expect(g.r).toBe(45)
    expect(g.c).toBeCloseTo(2 * Math.PI * 45)
    expect(g.offset).toBeCloseTo(g.c / 2)
  })
  it('clamps values outside 0–100 and non-numbers', () => {
    expect(ringGeometry(150, 100, 10).offset).toBe(0)
    expect(ringGeometry(-20, 100, 10).offset).toBeCloseTo(ringGeometry(0, 100, 10).c)
    expect(ringGeometry(NaN, 100, 10).offset).toBeCloseTo(ringGeometry(0, 100, 10).c)
  })
  it('places the plan marker on the circle', () => {
    const g = ringGeometry(0, 100, 10, 25)
    expect(g.planDot).toEqual({ x: 50, y: 95 })
    expect(ringGeometry(0, 100, 10).planDot).toBeNull()
  })
})
