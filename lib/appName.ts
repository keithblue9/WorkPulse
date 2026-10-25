// The app is called WINS. Older config documents may still hold a previous product
// name (or nothing); those are shown as WINS without rewriting the stored value.
// Any other name an admin sets in Configuration is shown as-is.
export const DEFAULT_APP_NAME = 'WINS'
const LEGACY_NAMES = new Set(['', 'workpulse', 'wins', 'work intelligence system'])

export function displayAppName(name?: string | null): string {
  const n = String(name ?? '').trim()
  return LEGACY_NAMES.has(n.toLowerCase()) ? DEFAULT_APP_NAME : n
}
