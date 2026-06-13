import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
// Quick endpoint to warm the serverless function + DB connection
// Called from dashboard layout on mount — subsequent API calls feel faster
export async function GET() {
  try {
    const conn = await connectDB()
    return NextResponse.json({ ok:true, ready: conn.readyState === 1 }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ ok:false }, { status:500 }) }
}
