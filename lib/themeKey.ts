// Pulse Aurora has two palettes. Earlier versions saved one of eight theme names;
// those are read as light or dark without rewriting the saved preference.
export type ThemeMode = 'light' | 'dark' | 'system'
const DARK = new Set(['dark', 'elegant', 'nature'])
const LIGHT = new Set(['light', 'pastel', 'fresh', 'warm', 'minimal'])

export function normalizeTheme(t?: string | null): ThemeMode {
  if (t && DARK.has(t)) return 'dark'
  if (t && LIGHT.has(t)) return 'light'
  return 'system'
}

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem('wp-theme');var d=${JSON.stringify([...DARK])},l=${JSON.stringify([...LIGHT])};if(d.indexOf(t)>-1)document.documentElement.setAttribute('data-theme','dark');else if(l.indexOf(t)>-1)document.documentElement.setAttribute('data-theme','light')}catch(e){}`
