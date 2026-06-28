export type Cur = 'IDR' | 'USD'

// Format angka jadi string mata uang + separator ribuan. USD pakai 2 desimal (cent).
export function fmtMoney(n:number, currency:Cur='IDR'):string {
  const v = (n==null || isNaN(n)) ? 0 : n
  if (currency==='USD') return '$ ' + v.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(v))
}

// Parse string (apapun formatnya) balik ke number.
export function parseMoney(s:string, currency:Cur='IDR'):number {
  if (!s) return 0
  let c = String(s).replace(/[^0-9.,-]/g,'')
  if (currency==='USD') { c = c.replace(/,/g,''); const v = parseFloat(c); return isNaN(v)?0:v }
  c = c.replace(/[.,]/g,''); const v = parseInt(c,10); return isNaN(v)?0:v
}
