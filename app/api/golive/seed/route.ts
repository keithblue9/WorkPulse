import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { GoLiveAppModel, GoLiveEntityModel } from '@/models/GoLive'
import mongoose from 'mongoose'
import seedData from './data.json'

// POST /api/golive/seed -> wipe & reseed from Excel data (idempotent)
export async function POST() {
  try {
    await connectDB()
    const db = mongoose.connection.db
    if (!db) return NextResponse.json({ error: 'no db' }, { status: 500 })
    // Drop collections entirely to avoid index conflicts
    try { await db.dropCollection('goliveapps') } catch {}
    try { await db.dropCollection('goliveentities') } catch {}
    // Recreate with fresh data
    await GoLiveAppModel.createCollection()
    await GoLiveEntityModel.createCollection()
    await GoLiveAppModel.insertMany(seedData.apps)
    await GoLiveEntityModel.insertMany(seedData.entities)
    return NextResponse.json({ success: true, apps: seedData.apps.length, entities: seedData.entities.length })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
