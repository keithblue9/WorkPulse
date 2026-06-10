import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ProjectModel } from '@/models/Project'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const pic = searchParams.get('pic')
    const status = searchParams.get('status')
    const query: any = {}
    if (pic) query.$or = [{ pic }, { members: pic }]
    if (status) query.status = status
    const projects = await ProjectModel.find(query).sort({ priority: 1, createdAt: -1 }).lean()
    return NextResponse.json({ data: projects })
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const project = await ProjectModel.create(body)
    return NextResponse.json({ data: project }, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
