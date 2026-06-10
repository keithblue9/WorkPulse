import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { userId, ...update } = body
    // Never allow role/email update via profile
    delete update.role; delete update.password; delete update.email
    const user = await UserModel.findByIdAndUpdate(userId, update, { new: true }).select('-password').lean()
    return NextResponse.json({ data: user })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
