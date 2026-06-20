import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.ANTHROPIC_API_KEY
// Default to the cheapest model (Haiku). Overridable via env without a redeploy of code.
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5'

const SYSTEM = 'Namamu SIERA — asisten AI yang ramah di aplikasi WinS. ' +
  'Selalu perkenalkan diri sebagai SIERA. JANGAN pernah menyebut nama lain seperti "WorkPulse", "WinS Assistant", atau menyebut-nyebut nama perusahaan/organisasi kecuali user yang menanyakannya. ' +
  'Jawab ringkas, jelas, dan ramah. Ikuti bahasa user (default Bahasa Indonesia santai). ' +
  'Kalau tidak tahu atau butuh data internal yang tidak kamu punya, katakan jujur dan sarankan cek menu terkait.'

export async function POST(req: NextRequest) {
  try {
    if (!API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set di Vercel env vars' }, { status: 200 })
    const body = await req.json()
    const messages = (body?.messages || [])
      .filter((m: any) => m && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }))
    if (!messages.length) return NextResponse.json({ error: 'no messages' }, { status: 400 })

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, messages }),
    })
    if (!r.ok) {
      const e = await r.text()
      return NextResponse.json({ error: `API ${r.status}: ${e.substring(0, 200)}` }, { status: 200 })
    }
    const d = await r.json()
    const reply = (d?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    return NextResponse.json({ reply: reply || '(tidak ada respons)' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 200 })
  }
}
