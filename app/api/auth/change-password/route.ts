import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import { getServerSession } from 'next-auth'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const session = await getServerSession()
    if (!session?.user?.email) return NextResponse.json({ error:'Tidak terautentikasi' }, { status:401 })

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) return NextResponse.json({ error:'Password lama dan baru wajib diisi' }, { status:400 })
    if (newPassword.length < 6) return NextResponse.json({ error:'Password baru minimal 6 karakter' }, { status:400 })

    const user = await UserModel.findOne({ email: session.user.email })
    if (!user) return NextResponse.json({ error:'User tidak ditemukan' }, { status:404 })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return NextResponse.json({ error:'Password lama salah' }, { status:400 })

    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()
    return NextResponse.json({ success:true, message:'Password berhasil diubah' })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
