import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import DashboardShell from '@/components/DashboardShell'
import { SessionScope } from './SessionScope'

// Sesi dibaca di server lalu diteruskan ke klien: shell & menu langsung tampil di HTML awal
// (tanpa spinner menunggu /api/auth/session). Akses tetap dijaga oleh proxy.ts.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return <SessionScope session={session}><DashboardShell>{children}</DashboardShell></SessionScope>
}
