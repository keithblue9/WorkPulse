import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'
import { IssueModel } from '@/models/Issue'
import { KPIModel } from '@/models/KPI'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { type, userId, userName } = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json({ data: { insight: 'AI Insight belum dikonfigurasi. Tambahkan ANTHROPIC_API_KEY di environment variables.', type: 'warning' } })
    }

    const [initiatives, issues, kpis] = await Promise.all([
      InitiativeModel.find({ year: 2026 }).lean(),
      IssueModel.find({}).lean(),
      KPIModel.find({ year: 2026 }).lean(),
    ])

    let prompt = ''
    if (type === 'team') {
      const avgProgress = initiatives.length ? Math.round(initiatives.reduce((s, i) => s + i.actualProgress, 0) / initiatives.length) : 0
      const overdueCount = issues.filter(i => i.status === 'delayed' || i.status === 'at_risk').length
      const completedCount = issues.filter(i => i.status === 'completed').length
      prompt = `Kamu adalah AI advisor untuk tim BPD Procurement Pertamina. Analisis data tim berikut dan berikan insight dalam Bahasa Indonesia yang ringkas, actionable, dan motivating.

Data Tim:
- Total initiatives: ${initiatives.length}
- Average progress: ${avgProgress}% (target M6: 50%)
- Issues on track: ${issues.filter(i => i.status === 'on_track').length}
- Issues at risk/delayed: ${overdueCount}
- Issues completed: ${completedCount}
- KPI items: ${kpis.length}

Initiatives:
${initiatives.map(i => `- ${i.code}: ${i.title} — actual ${i.actualProgress}% vs plan ${i.planProgress}% (${i.status})`).join('\n')}

Top issues at risk:
${issues.filter(i => i.status === 'delayed' || i.status === 'at_risk').slice(0, 5).map(i => `- ${i.title} | progress: ${i.progress}% | PIC: ${i.picName} | due: ${i.dueDate}`).join('\n')}

Berikan insight dalam format:
1. Ringkasan situasi tim (2-3 kalimat)
2. 3 hal yang perlu segera diperhatikan
3. 2 rekomendasi strategis untuk mencapai target M6
4. Motivational closing (1 kalimat)

Gunakan emoji secukupnya. Maksimal 250 kata.`
    } else if (type === 'personal' && userName) {
      const myIssues = issues.filter(i => i.picName === userName || i.pic === userName)
      const myKPIs = kpis.filter(k => k.pic?.includes(userName))
      prompt = `Kamu adalah AI advisor personal untuk ${userName} di tim BPD Procurement Pertamina.

Data personal ${userName}:
- Issues yang menjadi tanggung jawab: ${myIssues.length}
- Issues selesai: ${myIssues.filter(i => i.status === 'completed').length}
- Issues at risk/delayed: ${myIssues.filter(i => i.status === 'delayed' || i.status === 'at_risk').length}

Detail issues:
${myIssues.map(i => `- ${i.title} | ${i.progress}% | ${i.status} | due: ${i.dueDate} | next: ${i.nextPlan || '-'}`).join('\n') || '(tidak ada issue)'}

KPI yang terkait:
${myKPIs.map(k => `- ${k.title} | ${k.category} | actual ${k.actualPct}% vs plan ${k.planPct}%`).join('\n') || '(tidak ada KPI)'}

Berikan insight personal dalam format:
1. Evaluasi singkat performa ${userName} saat ini (2-3 kalimat)
2. 3 prioritas yang harus difokuskan minggu ini
3. 1 risiko yang perlu diantisipasi
4. Rekomendasi untuk ${userName} secara personal
5. Encouragement (1 kalimat)

Gunakan kata "kamu" dan tone yang personal & supportive. Maksimal 200 kata.`
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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || 'Gagal mendapatkan insight.'
    return NextResponse.json({ data: { insight: text, type, generatedAt: new Date().toISOString() } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
