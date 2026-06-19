import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials:', { hasEmail: !!credentials?.email, hasPassword: !!credentials?.password })
          return null
        }
        await connectDB()
        const email = String(credentials.email).toLowerCase().trim()
        const pin = String(credentials.password).trim()
        console.log('[AUTH] Login attempt:', { email, pinLength: pin.length })

        // Try lowercase match first; if missed, fall back to case-insensitive (legacy users with mixed-case emails)
        let user = await UserModel.findOne({ email }).lean() as any
        if (!user) {
          const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          user = await UserModel.findOne({ email: { $regex: new RegExp(`^${escaped}$`, 'i') } }).lean() as any
          if (user) {
            console.log('[AUTH] Found via case-insensitive match, normalizing email:', user.email, '→', email)
            await UserModel.updateOne({ _id: user._id }, { $set: { email } })
          }
        }
        if (!user) {
          console.log('[AUTH] User not found:', email)
          return null
        }
        if (user.active === false) {
          console.log('[AUTH] User is inactive:', email)
          return null
        }
        if (!user.password) {
          console.log('[AUTH] User has no password field:', email)
          return null
        }

        let valid = false
        try {
          valid = await bcrypt.compare(pin, user.password)
        } catch (e:any) {
          console.log('[AUTH] bcrypt error:', e.message)
        }

        // Fallback: if bcrypt fails AND password equals the PIN as raw string, allow (then rehash)
        if (!valid && user.password === pin) {
          console.log('[AUTH] Raw match — migrating to bcrypt')
          const newHash = await bcrypt.hash(pin, 10)
          await UserModel.updateOne({ _id: user._id }, { $set: { password: newHash } })
          valid = true
        }

        if (!valid) {
          console.log('[AUTH] PIN mismatch for:', email, '— password hash length:', user.password.length)
          return null
        }
        console.log('[AUTH] Success:', email)
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          roles: (user.roles && user.roles.length) ? user.roles : (user.role ? [user.role] : ['member']),
          division: user.division,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) { token.role = user.role; token.roles = user.roles; token.division = user.division; token.id = user.id }
      return token
    },
    async session({ session, token }: any) {
      if (session.user) { session.user.role = token.role; session.user.roles = token.roles; session.user.division = token.division; session.user.id = token.id }
      return session
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
