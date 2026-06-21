import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { connectDB } from '@/lib/db'
import { PushSubscriptionModel } from '@/models/PushSubscription'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const { subscription } = await req.json()
    if (!subscription?.endpoint || !subscription?.keys) return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
    await PushSubscriptionModel.updateOne(
      { endpoint: subscription.endpoint },
      { $set: { userEmail: session.user.email, endpoint: subscription.endpoint, keys: subscription.keys } },
      { upsert: true }
    )
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    await connectDB()
    const { endpoint } = await req.json()
    if (endpoint) await PushSubscriptionModel.deleteOne({ endpoint, userEmail: session.user.email })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
