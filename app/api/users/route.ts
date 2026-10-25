import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import bcrypt from 'bcryptjs'
import { currentRoles } from '@/lib/session'
import { sanitizeUser } from '@/lib/access'

export async function GET() {
  try {
    await connectDB()
    const roles = (await currentRoles()) || []
    const users = await UserModel.find({}, { password: 0, fonnteToken: 0 }).sort({ sortOrder: 1, createdAt: 1 }).lean()
    return NextResponse.json({ data: (users as any[]).map(u => sanitizeUser(u, roles)) })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    // Normalize email to lowercase to avoid case-mismatch on login
    if (body.email) body.email = String(body.email).toLowerCase().trim()
    const hashed = await bcrypt.hash(body.password, 10)
    const user = await UserModel.create({ ...body, password: hashed })
    const { password: _, fonnteToken: _t, ...safe } = user.toObject()
    return NextResponse.json({ data: safe }, { status: 201 })
  } catch (e:any) {
    console.error('[USERS POST]', e?.message)
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
