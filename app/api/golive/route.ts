import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { GoLiveAppModel, GoLiveEntityModel } from '@/models/GoLive'

const DEFAULT_APPS = [
  { key: 'ivendor', label: 'iVendor', order: 1 },
  { key: 'ipro', label: 'iPRO', order: 2 },
  { key: 'myssc', label: 'MySSC', order: 3 },
]

export async function GET() {
  try {
    await connectDB()
    let apps = await GoLiveAppModel.find().sort({ order: 1 }).lean()
    if (!apps.length) { await GoLiveAppModel.insertMany(DEFAULT_APPS); apps = await GoLiveAppModel.find().sort({ order: 1 }).lean() }
    const entities = await GoLiveEntityModel.find().sort({ order: 1, createdAt: 1 }).lean()
    return NextResponse.json({ apps, entities })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// POST { kind:'app', label } | { kind:'entity', name, cocd, group }
export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    if (body.kind === 'app') {
      const label = String(body.label || '').trim()
      if (!label) return NextResponse.json({ error: 'label wajib' }, { status: 400 })
      const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `app-${Date.now()}`
      const count = await GoLiveAppModel.countDocuments()
      const doc = await GoLiveAppModel.create({ key, label, order: count + 1 })
      return NextResponse.json({ data: doc }, { status: 201 })
    }
    // entity
    const count = await GoLiveEntityModel.countDocuments()
    const doc = await GoLiveEntityModel.create({ name: body.name || 'Entitas Baru', cocd: body.cocd || '', group: body.group || '', order: count + 1, apps: {} })
    return NextResponse.json({ data: doc }, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// PATCH { kind:'entity'|'app', id, patch }
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const { kind, id, patch } = await req.json()
    if (!id || !patch) return NextResponse.json({ error: 'id & patch wajib' }, { status: 400 })
    const Model: any = kind === 'app' ? GoLiveAppModel : GoLiveEntityModel
    const doc = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean()
    return NextResponse.json({ data: doc })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// DELETE ?kind=app|entity&id=...
export async function DELETE(req: NextRequest) {
  try {
    await connectDB()
    const { searchParams } = new URL(req.url)
    const kind = searchParams.get('kind'); const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id wajib' }, { status: 400 })
    if (kind === 'app') {
      const app: any = await GoLiveAppModel.findByIdAndDelete(id).lean()
      if (app?.key) await GoLiveEntityModel.updateMany({}, { $unset: { [`apps.${app.key}`]: '' } })
    } else {
      await GoLiveEntityModel.findByIdAndDelete(id)
    }
    return NextResponse.json({ success: true })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
