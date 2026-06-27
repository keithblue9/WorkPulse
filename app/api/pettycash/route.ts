import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { PettyCashModel } from '@/models/PettyCash'
import { ReimbursementModel } from '@/models/Reimbursement'
import { CashCardModel } from '@/models/CashCard'

function periodOf(r:any):Date|null {
  const raw = r.billDate || r.submittedAt || r.createdAt
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

// GET /api/pettycash?year=2026&month=5  (month 1-12, cumulative s/d bulan itu)
export async function GET(req:NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year')) || new Date().getFullYear()
    const month = Number(searchParams.get('month')) || 12   // cumulative s/d bulan ini

    let pc = await PettyCashModel.findOne({ year }).lean() as any
    if (!pc) { const c = await PettyCashModel.create({ year, inflows:[] }); pc = c.toObject() }

    // Pemasukan kumulatif s/d bulan dipilih (berdasarkan tanggal inflow, dalam tahun ini)
    const inflows = (pc.inflows||[]) as any[]
    const pemasukan = inflows.reduce((s,f)=>{
      const d = f.date ? new Date(f.date) : null
      const m = d && !isNaN(d.getTime()) ? d.getMonth()+1 : 12
      const y = d && !isNaN(d.getTime()) ? d.getFullYear() : year
      return (y===year && m<=month) ? s + (f.amount||0) : s
    }, 0)

    // Pengeluaran 1: reimburse NON cash card yang sudah dibayar (done/verified), kumulatif s/d bulan
    const reimburses = await ReimbursementModel.find({ status:{ $in:['done','verified'] }, isCashCard:{ $ne:true } }).lean() as any[]
    const pettyReimburse = reimburses.reduce((s,r)=>{
      const d = periodOf(r); if (!d) return s
      if (d.getFullYear()!==year || (d.getMonth()+1) > month) return s
      return s + (r.totalTransfer || ((r.amount||0) + (r.biayaAntarBank||0)))
    }, 0)

    // Pengeluaran 2: selisih Cash Card |Pengembalian − (TopUp − Settlement)|, kumulatif s/d bulan
    const ccRows = await CashCardModel.find({ year, month:{ $lte:month } }).lean() as any[]
    const ccSelisih = ccRows.reduce((s,c)=> s + Math.abs((c.refundAmount||0) - ((c.topUpAmount||0) - (c.settlementAmount||0))), 0)

    const pengeluaran = pettyReimburse + ccSelisih
    const saldo = pemasukan - pengeluaran

    return NextResponse.json({ data: {
      year, month, inflows,
      summary: { pemasukan, pettyReimburse, ccSelisih, pengeluaran, saldo },
    } })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}

// PATCH /api/pettycash  { year, inflows:[...] }  — replace inflows list
export async function PATCH(req:NextRequest) {
  try {
    await connectDB()
    const { year, inflows } = await req.json()
    const item = await PettyCashModel.findOneAndUpdate({ year }, { inflows: inflows||[] }, { new:true, upsert:true })
    return NextResponse.json({ data:item })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
