import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'
import { IssueModel } from '@/models/Issue'
import { KPIModel } from '@/models/KPI'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { type, userName } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        data: {
          insight: '⚠️ AI Insight belum aktif.\n\nUntuk mengaktifkan:\n1. Buka console.anthropic.com → ambil API key\n2. Vercel → Settings → Environment Variables\n3. Tambah: ANTHROPIC_API_KEY = sk-ant-...\n4. Redeploy aplikasi\n\nGratis $5 credit untuk mulai!',
          type: 'warning'
        }
      })
    }

    const [initiatives, issues, kpis] = await Promise.all([
      InitiativeModel.find({ year: 2026 }).lean().catch(() => []),
      IssueModel.find({}).lean().catch(() => []),
      KPIModel.find({ year: 2026 }).lean().catch(() => []),
    ])

    let prompt = ''
    if (type === 'team') {
      const avgProgress = initiatives.length ? Math.round(initiatives.reduce((s:number, i:any) => s + (i.actualProgress||0), 0) / initiatives.length) : 0
      prompt = `Kamu adalah AI advisor untuk tim BPD Procurement Pertamina. Berikan insight singkat dalam Bahasa Indonesia.

Data:
- Initiatives: ${initiatives.length} | Avg progress: ${avgProgress}% (target 50%)
- Issues: ${issues.length} total | ${issues.filter((i:any) => i.status === 'completed').length} selesai | ${issues.filter((i:any) => i.status === 'delayed' || i.status === 'at_risk').length} berisiko
- KPI items: ${kpis.length}

Format:
🎯 **Status Tim**: 2-3 kalimat ringkasan
⚠️ **Perlu Perhatian**: 3 hal
💡 **Rekomendasi**: 2 strategi
🚀 Closing motivational 1 kalimat

Max 200 kata. Pakai emoji secukupnya.`
    } else if (type === 'personal' && userName) {
      const myIssues = issues.filter((i:any) => i.picName === userName || i.pic === userName)
      prompt = `Kamu adalah AI advisor personal untuk ${userName} di BPD Procurement Pertamina.

Data ${userName}:
- Issues ditangani: ${myIssues.length}
- Selesai: ${myIssues.filter((i:any) => i.status === 'completed').length}
- Berisiko: ${myIssues.filter((i:any) => i.status === 'delayed' || i.status === 'at_risk').length}

${myIssues.slice(0,5).map((i:any) => `- ${i.title} | ${i.progress}% | ${i.status}`).join('\n') || '(belum ada issue)'}

Format:
👤 **Evaluasi**: 2 kalimat
🎯 **Fokus Minggu Ini**: 3 prioritas
⚡ **Antisipasi**: 1 risiko
💪 Encouragement 1 kalimat

Tone: personal, "kamu". Max 150 kata.`
    } else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({
        data: { insight: `⚠️ API Error (${response.status}): ${err.slice(0, 200)}\n\nKemungkinan: API key invalid atau credit habis. Cek console.anthropic.com`, type: 'error' }
      })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || 'Tidak ada response.'
    return NextResponse.json({ data: { insight: text, type, generatedAt: new Date().toISOString() } })
  } catch (e: any) {
    return NextResponse.json({
      data: { insight: `⚠️ Error: ${e.message}\n\nCoba refresh atau hubungi admin.`, type: 'error' }
    })
  }
}
