import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'

async function getOrCreate() {
  let config = await ConfigModel.findOne().lean()
  if (!config) config = await ConfigModel.create({})
  return config
}

export async function GET() {
  try {
    await connectDB()
    const config = await getOrCreate()
    return NextResponse.json({ data: config })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const config = await ConfigModel.findOneAndUpdate({}, { $set: body }, { new: true, upsert: true }).lean()
    return NextResponse.json({ data: config })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
