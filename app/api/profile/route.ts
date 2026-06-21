import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'

export async function GET() {
  try {
    await connectDB()
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error:'Unauthorized' }, { status:401 })
    const user = await UserModel.findOne({ email: session.user.email }).select('-password').lean()
    return NextResponse.json({ data: user })
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { userId, ...update } = body
    // Never allow role/email/password update via profile
    delete update.role; delete update.password; delete update.email

    // Resolve target: prefer session email; fallback to userId for backward compat
    let user
    if (session?.user?.email) {
      user = await UserModel.findOneAndUpdate({ email: session.user.email }, update, { new: true }).select('-password').lean()
    } else if (userId) {
      user = await UserModel.findByIdAndUpdate(userId, update, { new: true }).select('-password').lean()
    } else return NextResponse.json({ error:'Unauthorized' }, { status:401 })

    return NextResponse.json({ data: user })
  } catch (e:any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
