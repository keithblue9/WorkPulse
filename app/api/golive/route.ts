import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { GoLiveAppModel, GoLiveEntityModel } from '@/models/GoLive'

const DEFAULT_APPS = [
  { key: 'ivendor', label: 'iVendor (VR)', order: 1, subFeatures: [
    { key:'dpt', label:'DPT', order:1 }, { key:'csms', label:'CSMS', order:2 }, { key:'akun', label:'Akun', order:3 }
  ]},
  { key: 'ipro', label: 'iPRO', order: 2, subFeatures: [
    { key:'poro', label:'PO/RO', order:1 }, { key:'oa', label:'OA', order:2 },
    { key:'pr', label:'PR', order:3 }, { key:'gr', label:'GR', order:4 }, { key:'sa', label:'SA', order:5 }
  ]},
  { key: 'myssc', label: 'MySSC', order: 3, subFeatures: [
    { key:'dpt', label:'DPT', order:1 }
  ]},
]

export async function GET() {
  try {
    await connectDB()
    // Read-only: default apps / sub-features are filled in memory, never written here.
    let apps = await GoLiveAppModel.find().sort({ order: 1 }).lean() as any[]
    if (!apps.length) apps = DEFAULT_APPS.map(a => ({ ...a, _id: 'default-' + a.key, isDefault: true }))
    apps = apps.map((app: any) => {
      const def = DEFAULT_APPS.find(d => d.key === app.key)
      return def && (!app.subFeatures || !app.subFeatures.length) ? { ...app, subFeatures: def.subFeatures } : app
    })
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
    const doc = await GoLiveEntityModel.create({ name: body.name || 'Entitas Baru', cocd: body.cocd || '', group: body.group || '', client: body.client || '', order: count + 1, apps: {} })
    return NextResponse.json({ data: doc }, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}

// PATCH { kind:'entity'|'app', id, patch }
export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const { kind, id, patch } = await req.json()
    if (!id || !patch) return NextResponse.json({ error: 'id & patch wajib' }, { status: 400 })
    if (kind === 'app' && String(id).startsWith('default-')) {
      // First edit of a default app that only existed in memory: save it now (explicit user action).
      const def = DEFAULT_APPS.find(d => 'default-' + d.key === id)
      if (!def) return NextResponse.json({ error: 'app tidak ditemukan' }, { status: 404 })
      const onInsert = Object.fromEntries(Object.entries(def).filter(([k]) => !(k in patch)))
      const doc = await GoLiveAppModel.findOneAndUpdate({ key: def.key }, { $setOnInsert: onInsert, $set: patch }, { new: true, upsert: true }).lean()
      return NextResponse.json({ data: doc })
    }
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
