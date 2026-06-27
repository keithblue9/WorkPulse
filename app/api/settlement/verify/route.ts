import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ReimbursementModel } from '@/models/Reimbursement'
import { CashCardModel } from '@/models/CashCard'

function periodOf(r:any):Date|null {
  const raw = r.billDate || r.submittedAt || r.createdAt
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

// POST /api/settlement/verify  { ids:[reimburseId...], month:1-12, year, verifiedBy }
// 1) tandai reimburse2 itu jadi 'verified'
// 2) auto-calc Settlement Cash Card bulan itu = total reimburse Cash Card yg VERIFIED (billDate bulan/tahun itu)
export async function POST(req:NextRequest) {
  try {
    await connectDB()
    const { ids, month, year, verifiedBy } = await req.json()
    if (!Array.isArray(ids) || ids.length===0) return NextResponse.json({ error:'Tidak ada item dipilih' }, { status:400 })
    if (!month || !year) return NextResponse.json({ error:'month & year wajib' }, { status:400 })

    const nowIso = new Date().toISOString()
    await ReimbursementModel.updateMany(
      { _id:{ $in: ids } },
      { $set:{ status:'verified', verifiedAt:nowIso, verifiedBy: verifiedBy||'-', settlementMonth: month, settlementYear: year } }
    )

    // Recompute Cash Card settlement bulan ini (slide 6): jumlah reimburse Cash Card yg sudah verified pada bulan ini
    const verifiedCC = await ReimbursementModel.find({ status:'verified', isCashCard:true }).lean() as any[]
    const settlementTotal = verifiedCC.reduce((s,r)=>{
      const d = periodOf(r); if (!d) return s
      return (d.getFullYear()===year && (d.getMonth()+1)===month) ? s + (r.amount||0) : s
    }, 0)

    // Update/insert baris Cash Card bulan ini — TAPI kalau baris itu di-lock, jangan ubah settlement-nya
    const ccRow = await CashCardModel.findOne({ year, month }).lean() as any
    if (ccRow) {
      if (!ccRow.locked) await CashCardModel.findByIdAndUpdate(ccRow._id, { settlementAmount: settlementTotal })
    } else {
      await CashCardModel.create({ year, month, settlementAmount: settlementTotal, topUpAmount:0, refundAmount:0, notes:'(auto dari Settlement)', createdBy: verifiedBy||'-' })
    }

    return NextResponse.json({ data: { verified: ids.length, settlementTotal } })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
