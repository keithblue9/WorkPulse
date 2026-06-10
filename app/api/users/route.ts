import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    await connectDB()
    const users = await UserModel.find({}, { password: 0 }).lean()
    return NextResponse.json({ data: users })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const hashed = await bcrypt.hash(body.password, 10)
    const user = await UserModel.create({ ...body, password: hashed })
    const { password: _, ...safe } = user.toObject()
    return NextResponse.json({ data: safe }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
