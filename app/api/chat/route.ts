import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.ANTHROPIC_API_KEY
// Default to the cheapest model (Haiku). Overridable via env without a code redeploy.
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5'

const SYSTEM =
  'Namamu Wibi — kepanjangannya "Work Intelligence Buddy, Your AI Assistant in WinS". ' +
  'Kamu asisten AI yang ramah, cerdas, dan serba bisa, tinggal di dalam aplikasi WinS. ' +
  'Pengetahuanmu LUAS: kamu boleh dan bisa membantu pertanyaan apa pun, baik soal aplikasi maupun di luar aplikasi ' +
  '(rekomendasi tempat makan, info umum, tips, hitung-hitungan, penjelasan, ide, dll). Jangan membatasi diri hanya ke aplikasi. ' +
  'Selalu perkenalkan diri sebagai Wibi. Kalau ditanya kepanjangannya, jawab "Work Intelligence Buddy, Your AI Assistant in WinS". ' +
  'Jangan menyebut nama lain (seperti "WorkPulse", "SIERA", atau "WinS Assistant") kecuali ditanya. ' +
  'Jawab dengan ramah, jelas, dan to the point. Ikuti bahasa user (default Bahasa Indonesia santai). ' +
  'Untuk hal yang butuh info terkini (harga, kurs, tempat, berita, jadwal), gunakan pencarian web bila tersedia; ' +
  'kalau tidak tersedia, beri jawaban terbaik dari pengetahuanmu dan tandai sebagai perkiraan. Jujur kalau memang tidak tahu.'

async function callOnce(messages: any[], useTools: boolean) {
  const payload: any = { model: MODEL, max_tokens: 1500, system: SYSTEM, messages }
  if (useTools) payload.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }]
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY as string, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  })
  return r
}

export async function POST(req: NextRequest) {
  try {
    if (!API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set di Vercel env vars' }, { status: 200 })
    const body = await req.json()
    const messages = (body?.messages || [])
      .filter((m: any) => m && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 4000) }))
    if (!messages.length) return NextResponse.json({ error: 'no messages' }, { status: 400 })

    // First try with web search enabled (for current info). If the model/plan rejects
    // the tool, transparently retry without tools so the chat still answers.
    let r = await callOnce(messages, true)
    if (!r.ok) r = await callOnce(messages, false)
    if (!r.ok) {
      const e = await r.text()
      return NextResponse.json({ error: `API ${r.status}: ${e.substring(0, 200)}` }, { status: 200 })
    }
    const d = await r.json()
    // Web search interleaves multiple text blocks — concatenate them all
    const reply = (d?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    return NextResponse.json({ reply: reply || '(tidak ada respons)' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 200 })
  }
}
