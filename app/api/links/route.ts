import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { LinkHubModel } from '@/models/LinkHub'

export async function GET() {
  try {
    await connectDB()
    const links = await LinkHubModel.find({}).sort({ pinned: -1, createdAt: -1 }).lean()
    return NextResponse.json({ data: links })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const link = await LinkHubModel.create(body)
    return NextResponse.json({ data: link }, { status: 201 })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
