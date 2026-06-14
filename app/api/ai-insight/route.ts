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

async function callClaudeWithSearch(systemPrompt:string, userPrompt:string, maxTokens=1500) {
  if (!API_KEY) return { error:'ANTHROPIC_API_KEY belum di-set di Vercel env vars' }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':API_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: maxTokens, system: systemPrompt,
        messages:[{ role:'user', content:userPrompt }],
        tools: [{ type:'web_search_20250305', name:'web_search', max_uses: 4 }],
      }),
    })
    if (!r.ok) {
      // Fallback: retry without tools (model/plan may not support web_search)
      const e = await r.text()
      const fb = await callClaude(systemPrompt + '\n\n(Catatan: tool pencarian tidak tersedia, gunakan estimasi terbaik untuk kurs & berita, beri label perkiraan.)', userPrompt, maxTokens)
      return fb.error ? { error:`API ${r.status}: ${e.substring(0,150)}` } : fb
    }
    const d = await r.json()
    // Concatenate all text blocks (search results interleave text blocks)
    const text = (d?.content || []).filter((b:any)=>b.type==='text').map((b:any)=>b.text).join('').trim()
    return { text: text || '' }
  } catch (e:any) {
    const fb = await callClaude(systemPrompt, userPrompt, maxTokens)
    return fb
  }
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

    // ═══ DAILY CONTENT: Quran + Quote + Kurs + News (4 parts, fresh each call) ═══
    if (type === 'quotes') {
      const now = new Date()
      const seed = now.toISOString() // full timestamp → forces variety each click
      const rand = Math.floor(Math.random() * 100000)
      const sys = `Anda kurator konten harian untuk dashboard tim kerja profesional di Indonesia. Hari ini ${now.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.

Berikan output dalam 4 BAGIAN, dipisah satu baris kosong. Gunakan judul bagian PERSIS seperti di bawah (dengan emoji). WAJIB BERBEDA setiap kali diminta — jangan ulang ayat/quote/berita yang umum dipakai.

📖 AYAT AL-QURAN
Pilih SATU ayat Al-Quran (acak, variasikan surah — jangan selalu Al-Baqarah/Ar-Rahman) yang relevan dengan kehidupan, syukur, kesabaran, ujian, rezeki, atau kerja keras. Tampilkan:
- Teks Arab
- Latin (transliterasi)
- Terjemahan Indonesia
- (Nama Surah: ayat)

💬 QUOTE MOTIVASI
Satu quote motivasi/kehidupan dari tokoh berbeda-beda (Shakespeare, filsuf, pemimpin, sastrawan dunia). Variasikan — JANGAN pakai quote klise yang itu-itu saja (hindari Michael Jordan, Steve Jobs yang umum). Format: "[quote]" — [penulis]

💱 KURS RUPIAH HARI INI
Kurs terkini (gunakan tool pencarian untuk data terupdate): USD, EUR, SGD, JPY terhadap IDR. Sebutkan tanggal/sumber jika ada.

🌍 BERITA EKONOMI & GEOPOLITIK
2-3 headline berita ekonomi global & geopolitik TERKINI (gunakan tool pencarian). Format poin singkat, masing-masing 1 kalimat.

Bahasa Indonesia formal. Variasi konten tiap permintaan sangat penting. Seed: ${rand}`
      const userPrompt = `Waktu: ${seed} (seed ${rand}). Berikan konten harian 4 bagian. Cari kurs rupiah terupdate dan berita ekonomi+geopolitik terkini lewat tool pencarian. Pastikan ayat Quran dan quote BERBEDA dari biasanya.`
      const { text, error } = await callClaudeWithSearch(sys, userPrompt, 1500)
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
      const sys = `Anda konsultan strategis untuk tim BPD (Business Process Design) di Shared Services Project. PENTING: tim ini BUKAN tim operasional procurement. Tugas mereka adalah MENYUSUN & MENGERJAKAN business process design untuk aplikasi-aplikasi terkait proses bisnis procurement (mis. iVendor, iPRO, OnePro, PAL, KIMS). Jadi JANGAN memberi saran soal operasional pengadaan/vendor/harga. Fokus saran pada: pencapaian KPI tim, peningkatan kualitas deliverable BPD, percepatan progress initiative/project design, mitigasi keterlambatan, koordinasi antar PIC, dan kualitas dokumentasi proses bisnis.

Berikan 3-5 poin strategis konkret untuk fokus tim minggu ini. Setiap poin diawali kata kerja strategis ("Prioritaskan...", "Percepat...", "Tinjau...", "Eskalasi...", "Selaraskan...", "Tingkatkan..."). Bahasa Indonesia FORMAL dan profesional — TANPA bahasa gaul/gue/lo. Format dengan emoji 🎯 di setiap poin. Maksimal 5 poin, masing-masing 1-2 kalimat. Dibaca oleh manajer.`
      const userPrompt = `Data dashboard tim BPD (Business Process Design untuk aplikasi procurement):\n${JSON.stringify(stats, null, 2)}\n\nTop at-risk/delayed:\n${JSON.stringify(topAtRisk, null, 2)}\n\nBerikan arahan STRATEGIS untuk fokus tim minggu ini — tentang pencapaian KPI dan kualitas/percepatan deliverable BPD, BUKAN soal operasional procurement. Bahasa Indonesia formal.`
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
      const sys = `Anda asisten produktivitas profesional untuk ${userName}, anggota tim BPD (Business Process Design) di Shared Services Project. Tugas tim: menyusun business process design untuk aplikasi terkait proses bisnis procurement — BUKAN operasional pengadaan. Berikan 3-4 rekomendasi tindakan (next action) konkret untuk ${userName} berdasarkan aktivitas & issue mereka, fokus pada penyelesaian deliverable design, pencapaian KPI, dan tindak lanjut progress. Setiap rekomendasi:\n- Diawali kata kerja ("Selesaikan...", "Tindak lanjuti...", "Jadwalkan...", "Perbarui...")\n- Merujuk ke aktivitas/issue spesifik mereka\n- Diberi indikator urgensi (🔥 mendesak / ⚡ prioritas / 📋 normal)\nBahasa Indonesia FORMAL dan profesional — TANPA gue/lo atau bahasa gaul. JANGAN gunakan format heading markdown (tanpa ## atau **). Tulis poin bersih dengan emoji urgensi saja. Maksimal 4 poin.`
      const userPrompt = `Data ${userName}:\n${JSON.stringify(summary, null, 2)}\n\nBerikan 3-4 rekomendasi tindakan konkret berdasarkan prioritas, fokus pada deliverable BPD & KPI. Bahasa Indonesia formal. Tanpa heading markdown.`
      const { text, error } = await callClaude(sys, userPrompt, 600)
      return NextResponse.json(error ? { error } : { data:{ insight:text } })
    }

    return NextResponse.json({ error:'Unknown type' }, { status:400 })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
