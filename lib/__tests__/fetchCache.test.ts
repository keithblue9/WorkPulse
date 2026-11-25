import { describe, it, expect } from 'vitest'
import { isBackgroundRequest } from '@/lib/fetchCache'

describe('isBackgroundRequest — POST latar belakang tidak memicu reload dashboard', () => {
  it('mengenali heartbeat & polling otomatis', () => {
    expect(isBackgroundRequest('/api/presence')).toBe(true)
    expect(isBackgroundRequest('https://app.example.com/api/presence')).toBe(true)
    expect(isBackgroundRequest('/api/quicknotes/check-reminders')).toBe(true)
    expect(isBackgroundRequest('/api/push/subscribe')).toBe(true)
    expect(isBackgroundRequest('/api/auth/session')).toBe(true)
    expect(isBackgroundRequest('/api/version')).toBe(true)
    expect(isBackgroundRequest('/api/warmup?x=1')).toBe(true)
  })
  it('tetap menganggap simpan/ubah/hapus data sebagai perubahan', () => {
    for (const u of ['/api/notes', '/api/notes/abc', '/api/projects', '/api/config', '/api/quicknotes', '/api/todos/1', '/api/attendance']) {
      expect(isBackgroundRequest(u)).toBe(false)
    }
  })
  it('tidak salah cocok pada path yang mirip', () => {
    expect(isBackgroundRequest('/api/presence-report')).toBe(false)
    expect(isBackgroundRequest('/api/authors')).toBe(false)
    expect(isBackgroundRequest('/api/quicknotes/check-reminders-old')).toBe(false)
  })
})
