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

    // Pengeluaran Petty Cash (slide 5), kumulatif s/d bulan:
    //  a) nominal reimburse NON cash card yang sudah dibayar (done/verified)
    //  b) biaya antar bank dari SEMUA reimburse (cash card maupun petty) — bank fee selalu dari petty
    //  c) selisih Cash Card |Pengembalian − (TopUp − Settlement)|
    // Hanya ambil field yang dipakai perhitungan. Sebelumnya seluruh dokumen ikut
    // terambil termasuk evidence base64 (documents.url/receiptUrl) -> puluhan MB,
    // padahal tidak dipakai sama sekali di sini.
    const reimburses = await ReimbursementModel.find(
      { status: { $in: ['done', 'verified'] } },
      'amount biayaAntarBank isCashCard userName title category billDate submittedAt createdAt'
    ).lean() as any[]
    const inThisPeriod = (r:any) => { const d = periodOf(r); return !!d && d.getFullYear()===year && (d.getMonth()+1) <= month }

    const nonCCAmount = reimburses.reduce((s,r)=> (!r.isCashCard && inThisPeriod(r)) ? s + (r.amount||0) : s, 0)
    const bankFees   = reimburses.reduce((s,r)=> inThisPeriod(r) ? s + (r.biayaAntarBank||0) : s, 0)

    // detail rincian (buat popup di UI)
    const nonCCItems = reimburses.filter(r=>!r.isCashCard && inThisPeriod(r))
      .map(r=>({ date: periodOf(r), userName:r.userName||'-', title:r.title||'-', category:r.category||'', amount:r.amount||0 }))
      .sort((a,b)=> (new Date(b.date||0).getTime()) - (new Date(a.date||0).getTime()))
    const bankFeeItems = reimburses.filter(r=>inThisPeriod(r) && (r.biayaAntarBank||0)>0)
      .map(r=>({ date: periodOf(r), userName:r.userName||'-', title:r.title||'-', isCashCard:!!r.isCashCard, fee:r.biayaAntarBank||0 }))
      .sort((a,b)=> (new Date(b.date||0).getTime()) - (new Date(a.date||0).getTime()))

    // c) Selisih Biaya Settlement Cash Card = TOTAL Pengeluaran Operasional di menu Cash Card.
    //    Per row: kalau settlement & pengembalian dua-duanya 0 -> 0 (belum direkonsiliasi, tidak dihitung),
    //    selain itu |Pengembalian − (TopUp − Settlement)|. Identik dengan kolom di menu Cash Card.
    const ccRows = await CashCardModel.find({ year, month:{ $lte:month } }).lean() as any[]
    const ccItems = ccRows
      .filter(c=>{ const s=c.settlementAmount||0, rf=c.refundAmount||0; return !(s===0 && rf===0) })
      .map(c=>{ const settlement=c.settlementAmount||0, refund=c.refundAmount||0, topUp=c.topUpAmount||0
        return { month:c.month, topUp, settlement, refund, operasional: Math.abs(refund - (topUp - settlement)) } })
      .sort((a,b)=>a.month-b.month)
    const ccOperasional = ccItems.reduce((s,c)=> s + c.operasional, 0)

    const pengeluaran = nonCCAmount + bankFees + ccOperasional
    const saldo = pemasukan - pengeluaran

    return NextResponse.json({ data: {
      year, month, inflows,
      summary: { pemasukan, nonCCAmount, bankFees, ccOperasional, pengeluaran, saldo },
      detail: { nonCCItems, bankFeeItems, ccItems },
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
