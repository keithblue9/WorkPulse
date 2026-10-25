import { describe, it, expect } from 'vitest'
import { decideAccess } from '@/lib/access'

const d = (pathname: string, method = 'GET', roles: string[] | null = null, search = '') => decideAccess({ pathname, method, roles, search })

describe('decideAccess — API', () => {
  it('rejects anonymous API calls with 401', () => {
    expect(d('/api/users')).toMatchObject({ kind: 'deny', status: 401 })
    expect(d('/api/projects', 'POST')).toMatchObject({ kind: 'deny', status: 401 })
  })
  it('keeps auth, warmup and cron public', () => {
    expect(d('/api/auth/session').kind).toBe('next')
    expect(d('/api/auth/callback/credentials', 'POST').kind).toBe('next')
    expect(d('/api/warmup').kind).toBe('next')
    expect(d('/api/cron/reminders').kind).toBe('next')
  })
  it('allows only the login slice of config anonymously', () => {
    expect(d('/api/config', 'GET', null, '?scope=login').kind).toBe('next')
    expect(d('/api/config', 'GET', null, '').kind).toBe('deny')
    expect(d('/api/config', 'PATCH', null, '?scope=login').kind).toBe('deny')
  })
  it('lets guests read dashboard data but not write', () => {
    expect(d('/api/dashboard', 'GET', ['guest']).kind).toBe('next')
    expect(d('/api/projects', 'GET', ['guest']).kind).toBe('next')
    expect(d('/api/projects', 'POST', ['guest'])).toMatchObject({ kind: 'deny', status: 403 })
    expect(d('/api/reimbursements', 'GET', ['guest'])).toMatchObject({ kind: 'deny', status: 403 })
    expect(d('/api/presence', 'POST', ['guest']).kind).toBe('next')
    expect(d('/api/links/abc123', 'PATCH', ['guest']).kind).toBe('next')
  })
  it('does not treat a lookalike path as an allowed prefix', () => {
    expect(d('/api/usersx', 'GET', ['guest']).kind).toBe('deny')
  })
  it('restricts admin endpoints to admins', () => {
    expect(d('/api/admin/reset', 'POST', ['member'])).toMatchObject({ kind: 'deny', status: 403 })
    expect(d('/api/admin/reset', 'POST', ['admin']).kind).toBe('next')
  })
  it('restricts creating and deleting members to admin or manager', () => {
    expect(d('/api/users', 'POST', ['member']).kind).toBe('deny')
    expect(d('/api/users/abc', 'DELETE', ['member']).kind).toBe('deny')
    expect(d('/api/users', 'POST', ['manager']).kind).toBe('next')
    expect(d('/api/users/abc', 'PATCH', ['member']).kind).toBe('next')
  })
  it('lets internal users through', () => {
    expect(d('/api/reimbursements', 'POST', ['member', 'cashier']).kind).toBe('next')
  })
})

describe('decideAccess — pages', () => {
  it('redirects anonymous dashboard visits to login with a callback', () => {
    expect(d('/dashboard/progress')).toEqual({ kind: 'redirect', to: '/login?callbackUrl=%2Fdashboard%2Fprogress' })
  })
  it('keeps guests on the guest pages', () => {
    expect(d('/dashboard', 'GET', ['guest']).kind).toBe('next')
    expect(d('/dashboard/links', 'GET', ['guest']).kind).toBe('next')
    expect(d('/dashboard/members', 'GET', ['guest'])).toEqual({ kind: 'redirect', to: '/dashboard' })
  })
  it('leaves public pages alone', () => {
    expect(d('/login').kind).toBe('next')
    expect(d('/').kind).toBe('next')
  })
})

import { forbiddenUserFields, sanitizeUser } from '@/lib/access'

describe('forbiddenUserFields', () => {
  it('blocks members from changing roles, PIN or active flag', () => {
    expect(forbiddenUserFields({ roles: ['admin'], status: 'TAD' }, ['member'])).toEqual(['roles'])
    expect(forbiddenUserFields({ password: '1', active: false }, ['member']).sort()).toEqual(['active', 'password'])
  })
  it('lets members change ordinary fields such as status', () => {
    expect(forbiddenUserFields({ status: 'TAD' }, ['member'])).toEqual([])
  })
  it('lets admins and managers change anything', () => {
    expect(forbiddenUserFields({ roles: ['admin'], password: 'x' }, ['admin'])).toEqual([])
    expect(forbiddenUserFields({ roles: ['member'] }, ['manager'])).toEqual([])
  })
})

describe('sanitizeUser', () => {
  const u = { _id: '1', name: 'A', email: 'a@x', password: 'h', fonnteToken: 't', noKtp: '317', noRekening: '123', status: 'TAD' }
  it('never returns the PIN hash or the Fonnte token', () => {
    const s = sanitizeUser(u, ['member'])
    expect(s).not.toHaveProperty('password')
    expect(s).not.toHaveProperty('fonnteToken')
    expect(s).toHaveProperty('noKtp', '317')
  })
  it('returns only directory fields to guests', () => {
    expect(sanitizeUser(u, ['guest'])).toEqual({ _id: '1', name: 'A', email: 'a@x', status: 'TAD' })
  })
})
