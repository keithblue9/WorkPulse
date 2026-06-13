import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ProjectModel } from '@/models/Project'
import { IssueModel } from '@/models/Issue'
import { InitiativeModel } from '@/models/Initiative'
import { UserModel } from '@/models/User'
import { format } from 'date-fns'

const API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-4-5'

async function callClaude(systemPrompt:string, userPrompt:string, maxTokens=600) {
  if (!API_KEY) return { error:'ANTHROPIC_API_KEY belum di-set di Vercel env vars' }
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key':API_KEY, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({ model:MODEL, max_tokens:maxTokens, system:systemPrompt, messages:[{ role:'user', content:userPrompt }] }),
  })
  if (!r.ok) { const e = await r.text(); return { error:`API ${r.status}: ${e.substring(0,200)}` } }
  const d = await r.json()
  return { text: d?.content?.[0]?.text?.trim() || '' }
}

export async function POST(req:NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const { type, userName, userEmail } = body

    // ═══ BIRTHDAY PANTUN ═══
    if (type === 'birthday') {
      const { birthdayName, age } = body
      const sys = 'Kamu generator pantun ulang tahun Indonesia. Bikin pantun ulang tahun yang lucu, hangat, dan personal. Format: 4 baris pantun (a-b-a-b) + 1 kalimat doa singkat. Maksimal 6 baris total. Pakai bahasa santai Indonesia.'
      const userPrompt = `Buatkan pantun ulang tahun untuk ${birthdayName} (umur ${age || '?'}) yang hari ini ulang tahun. Pantun harus lucu tapi tetap respectful.`
      const { text, error } = await callClaude(sys, userPrompt, 300)
      return NextResponse.json(error ? { error } : { data:{ insight:text } })
    }

    // ═══ DAILY QUOTE (inspirational for teamwork) + TRIVIA/KURS ═══
    if (type === 'quotes') {
      const seed = format(new Date(), 'yyyy-MM-dd')
      const sys = 'Anda kurator konten harian untuk dashboard tim kerja profesional. Berikan output dalam DUA bagian, dipisah baris kosong:\n\nBagian 1 — QUOTE INSPIRATIF tentang kerja sama tim, kepemimpinan, atau produktivitas (boleh dari tokoh terkenal, filsuf, atau pemimpin bisnis). Format:\n"[quote]"\n— [penulis]\n\nBagian 2 — Pilih SALAH SATU secara acak: (a) satu TRIVIA menarik dan singkat (tentang sejarah, sains, atau dunia kerja), ATAU (b) info KURS RUPIAH terkini perkiraan (USD, EUR, SGD ke IDR). Awali bagian ini dengan "💡 Trivia:" atau "💱 Kurs:". \n\nGunakan bahasa Indonesia formal dan profesional. JANGAN tambahkan paragraf refleksi atau narasi panjang. Singkat dan rapi saja.'
      const userPrompt = `Tanggal: ${seed}. Berikan quote inspiratif kerja tim + satu trivia menarik atau info kurs rupiah. Singkat, formal, tanpa narasi tambahan.`
      const { text, error } = await callClaude(sys, userPrompt, 400)
      return NextResponse.json(error ? { error } : { data:{ insight:text } })
    }

    // ═══ TEAM INSIGHT (action-oriented, dashboard-based) ═══
    if (type === 'team') {
      const [issues, projects, inits] = await Promise.all([
        IssueModel.find({}).lean(), ProjectModel.find({}).lean(), InitiativeModel.find({}).lean(),
      ])
      const stats = {
        totalIssues: issues.length,
        highPriority: issues.filter((i:any)=>i.priority==='high').length,
        atRisk: issues.filter((i:any)=>i.status==='at_risk').length,
        delayed: issues.filter((i:any)=>i.status==='delayed').length,
        completedThisMonth: issues.filter((i:any)=>i.status==='completed').length,
        activeProjects: projects.length,
        initiatives: inits.map((i:any)=>({ code:i.code, title:i.title, plan:i.planProgress, actual:i.actualProgress, status:i.status })),
      }
      const topAtRisk = issues.filter((i:any)=>i.status==='at_risk'||i.status==='delayed').slice(0,5).map((i:any)=>({title:i.title, pic:i.picName, status:i.status, priority:i.priority}))
      const sys = 'Anda konsultan strategis untuk tim procurement yang memberikan insight tingkat STRATEGIS (bukan teknis detail). Insight ini dibaca oleh manajer, jadi fokus pada arahan strategis, prioritas, dan risiko bisnis. WAJIB: berikan 3-5 poin strategis konkret untuk fokus tim minggu ini. Setiap poin diawali kata kerja strategis ("Prioritaskan...", "Mitigasi risiko...", "Tinjau...", "Eskalasi...", "Selaraskan..."). Gunakan bahasa Indonesia FORMAL dan profesional — TANPA bahasa gaul, TANPA kata gue/lo. Format dengan emoji 🎯 di setiap poin. Maksimal 5 poin, masing-masing 1-2 kalimat.'
      const userPrompt = `Data dashboard tim BPD Procurement:\n${JSON.stringify(stats, null, 2)}\n\nTop at-risk/delayed:\n${JSON.stringify(topAtRisk, null, 2)}\n\nBerikan arahan STRATEGIS (bukan teknis) untuk fokus tim minggu ini berdasarkan data. Bahasa Indonesia formal, untuk dibaca manajer.`
      const { text, error } = await callClaude(sys, userPrompt, 700)
      return NextResponse.json(error ? { error } : { data:{ insight:text } })
    }

    // ═══ PERSONAL INSIGHT (specific to logged-in user) ═══
    if (type === 'personal' || type === 'profile') {
      if (!userName) return NextResponse.json({ error:'userName required' }, { status:400 })
      const user = await UserModel.findOne({ $or:[{name:userName},{email:userEmail}] }).lean() as any
      // Get this user's activities + issues
      const userActivities = await ProjectModel.find({ $or:[{pic:userName},{picName:userName},{members:userName}] }).lean()
      const userIssues = await IssueModel.find({ picName:userName }).lean()
      const summary = {
        activities: userActivities.length,
        issues: userIssues.length,
        highPriority: userIssues.filter((i:any)=>i.priority==='high').length,
        atRisk: userIssues.filter((i:any)=>i.status==='at_risk').length,
        delayed: userIssues.filter((i:any)=>i.status==='delayed').length,
        completed: userIssues.filter((i:any)=>i.status==='completed').length,
        upcomingActions: userActivities.filter((a:any)=>a.actionDate && new Date(a.actionDate)>=new Date()).slice(0,5).map((a:any)=>({title:a.title, date:a.actionDate, priority:a.priority, status:a.status, nextPlan:a.nextPlan})),
        recentActivitiesNarrative: userActivities.slice(0,5).map((a:any)=>({title:a.title, progress:a.progressNotes, nextPlan:a.nextPlan})),
      }
      const sys = `Anda asisten produktivitas profesional untuk ${userName} (tim procurement). Berikan 3-4 rekomendasi tindakan (next action) konkret khusus untuk ${userName} berdasarkan aktivitas dan issue mereka. Setiap rekomendasi harus:\n- Diawali kata kerja ("Selesaikan...", "Tindak lanjuti...", "Jadwalkan...", "Perbarui...")\n- Merujuk ke aktivitas/issue spesifik mereka\n- Diberi indikator urgensi (🔥 mendesak / ⚡ prioritas / 📋 normal)\nGunakan bahasa Indonesia FORMAL dan profesional — TANPA kata gue/lo atau bahasa gaul. Maksimal 4 poin.`
      const userPrompt = `Data ${userName}:\n${JSON.stringify(summary, null, 2)}\n\nBerikan 3-4 rekomendasi tindakan konkret berdasarkan prioritas. Bahasa Indonesia formal dan profesional.`
      const { text, error } = await callClaude(sys, userPrompt, 600)
      return NextResponse.json(error ? { error } : { data:{ insight:text } })
    }

    return NextResponse.json({ error:'Unknown type' }, { status:400 })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
