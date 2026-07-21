import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { SouvenirModel } from '@/models/Souvenir'

export async function GET() {
  try {
    await connectDB()
    const items = await SouvenirModel.find({}).sort({ createdAt:-1 }).lean()
    return NextResponse.json({ data: items })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}

export async function POST(req:NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    if (!body?.nama?.trim()) return NextResponse.json({ error:'Nama wajib' }, { status:400 })
    const item = await SouvenirModel.create(body)
    return NextResponse.json({ data:item }, { status:201 })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
