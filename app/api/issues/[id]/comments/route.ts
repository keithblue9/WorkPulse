import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { IssueModel } from '@/models/Issue'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { text, authorId, authorName } = await req.json()
    const issue = await IssueModel.findById(params.id)
    if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    issue.comments.push({ text, authorId, authorName } as any)
    await issue.save()
    return NextResponse.json({ data: issue.comments[issue.comments.length - 1] })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
