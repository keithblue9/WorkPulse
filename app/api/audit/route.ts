import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { AuditLogModel } from '@/models/AuditLog'

// GET /api/audit?entity=activity|reimbursement&id=<id> → riwayat perubahan terbaru (maks 50).
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams
  const entity = sp.get('entity'), id = sp.get('id')
  if (!entity || !['activity', 'reimbursement'].includes(entity) || !id) return NextResponse.json({ error: 'entity & id wajib' }, { status: 400 })
  try {
    await connectDB()
    const data = await AuditLogModel.find({ entity, entityId: id }, '-__v').sort({ createdAt: -1 }).limit(50).lean()
    return NextResponse.json({ data })
  } catch { return NextResponse.json({ error: 'Gagal memuat riwayat' }, { status: 500 }) }
}
