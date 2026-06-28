import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { BudgetModel } from '@/models/Budget'
import { CashCardModel } from '@/models/CashCard'
import { ReimbursementModel } from '@/models/Reimbursement'
import { PettyCashModel } from '@/models/PettyCash'
import { ThirdPartyEventModel } from '@/models/ThirdPartyEvent'
import { UserModel } from '@/models/User'
import { ProjectModel } from '@/models/Project'
import { MeetingReportModel } from '@/models/MeetingReport'
import { ConfigModel } from '@/models/Config'

const API_KEY = process.env.ANTHROPIC_API_KEY
const PRIMARY = process.env.PLAYGROUND_MODEL || 'claude-sonnet-4-6'
const FALLBACK = process.env.CHAT_MODEL || 'claude-haiku-4-5'

const idr = (n:number)=> 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n||0))

const SYSTEM_BASE =
  'Namamu Wibi — "Work Intelligence Buddy, Your AI Assistant in WinS". ' +
  'Kamu asisten AI cerdas di dalam aplikasi WinS (Work Intelligence System) milik tim BPD & SS Procurement Pertamina. ' +
  'Kamu PUNYA AKSES ke ringkasan data terkini aplikasi (JSON di bawah: budget per tahun + % realisasi, threshold prognosa, reimbursement per status/sumber/bulan, cash card, petty cash, 3rd party event, tim, dll). ' +
  'Saat menjawab soal data: SELALU rujuk angka asli dari JSON (sebutkan nominal/persentasenya), jangan mengira-ngira. ' +
  'Untuk insight: bandingkan plan vs realisasi, soroti cost element yang mendekati/melebihi threshold, lihat tren antar tahun di budgetPerTahun, dan tandai anomali (mis. realisasi jauh di atas/bawah plan). ' +
  'Beri jawaban yang ringkas tapi actionable — pakai poin bila perlu, dan tutup dengan rekomendasi singkat bila relevan. ' +
  'Kalau user tanya hal di luar data (umum, hitungan, ide), tetap bantu. Kalau ada gambar/dokumen diupload, baca & analisa juga. ' +
  'Jawab ramah, ikut bahasa user (default Bahasa Indonesia santai). ' +
  'Kalau data yang diminta tidak ada di ringkasan (mis. rincian per transaksi lama), katakan jujur dan minta user paste detailnya. Jangan mengarang angka.'

async function buildSnapshot(): Promise<string> {
  try {
    await connectDB()
    const now = new Date(); const year = now.getFullYear()
    const [budgets, cashcards, reimburses, petty, tpe, users, projects, meetings, config] = await Promise.all([
      BudgetModel.find({}).lean(),
      CashCardModel.find({ year }).sort({ month:1 }).lean(),
      ReimbursementModel.find({}).sort({ createdAt:-1 }).limit(800).lean(),
      PettyCashModel.findOne({ year }).lean(),
      ThirdPartyEventModel.find({ year }).lean(),
      UserModel.find({}, 'name role roles division active').lean(),
      ProjectModel.countDocuments({}),
      MeetingReportModel.countDocuments({}),
      ConfigModel.findOne({}).lean() as any,
    ]) as any[]

    const catName = (k:string)=> k==='travel' ? 'Travel Expense (6001008100)' : k==='accommodation' ? 'External Accommodation (6001016170)' : k
    const pctStr = (real:number, plan:number)=> plan>0 ? (real/plan*100).toFixed(1)+'%' : '—'

    // Budget per tahun/cost element (+ nominal terformat + % realisasi biar akurat)
    const budgetByYear: any = {}
    for (const b of budgets) {
      const y = b.year || '—'; budgetByYear[y] = budgetByYear[y] || []
      budgetByYear[y].push({
        costElement: catName(b.category),
        planIDR: idr(b.annualBudgetIDR||0), realIDR: idr(b.annualRealIDR||0), pctRealIDR: pctStr(b.annualRealIDR||0, b.annualBudgetIDR||0),
        planUSD: b.annualBudgetUSD||0, realUSD: b.annualRealUSD||0, pctRealUSD: pctStr(b.annualRealUSD||0, b.annualBudgetUSD||0),
      })
    }

    // Cash card tahun ini
    const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
    const cc = cashcards.map((c:any)=>({ bulan:MONTHS[(c.month||1)-1], topUp:idr(c.topUpAmount||0), settlement:idr(c.settlementAmount||0), pctSettlement:pctStr(c.settlementAmount||0, c.topUpAmount||0), refund:idr(c.refundAmount||0), locked:!!c.locked }))

    // Reimburse ringkas: per status, per sumber, per bulan (tahun ini), total
    const byStatus:any = {}, bySource:any = { cashCard:0, pettyCash:0 }
    let totalAmount = 0
    const byMonth:any = {}
    for (const r of reimburses) {
      byStatus[r.status] = (byStatus[r.status]||0) + 1
      totalAmount += r.amount||0
      if (r.isCashCard) bySource.cashCard += r.amount||0; else bySource.pettyCash += r.amount||0
      const d = r.billDate ? new Date(r.billDate) : (r.createdAt?new Date(r.createdAt):null)
      if (d && d.getFullYear()===year) { const m=MONTHS[d.getMonth()]; byMonth[m]=(byMonth[m]||0)+(r.amount||0) }
    }
    const recentReimburse = reimburses.slice(0,15).map((r:any)=>({ pengaju:r.userName, keperluan:r.title, kategori:r.category, nominal:r.amount||0, sumber:r.isCashCard?'Cash Card':'Petty Cash', status:r.status, tglBukti: r.billDate?new Date(r.billDate).toLocaleDateString('id-ID'):'-' }))

    const pettySummary = petty ? { tahun:petty.year, jumlahPemasukan:(petty.inflows||[]).length, totalPemasukan:idr((petty.inflows||[]).reduce((s:number,i:any)=>s+(i.amount||0),0)) } : null
    const events = tpe.map((e:any)=>({ judul:e.judulKegiatan, eo:e.namaEO, kota:e.kota, kind:e.kind, estimasi:idr(e.estimasiBiaya||0), nominalTagihan:idr(e.nominalTagihan||0) }))
    const team = users.filter((u:any)=>u.active!==false).map((u:any)=>({ nama:u.name, role:(u.roles&&u.roles[0])||u.role, divisi:u.division }))
    const getThr = (k:string)=> (config?.budgetCategories||[]).find((c:any)=>c.key===k)?.threshold ?? 80
    const thresholdPrognosa = { totalPct: config?.budgetThresholdTotal ?? 80, travelPct: getThr('travel'), externalPct: getThr('accommodation') }

    const snap = {
      tanggalSnapshot: now.toISOString().slice(0,10),
      tahunBerjalan: year,
      ringkasanReimbursement: { totalTransaksi: reimburses.length, totalNominalSemua: idr(totalAmount), perStatus: byStatus, perSumber: { cashCard: idr(bySource.cashCard), pettyCash: idr(bySource.pettyCash) }, perBulanTahunIni: Object.fromEntries(Object.entries(byMonth).map(([k,v]:any)=>[k, idr(v)])) },
      reimburseTerbaru: recentReimburse.map((r:any)=>({ ...r, nominal: idr(r.nominal) })),
      budgetPerTahun: budgetByYear,
      thresholdPrognosa,
      cashCardTahunIni: cc,
      pettyCash: pettySummary,
      thirdPartyEvent: events,
      tim: team,
      lainnya: { totalProject: projects, totalMeetingReport: meetings },
    }
    let s = JSON.stringify(snap)
    if (s.length > 16000) s = s.slice(0, 16000) + '…(terpotong)'
    return s
  } catch (e:any) {
    return JSON.stringify({ error: 'gagal baca data: ' + (e?.message||'unknown') })
  }
}

