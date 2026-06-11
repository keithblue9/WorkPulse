'use client'
import { createContext, useContext, useEffect, useState } from 'react'

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
  const [theme, setThemeState] = useState<Theme>('dark')
  useEffect(() => {
    const saved = localStorage.getItem('wp-theme') as Theme
    if (saved) apply(saved)
  }, [])
  function apply(t: Theme) {
    setThemeState(t)
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('wp-theme', t)
  }
  return <ThemeCtx.Provider value={{ theme, setTheme: apply }}>{children}</ThemeCtx.Provider>
}
export const useTheme = () => useContext(ThemeCtx)
