'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { normalizeTheme, type ThemeMode } from '@/lib/themeKey'

export type Theme = ThemeMode
export const THEMES: { key: Theme; label: string; emoji: string }[] = [
  { key: 'system', label: 'Otomatis', emoji: '◐' },
  { key: 'light', label: 'Terang', emoji: '☀︎' },
  { key: 'dark', label: 'Gelap', emoji: '☾' },
]

const ThemeCtx = createContext<{ theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void }>({ theme: 'system', resolved: 'light', setTheme: () => {} })

function applyAttr(t: Theme) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', t)
}
const systemDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [theme, setThemeState] = useState<Theme>('system')
  const [sysDark, setSysDark] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setSysDark(mq.matches)
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Saved choice: localStorage first (instant), then the user's profile once signed in.
  useEffect(() => {
    if (loaded) return
    let saved: Theme = 'system'
    try { saved = normalizeTheme(localStorage.getItem('wp-theme')) } catch {}
    setThemeState(saved); applyAttr(saved)
    if (!session?.user?.email) return
    fetch('/api/profile').then(r => r.ok ? r.json() : null).then(d => {
      const raw = d?.data?.preferredTheme as string | undefined
      if (raw === undefined) return
      const t = raw === 'system' ? 'system' : normalizeTheme(raw)
      setThemeState(t); applyAttr(t)
      try { t === 'system' ? localStorage.removeItem('wp-theme') : localStorage.setItem('wp-theme', t) } catch {}
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [session, loaded])

  function setTheme(t: Theme) {
    setThemeState(t); applyAttr(t)
    try { t === 'system' ? localStorage.removeItem('wp-theme') : localStorage.setItem('wp-theme', t) } catch {}
    // Only an explicit change by the user is saved to their profile.
    if (session?.user?.email) {
      fetch('/api/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferredTheme: t }) }).catch(() => {})
    }
  }

  const resolved: 'light' | 'dark' = theme === 'system' ? (sysDark || systemDark() ? 'dark' : 'light') : theme
  return <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeCtx.Provider>
}
export const useTheme = () => useContext(ThemeCtx)
