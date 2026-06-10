import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { IssueModel } from '@/models/Issue'

export async function GET(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const initiativeId = searchParams.get('initiativeId')
    const status = searchParams.get('status')
    const pic = searchParams.get('pic')
    const query: any = {}
    if (initiativeId) query.initiativeId = initiativeId
    if (status) query.status = status
    if (pic) query.picName = { $regex: pic, $options: 'i' }
    const issues = await IssueModel.find(query).sort({ dueDate: 1 }).lean()
    return NextResponse.json({ data: issues })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const issue = await IssueModel.create(body)
    return NextResponse.json({ data: issue }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
