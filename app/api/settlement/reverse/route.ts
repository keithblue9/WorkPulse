import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ReimbursementModel } from '@/models/Reimbursement'
import { CashCardModel } from '@/models/CashCard'

function periodOf(r:any):Date|null {
  const raw = r.billDate || r.submittedAt || r.createdAt
  if (!raw) return null
  const d = new Date(raw); return isNaN(d.getTime()) ? null : d
}

// POST /api/settlement/reverse  { id }
// Mundurkan 1 reimburse dari Verified -> Done, lalu hitung ulang Settlement Cash Card bulan itu.
export async function POST(req:NextRequest) {
  try {
    await connectDB()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error:'id wajib' }, { status:400 })

    const item = await ReimbursementModel.findById(id).lean() as any
    if (!item) return NextResponse.json({ error:'Reimburse tidak ditemukan' }, { status:404 })

    const d = periodOf(item)
    const month = item.settlementMonth || (d ? d.getMonth()+1 : null)
    const year  = item.settlementYear  || (d ? d.getFullYear() : null)

    await ReimbursementModel.findByIdAndUpdate(id, {
      $set:{ status:'done' },
      $unset:{ verifiedAt:'', verifiedBy:'', settlementMonth:'', settlementYear:'' },
    })

    // Hitung ulang Settlement Cash Card bulan itu (tanpa item yg barusan di-reverse)
    if (month && year) {
      // Hanya field yang dipakai — hindari menarik evidence base64
      const verifiedCC = await ReimbursementModel.find({ status:'verified', isCashCard:true }, 'amount billDate submittedAt createdAt').lean() as any[]
      const settlementTotal = verifiedCC.reduce((s,r)=>{
        const dd = periodOf(r); if (!dd) return s
        return (dd.getFullYear()===year && (dd.getMonth()+1)===month) ? s + (r.amount||0) : s
      }, 0)
      const ccRow = await CashCardModel.findOne({ year, month }).lean() as any
      if (ccRow && !ccRow.locked) await CashCardModel.findByIdAndUpdate(ccRow._id, { settlementAmount: settlementTotal })
    }

    return NextResponse.json({ data:{ reversed:id } })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
