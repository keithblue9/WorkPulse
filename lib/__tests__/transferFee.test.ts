import { describe, expect, it } from 'vitest'
import { normBank, suggestFee } from '../transferFee'

describe('transferFee', () => {
  it('normalisasi nama bank', () => {
    expect(normBank('Bank Mandiri (Persero) Tbk')).toBe('mandiri')
    expect(normBank('PT Bank Rakyat Indonesia')).toBe('bri')
    expect(normBank(' BCA ')).toBe('bca')
  })
  const cfg = { pettyBank: 'Mandiri', cashCardBank: 'BNI', amount: 6500, auto: true }
  it('beda bank → biaya default sesuai sumber dana', () => {
    expect(suggestFee('BCA', 'petty_cash', cfg)).toMatchObject({ apply: true, amount: 6500 })
    expect(suggestFee('Bank Mandiri', 'petty_cash', cfg).apply).toBe(false)
    expect(suggestFee('Mandiri', 'cash_card', cfg).apply).toBe(true)
    expect(suggestFee('BNI', 'cash_card', cfg).apply).toBe(false)
  })
  it('auto mati / data kosong → tidak disarankan', () => {
    expect(suggestFee('BCA', 'petty_cash', { ...cfg, auto: false }).apply).toBe(false)
    expect(suggestFee('', 'petty_cash', cfg).apply).toBe(false)
    expect(suggestFee('BCA', 'petty_cash', null)).toMatchObject({ apply: false })
  })
})