function sanitizeContent(content:any): any {
  if (typeof content === 'string') return String(content).slice(0, 8000)
  if (Array.isArray(content)) {
    const blocks:any[] = []
    for (const b of content) {
      if (!b || !b.type) continue
      if (b.type === 'text') blocks.push({ type:'text', text:String(b.text||'').slice(0,8000) })
      else if (b.type === 'image' && b.source?.data) blocks.push({ type:'image', source:{ type:'base64', media_type:b.source.media_type||'image/png', data:b.source.data } })
      else if (b.type === 'document' && b.source?.data) blocks.push({ type:'document', source:{ type:'base64', media_type:b.source.media_type||'application/pdf', data:b.source.data } })
    }
    return blocks.length ? blocks : '(kosong)'
  }
  return '(kosong)'
}

async function callOnce(model:string, system:string, messages:any[], useTools:boolean) {
  const payload:any = { model, max_tokens: 2500, system, messages }
  if (useTools) payload.tools = [{ type:'web_search_20250305', name:'web_search', max_uses: 3 }]
  return fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key': API_KEY as string, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify(payload),
  })
}

export async function POST(req: NextRequest) {
  try {
    if (!API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum di-set di Vercel env vars' }, { status: 200 })
    const body = await req.json()
    const incoming = (body?.messages || []).filter((m:any)=>m && m.content).slice(-16)
    const messages = incoming.map((m:any)=>({ role: m.role==='assistant'?'assistant':'user', content: sanitizeContent(m.content) }))
    if (!messages.length) return NextResponse.json({ error:'no messages' }, { status: 400 })

    const snapshot = await buildSnapshot()
    const system = SYSTEM_BASE + '\n\n=== DATA WINS TERKINI (ringkasan, JSON) ===\n' + snapshot

    // PRIMARY + tools -> PRIMARY no tools -> FALLBACK no tools
    let r = await callOnce(PRIMARY, system, messages, true)
    if (!r.ok) r = await callOnce(PRIMARY, system, messages, false)
    if (!r.ok) r = await callOnce(FALLBACK, system, messages, false)
    if (!r.ok) { const e = await r.text(); return NextResponse.json({ error: `API ${r.status}: ${e.substring(0,200)}` }, { status: 200 }) }
    const d = await r.json()
    const reply = (d?.content || []).filter((b:any)=>b.type==='text').map((b:any)=>b.text).join('').trim()
    return NextResponse.json({ reply: reply || '(tidak ada respons)' })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 200 })
  }
}
