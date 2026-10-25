import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'
import { currentRoles } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    // year=all → semua tahun (halaman Progress memfilter lintas tahun sendiri); default tetap tahun berjalan.
    const yp = searchParams.get('year')
    const filter: Record<string, unknown> = yp === 'all' ? {} : { year: yp || new Date().getFullYear() }
    const roles = await currentRoles()
    if (!roles || roles.every(r => r === 'guest')) filter.hiddenGuest = { $ne: true }
    const initiatives = await InitiativeModel.find(filter).sort({ app: 1, title: 1 }).lean()
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
