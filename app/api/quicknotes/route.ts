import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { QuickNoteModel } from '@/models/QuickNote'

// A note is visible/editable by its owner OR anyone in sharedWith (collaborative).
function canAccess(note: any, email: string) {
  return note.ownerEmail === email || (note.sharedWith || []).includes(email)
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const email = session.user.email
    const items = await QuickNoteModel.find({
      archived: { $ne: true },
      $or: [{ ownerEmail: email }, { sharedWith: email }],
    }).sort({ updatedAt: -1 }).lean()
    return NextResponse.json({ data: items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const body = await req.json()
    const note = await QuickNoteModel.create({
      ownerEmail: session.user.email,
      title: body.title || 'Catatan',
      items: body.items || [],
      reminder: body.reminder || { enabled: false },
      sharedWith: [],
      lastEditedBy: session.user.email,
    })
    return NextResponse.json({ data: note }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })
    const note = await QuickNoteModel.findById(id)
    if (!note) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (!canAccess(note, session.user.email)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    // Only the owner can manage sharing (add/remove collaborators); collaborators can edit content.
    const allowedFields = ['title', 'items', 'reminder', 'archived']
    for (const f of allowedFields) if (f in updates) (note as any)[f] = updates[f]
    if ('sharedWith' in updates) {
      if (note.ownerEmail !== session.user.email) return NextResponse.json({ error: 'hanya pemilik yang bisa mengubah daftar share' }, { status: 403 })
      note.sharedWith = updates.sharedWith
    }
    note.lastEditedBy = session.user.email
    await note.save()
    return NextResponse.json({ data: note })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const { id } = await req.json()
    const note = await QuickNoteModel.findById(id)
    if (!note) return NextResponse.json({ error: 'not found' }, { status: 404 })
    // Only the owner can delete (collaborators can edit/check items but not remove the note itself)
    if (note.ownerEmail !== session.user.email) return NextResponse.json({ error: 'hanya pemilik yang bisa menghapus' }, { status: 403 })
    await QuickNoteModel.deleteOne({ _id: id })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
