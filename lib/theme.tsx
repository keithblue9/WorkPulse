'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export type Theme = 'dark'|'light'|'elegant'|'pastel'|'nature'|'fresh'|'warm'|'minimal'
export const THEMES: { key: Theme; label: string; emoji: string }[] = [
  { key:'dark',    label:'Dark',     emoji:'🌑' },
  { key:'light',   label:'Clean',    emoji:'☀️' },
  { key:'elegant', label:'Elegant',  emoji:'💜' },
  { key:'pastel',  label:'Pastel',   emoji:'🌸' },
  { key:'nature',  label:'Nature',   emoji:'🌿' },
  { key:'fresh',   label:'Fresh',    emoji:'🌊' },
  { key:'warm',    label:'Warm',     emoji:'🍂' },
  { key:'minimal', label:'Minimal',  emoji:'🪶' },
]

const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({ theme:'dark', setTheme:()=>{} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data:session } = useSession()
  const [theme, setThemeState] = useState<Theme>('dark')
  const [loaded, setLoaded] = useState(false)

  // Initial load: from user profile (if logged in) -> localStorage
  useEffect(() => {
    if (loaded) return
    async function load() {
      // localStorage fallback (used pre-login and as cache)
      const saved = localStorage.getItem('wp-theme') as Theme
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved)
        setThemeState(saved)
      }
      // If logged in, fetch user's saved theme
      if (session?.user?.email) {
        try {
          const r = await fetch('/api/profile')
          const d = await r.json()
          const userTheme = d.data?.preferredTheme as Theme
          if (userTheme) {
            document.documentElement.setAttribute('data-theme', userTheme)
            localStorage.setItem('wp-theme', userTheme)
            setThemeState(userTheme)
          }
        } catch {}
      }
      setLoaded(true)
    }
    load()
  }, [session, loaded])

  function apply(t: Theme) {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('wp-theme', t)
    // Persist to user profile if logged in
    if (session?.user?.email) {
      fetch('/api/profile', {
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ preferredTheme: t })
      }).catch(()=>{})
    }
  }

  return <ThemeCtx.Provider value={{ theme, setTheme: apply }}>{children}</ThemeCtx.Provider>
}
export const useTheme = () => useContext(ThemeCtx)
