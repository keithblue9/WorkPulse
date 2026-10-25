import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import bcrypt from 'bcryptjs'
import { currentRoles } from '@/lib/session'
import { forbiddenUserFields } from '@/lib/access'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    const body = await req.json()
    const blocked = forbiddenUserFields(body, (await currentRoles()) || [])
    if (blocked.length) return NextResponse.json({ error: 'Hanya admin yang boleh mengubah: ' + blocked.join(', ') }, { status: 403 })
    if (body.email) body.email = String(body.email).toLowerCase().trim()
    if (body.password) body.password = await bcrypt.hash(body.password, 10)
    const user = await UserModel.findByIdAndUpdate(id, body, { new: true }).select('-password -fonnteToken').lean()
    return NextResponse.json({ data: user })
  } catch (e:any) {
    console.error('[USERS PATCH]', e?.message)
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; await connectDB()
    await UserModel.findByIdAndDelete(id)
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}
