import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear()
    const initiatives = await InitiativeModel.find({ year }).sort({ code: 1 }).lean()
    return NextResponse.json({ data: initiatives })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch initiatives' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const initiative = await InitiativeModel.create(body)
    return NextResponse.json({ data: initiative }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create initiative' }, { status: 500 })
  }
}
