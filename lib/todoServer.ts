// Helper server To-do (butuh DB). Dipisah dari route karena file route Next.js hanya boleh mengekspor handler HTTP.
import { UserModel } from '@/models/User'

export const uid = () => Math.random().toString(36).slice(2, 10)
const lc = (s: unknown) => String(s || '').trim().toLowerCase()

/** Peta email → nama untuk member aktif; dipakai validasi penerima. */
export async function memberNames(): Promise<Map<string, string>> {
  const users: any[] = await UserModel.find({ active: { $ne: false } }, 'name email').lean()
  return new Map(users.filter(u => u.email).map(u => [lc(u.email), String(u.name || u.email)]))
}
