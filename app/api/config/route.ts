import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'
import { DEFAULT_ROLES, DEFAULT_WIDGETS, DEFAULT_LINK_CATEGORIES, DEFAULT_FONNTE } from '@/lib/defaults'

export async function GET() {
  try {
    await connectDB()
    let cfg = await ConfigModel.findOne({}).lean() as any
    if (!cfg) {
      const created = await ConfigModel.create({})
      cfg = created.toObject()
    }

    // Hardcoded defaults (don't rely on mongoose schema introspection — unreliable for new array fields on legacy docs)
    const FALLBACKS: any = {
      attendanceTypes: [
        { key:'wfo', label:'WFO', textColor:'#4f8ef7', color:'#1a2d4a', active:true },
        { key:'wfh', label:'WFH', textColor:'#8b7adc', color:'#1e1630', active:true },
        { key:'dinas', label:'Dinas Luar', textColor:'#c9954d', color:'#2a1f0a', active:true },
        { key:'cuti', label:'Cuti', textColor:'#56a47a', color:'#142a1e', active:true },
        { key:'sakit', label:'Sakit', textColor:'#d65f5f', color:'#2a1010', active:true },
        { key:'izin', label:'Izin', textColor:'#9aa6b3', color:'#1a1a2a', active:true },
      ],
      budgetCategories: [
        { key:'travel', label:'Dinas & Travel', annualBudget:0, annualBudgetUSD:0, pic:'', threshold:80 },
        { key:'accommodation', label:'External Accommodation', annualBudget:0, annualBudgetUSD:0, pic:'', threshold:80 },
      ],
      activityCategories: [
        { key:'iVendor', label:'iVendor', color:'#4f8ef7', active:true },
        { key:'iPRO',    label:'iPRO',    color:'#8b7adc', active:true },
        { key:'OnePro',  label:'OnePro',  color:'#56a47a', active:true },
        { key:'PAL',     label:'PAL',     color:'#c9954d', active:true },
        { key:'KIMS',    label:'KIMS',    color:'#5fb3ad', active:true },
        { key:'Others',  label:'Others',  color:'#9aa6b3', active:true },
      ],
      activitySubTypes: [
        { key:'KPI',     label:'KPI',      color:'#4f8ef7', active:true },
        { key:'Non-KPI', label:'Non KPI',  color:'#8b7adc', active:true },
        { key:'Go-Live', label:'Go Live',  color:'#56a47a', active:true },
        { key:'Others',  label:'Others',   color:'#9aa6b3', active:true },
        { key:'Anggaran',label:'Anggaran', color:'#c9954d', active:true },
      ],
      progressSubTabs: [
        { key:'KPI', label:'KPI', color:'#4f8ef7', active:true },
        { key:'Non-KPI', label:'Non KPI', color:'#8b7adc', active:true },
        { key:'Go-Live', label:'Go Live', color:'#56a47a', active:true },
        { key:'Others', label:'Others', color:'#9aa6b3', active:true },
        { key:'Anggaran', label:'Anggaran', color:'#c9954d', active:true },
      ],
      issueStatuses: [
        { key:'on_track',  label:'On Track',  color:'#56a47a', active:true },
        { key:'at_risk',   label:'At Risk',   color:'#c9954d', active:true },
        { key:'delayed',   label:'Delayed',   color:'#d65f5f', active:true },
        { key:'completed', label:'Completed', color:'#4f8ef7', active:true },
      ],
      meetingCategories: [
        { key:'weekly',  label:'Weekly Meeting',     color:'#4f8ef7', active:true },
        { key:'project', label:'Project Discussion', color:'#8b7adc', active:true },
        { key:'1on1',    label:'1-on-1',             color:'#56a47a', active:true },
        { key:'workshop',label:'Workshop',           color:'#c9954d', active:true },
        { key:'external',label:'External',           color:'#d65f5f', active:true },
        { key:'general', label:'General',            color:'#9aa6b3', active:true },
      ],
      roleDefs: DEFAULT_ROLES,
      dashboardWidgets: DEFAULT_WIDGETS,
      linkCategories: DEFAULT_LINK_CATEGORIES,
    }

    let needsUpdate = false
    const updates: any = {}
    for (const k of Object.keys(FALLBACKS)) {
      if (!cfg[k] || !Array.isArray(cfg[k]) || cfg[k].length === 0) {
        cfg[k] = FALLBACKS[k]
        updates[k] = FALLBACKS[k]
        needsUpdate = true
      }
    }
    if (!cfg.fonnte || !cfg.fonnte.apiUrl) {
      cfg.fonnte = DEFAULT_FONNTE
      updates.fonnte = DEFAULT_FONNTE
      needsUpdate = true
    }
    if (!cfg.loginBackgrounds) cfg.loginBackgrounds = []

    // One-time rename: WinS -> WorkPulse (nama resmi produk)
    if (cfg.appName === 'WinS' || cfg.appName === 'Work Intelligence System') {
      cfg.appName = 'WorkPulse'; updates.appName = 'WorkPulse'; needsUpdate = true
    }

    // One-time cleanup: WinS dedicated untuk BPD Procurement — buang sisa "& SS Procurement" di tagline lama
    for (const k of ['appTagline','loginTagline']) {
      if (typeof cfg[k] === 'string' && /SS Procurement/i.test(cfg[k])) {
        cfg[k] = cfg[k].replace(/BPD\s*&\s*SS Procurement/gi, 'BPD Procurement').replace(/\s*&\s*SS Procurement/gi, '').replace(/SS Procurement/gi, 'BPD Procurement')
        updates[k] = cfg[k]; needsUpdate = true
      }
    }

    // Reconcile dashboardWidgets dgn DEFAULT_WIDGETS: tambah key baru, buang usang, update label/segment
    try {
      const existing: any[] = Array.isArray(cfg.dashboardWidgets) ? cfg.dashboardWidgets : []
      const byKey: Record<string, any> = {}; existing.forEach(w => { byKey[w.key] = w })
      const validKeys = new Set(DEFAULT_WIDGETS.map((w:any)=>w.key))
      let changed = existing.some(w => !validKeys.has(w.key)) || existing.length !== DEFAULT_WIDGETS.length
      const merged = DEFAULT_WIDGETS.map((dw:any) => {
        const ex = byKey[dw.key]
        if (!ex) { changed = true; return { ...dw } }
        if (ex.label !== dw.label || ex.segment !== dw.segment || (!ex.size && dw.size)) changed = true
        return { ...dw, active: ex.active !== false, activeGuest: ex.activeGuest !== false, order: ex.order ?? dw.order, size: ex.size || dw.size || 'full' }
      })
      if (changed) { cfg.dashboardWidgets = merged; updates.dashboardWidgets = merged; needsUpdate = true }
    } catch {}

    if (needsUpdate) {
      try { await ConfigModel.updateOne({ _id: cfg._id }, { $set: updates }) } catch (e) { console.error('backfill update failed', e) }
    }

    return NextResponse.json({ data: cfg }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e:any) {
    console.error('GET /api/config error', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const cfg = await ConfigModel.findOneAndUpdate({}, body, { new:true, upsert:true })
    return NextResponse.json({ data: cfg }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
