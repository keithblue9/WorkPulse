import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { IssueModel } from '@/models/Issue'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const issue = await IssueModel.findById(params.id).lean()
    if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: issue })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const body = await req.json()

    // If updating progress, append to history
    if (body.progress !== undefined) {
      const issue = await IssueModel.findById(params.id)
      if (issue) {
        issue.progressHistory.push({
          date: new Date().toISOString().split('T')[0],
          progress: body.progress,
          note: body.progressNote || '',
          updatedBy: body.updatedBy || 'System',
        })
        issue.progress = body.progress
        if (body.status) issue.status = body.status
        if (body.nextPlan) issue.nextPlan = body.nextPlan
        if (body.dueDate) issue.dueDate = body.dueDate
        await issue.save()
        return NextResponse.json({ data: issue })
      }
    }

    const updated = await IssueModel.findByIdAndUpdate(params.id, body, { new: true }).lean()
    return NextResponse.json({ data: updated })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    await IssueModel.findByIdAndDelete(params.id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
