import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email') || 'adi.k@workpulse.com'
    const pin = searchParams.get('pin') || '123456'

    await connectDB()

    // Step 1: find user
    const user = await UserModel.findOne({ email }).lean() as any

    if (!user) {
      // List all emails in DB for debugging
      const allUsers = await UserModel.find({}).select('email name').lean()
      return NextResponse.json({
        step: 1,
        result: 'USER NOT FOUND',
        searchedFor: email,
        availableEmails: allUsers.map((u:any) => u.email),
      })
    }

    // Step 2: check password field
    const pwField = user.password
    const pwType = typeof pwField
    const pwIsBcrypt = pwField?.startsWith?.('$2') || false

    // Step 3: bcrypt compare
    let compareResult = null
    let compareError = null
    try {
      compareResult = await bcrypt.compare(pin, pwField)
    } catch (e:any) {
      compareError = e.message
    }

    // Step 4: also try comparing with raw match (in case password not hashed)
    const rawMatch = pwField === pin

    // Step 5: force-set a fresh hash and try again
    const freshHash = await bcrypt.hash(pin, 10)
    const freshCompare = await bcrypt.compare(pin, freshHash)

    return NextResponse.json({
      step: 'all',
      userFound: true,
      user: { name: user.name, email: user.email, role: user.role, active: user.active },
      passwordField: {
        type: pwType,
        length: pwField?.length,
        startsWithDollar2: pwIsBcrypt,
        first10chars: pwField?.substring(0, 10),
      },
      bcryptCompare: {
        result: compareResult,
        error: compareError,
        verdict: compareResult ? '✓ PASS — should login' : '✗ FAIL — PIN mismatch',
      },
      rawStringMatch: rawMatch,
      sanity: {
        freshHashCompare: freshCompare,
        verdict: freshCompare ? '✓ bcrypt works' : '✗ bcrypt broken',
      },
    })
  } catch (e:any) {
    return NextResponse.json({ error: e.message, stack: e.stack }, { status: 500 })
  }
}
