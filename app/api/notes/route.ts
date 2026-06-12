import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { NotesModel } from '@/models/Notes'
export async function GET() {
  try { await connectDB(); const items = await NotesModel.find({}).sort({ date:-1, createdAt:-1 }).lean(); return NextResponse.json({ data: items }) }
  catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
export async function POST(req: NextRequest) {
  try { await connectDB(); const body = await req.json(); const item = await NotesModel.create(body); return NextResponse.json({ data: item }, { status:201 }) }
  catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
