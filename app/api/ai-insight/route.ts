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

    // ═══ DAILY QUOTE ═══
    if (type === 'quotes') {
      const seed = format(new Date(), 'yyyy-MM-dd')
      const sys = 'Kamu kurator quote inspiratif. Pilih SATU quote menarik (boleh Shakespeare, filsuf Yunani, tokoh modern, atau trivia menarik tentang business/productivity/work culture). Berikan dalam format:\n\n"[quote dalam bahasa asli atau English]"\n— [penulis/sumber]\n\n[2-3 kalimat refleksi singkat dalam bahasa Indonesia, gimana relate ke kerja team procurement]'
      const userPrompt = `Date seed: ${seed}. Berikan satu inspirational quote atau trivia menarik hari ini.`
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
      const sys = 'Kamu konsultan procurement yang ngasih ACTION-oriented insight, bukan narasi umum. WAJIB: kasih 3-5 bullet action point konkret yang harus dilakukan team minggu ini. Setiap bullet harus actionable (start dengan verb: "Follow up...", "Schedule...", "Review...", "Eskalasi..."). Tone direktif tapi enak. Bahasa Indonesia casual. Format dengan emoji bullet 🎯 di tiap point. Max 5 bullet, masing-masing 1-2 kalimat.'
      const userPrompt = `Data dashboard tim BPD Procurement:\n${JSON.stringify(stats, null, 2)}\n\nTop at-risk/delayed:\n${JSON.stringify(topAtRisk, null, 2)}\n\nKasih saran ACTION konkret apa yang harus team kerjain minggu ini berdasarkan data di atas. Bukan narasi general, tapi to-do list konkret.`
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
      const sys = `Kamu personal productivity coach untuk ${userName} (procurement team). WAJIB: SUGGEST 3-4 NEXT ACTION konkret khusus untuk ${userName}, berdasarkan activities dan issues mereka sendiri. JANGAN narasi umum. Setiap suggestion harus:\n- Start dengan verb action ("Selesaikan...", "Follow up...", "Jadwalkan...", "Update progress...")\n- Refer ke aktivitas/issue spesifik mereka\n- Berikan urgency indicator (🔥 urgent / ⚡ priority / 📋 normal)\nBahasa Indonesia casual. Max 4 bullet.`
      const userPrompt = `Data ${userName}:\n${JSON.stringify(summary, null, 2)}\n\nKasih saya 3-4 NEXT ACTION konkret yang harus saya lakukan, urut by prioritas. Bukan motivational speech, tapi to-do list specific.`
      const { text, error } = await callClaude(sys, userPrompt, 600)
      return NextResponse.json(error ? { error } : { data:{ insight:text } })
    }

    return NextResponse.json({ error:'Unknown type' }, { status:400 })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
