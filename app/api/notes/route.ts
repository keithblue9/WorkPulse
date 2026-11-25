import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { NotesModel } from '@/models/Notes'
import { notesListPipeline, withImageRefs } from '@/lib/notesImages'

// GET /api/notes            → semua catatan (halaman [Team] Notes)
// GET /api/notes?pinned=1   → hanya yang disematkan, maks 5 (widget Notes di dashboard)
// Gambar TIDAK ikut sebagai base64: tiap gambar diganti alamat /api/notes/<id>/image/<n> (dimuat lazy & di-cache browser).
export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const pinned = new URL(req.url).searchParams.get('pinned') === '1'
    const rows = await NotesModel.aggregate(notesListPipeline(pinned))
    return NextResponse.json({ data: rows.map(withImageRefs) }, { headers: { 'Cache-Control': 'private, no-cache' } })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
export async function POST(req: NextRequest) {
  try { await connectDB(); const body = await req.json(); const item = await NotesModel.create(body); return NextResponse.json({ data: item }, { status:201 }) }
  catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
