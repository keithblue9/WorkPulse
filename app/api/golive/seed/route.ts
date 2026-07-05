import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { GoLiveAppModel, GoLiveEntityModel } from '@/models/GoLive'
import seedData from './data.json'

// POST /api/golive/seed -> seed apps + entities from data.json (idempotent: clears first)
export async function POST() {
  try {
    await connectDB()
    await GoLiveAppModel.deleteMany({})
    await GoLiveEntityModel.deleteMany({})
    await GoLiveAppModel.insertMany(seedData.apps)
    await GoLiveEntityModel.insertMany(seedData.entities)
    return NextResponse.json({ success: true, apps: seedData.apps.length, entities: seedData.entities.length })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
