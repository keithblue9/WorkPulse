import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
export async function GET() {
  try {
    await connectDB()
    const today = new Date()
    const m = today.getMonth() + 1
    const d = today.getDate()
    const users = await UserModel.find({ active:true, birthDate: { $exists:true, $ne:'' } }).select('name email birthDate jabatan division avatar').lean() as any[]
    const todayBirthdays = users.filter((u:any) => {
      if (!u.birthDate) return false
      const dt = new Date(u.birthDate)
      if (isNaN(dt.getTime())) return false
      return (dt.getMonth()+1) === m && dt.getDate() === d
    }).map((u:any) => ({ _id:u._id, name:u.name, email:u.email, jabatan:u.jabatan, division:u.division, avatar:u.avatar, age: today.getFullYear() - new Date(u.birthDate).getFullYear() }))
    return NextResponse.json({ data: todayBirthdays, count: todayBirthdays.length })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
