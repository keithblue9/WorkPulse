import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'

// Read default values from model schema
function getSchemaDefaults() {
  const paths = (ConfigModel.schema as any).paths
  const defaults: any = {}
  for (const key in paths) {
    const path = paths[key]
    if (path.defaultValue !== undefined) {
      defaults[key] = typeof path.defaultValue === 'function' ? path.defaultValue() : path.defaultValue
    }
  }
  return defaults
}

export async function GET() {
  try {
    await connectDB()
    let cfg = await ConfigModel.findOne({}).lean() as any
    if (!cfg) {
      const created = await ConfigModel.create({})
      cfg = created.toObject()
    }

    // Backfill missing array fields from schema defaults (for existing docs that don't have new fields)
    const defaults = getSchemaDefaults()
    let needsUpdate = false
    const updates: any = {}
    const arrayFields = ['attendanceTypes','budgetCategories','activityCategories','activitySubTypes','progressSubTabs','issueStatuses','meetingCategories','loginBackgrounds']
    for (const k of arrayFields) {
      if (!cfg[k] || cfg[k].length === 0) {
        cfg[k] = defaults[k] || []
        if (defaults[k]?.length) { updates[k] = defaults[k]; needsUpdate = true }
      }
    }
    if (needsUpdate) {
      await ConfigModel.updateOne({ _id: cfg._id }, { $set: updates })
    }

    return NextResponse.json({ data: cfg })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const cfg = await ConfigModel.findOneAndUpdate({}, body, { new:true, upsert:true })
    return NextResponse.json({ data: cfg })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
