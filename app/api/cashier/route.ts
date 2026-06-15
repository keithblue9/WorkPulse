import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { CashierModel } from '@/models/Cashier'
import { CashCardModel } from '@/models/CashCard'
import { ReimbursementModel } from '@/models/Reimbursement'

export async function GET(req:NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year')) || new Date().getFullYear()
    let cashier = await CashierModel.findOne({ year }).lean() as any
    if (!cashier) {
      const created = await CashierModel.create({ year, saldoAwal:0, manualTopUps:[] })
      cashier = created.toObject()
    }
    const cashCardRows = await CashCardModel.find({ year }).lean()
    const cashCardKasMasuk = cashCardRows.reduce((s,r:any)=>s+(r.topUpAmount||0),0)       // top up = uang masuk ke kas tim
    const cashCardKeluar = cashCardRows.reduce((s,r:any)=>s+(r.settlementAmount||0),0)     // settlement = dipertanggungjawabkan (keluar)
    const cashCardPengembalian = cashCardRows.reduce((s,r:any)=>s+(r.refundAmount||0),0)   // pengembalian = dikembalikan ke kantor (keluar dari kas tim)
    const reimbursDone = await ReimbursementModel.find({ status:{ $in:['done','reversal_requested'] } }).lean() as any[]
    const operasionalKeluar = reimbursDone.filter((r:any)=>!r.isCashCard).reduce((s,r:any)=>s+(r.totalTransfer||r.amount||0),0) // petty cash payouts via reimburse
    const manualTopUpTotal = (cashier.manualTopUps||[]).reduce((s:number,t:any)=>s+(t.amount||0),0)
    // Saldo Kas = uang yang masih di tangan tim:
    //   saldo awal + masuk (topup + manual) - settlement - pengembalian (balik ke kantor) - operasional petty cash
    const saldoKas = (cashier.saldoAwal||0) + manualTopUpTotal + cashCardKasMasuk - cashCardKeluar - cashCardPengembalian - operasionalKeluar
    return NextResponse.json({ data: { ...cashier, summary: { saldoAwal:cashier.saldoAwal||0, kasMasuk: cashCardKasMasuk + manualTopUpTotal, kasKeluarCashCard: cashCardKeluar, cashCardPengembalian, kasKeluarOperasional: operasionalKeluar, saldoKas, manualTopUpTotal } } })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
export async function PATCH(req:NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { year, ...rest } = body
    const item = await CashierModel.findOneAndUpdate({ year }, rest, { new:true, upsert:true })
    return NextResponse.json({ data:item })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
