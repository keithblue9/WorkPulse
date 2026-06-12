import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'

// Force reset all user PINs to 123456 - bypass any caching/schema issues
export async function GET() {
  try {
    await connectDB()
    const hashed = await bcrypt.hash('123456', 10)

    // Direct update via $set to be explicit
    const result = await UserModel.updateMany(
      {},
      { $set: { password: hashed } }
    )

    // Verify by listing all users
    const users = await UserModel.find({}).select('name email role active').lean()

    // Test bcrypt round-trip
    const testUser = await UserModel.findOne({}).lean() as any
    const testCompare = testUser ? await bcrypt.compare('123456', testUser.password) : false

    return NextResponse.json({
      success: true,
      message: `Reset PIN for ${result.modifiedCount} users to 123456`,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      users: users.map((u:any) => ({ name: u.name, email: u.email, role: u.role, active: u.active })),
      bcryptTest: testCompare ? '✓ PIN 123456 verified against DB' : '✗ bcrypt mismatch — bug!',
    })
  } catch (e:any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}

export async function POST() { return GET() }
