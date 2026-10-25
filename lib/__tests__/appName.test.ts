import { describe, it, expect } from 'vitest'
import { displayAppName, DEFAULT_APP_NAME } from '@/lib/appName'

describe('displayAppName', () => {
  it('shows WINS for empty and legacy names', () => {
    for (const n of [undefined, null, '', '  ', 'WorkPulse', 'WinS', 'Work Intelligence System', 'workpulse']) expect(displayAppName(n as any), String(n)).toBe('WINS')
    expect(DEFAULT_APP_NAME).toBe('WINS')
  })
  it('keeps a custom name set in Configuration', () => {
    expect(displayAppName('Tim BPD')).toBe('Tim BPD')
    expect(displayAppName('  WINS Pro ')).toBe('WINS Pro')
  })
})
