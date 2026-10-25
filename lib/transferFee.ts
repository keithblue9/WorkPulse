// Biaya antar bank otomatis (pure). Bank tujuan berbeda dari bank sumber → kena biaya default.
export type FeeCfg = { pettyBank?: string; cashCardBank?: string; amount?: number; auto?: boolean } | null | undefined

/** "Bank Mandiri (Persero)", "mandiri", "MANDIRI " → "mandiri"; "Bank Rakyat Indonesia" → "bri". */
export function normBank(s: unknown): string {
  let x = String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\b(bank|pt|tbk|persero)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const alias: Record<string, string> = { 'rakyat indonesia': 'bri', 'negara indonesia': 'bni', 'central asia': 'bca', 'tabungan negara': 'btn', 'syariah indonesia': 'bsi', 'cimb niaga': 'cimb', 'mandiri syariah': 'bsi' }
  for (const [k, v] of Object.entries(alias)) if (x.includes(k)) x = v
  return x
}

export function sourceBankOf(cfg: FeeCfg, source: 'cash_card' | 'petty_cash'): string {
  return String((source === 'cash_card' ? cfg?.cashCardBank : cfg?.pettyBank) || '').trim()
}

/** Saran biaya: apply=true bila bank tujuan beda dari bank sumber (dan auto aktif). */
export function suggestFee(destBank: unknown, source: 'cash_card' | 'petty_cash', cfg: FeeCfg): { apply: boolean; amount: number; reason: string } {
  const amount = Number(cfg?.amount ?? 6500) || 0
  const src = sourceBankOf(cfg, source), dst = String(destBank || '').trim()
  if (cfg?.auto === false || !src || !dst) return { apply: false, amount, reason: '' }
  const differ = normBank(src) !== normBank(dst)
  return { apply: differ && amount > 0, amount, reason: differ ? `Otomatis: ${dst} ≠ ${src}` : `Sesama ${src}, tanpa biaya` }
}
