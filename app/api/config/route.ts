import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ConfigModel } from '@/models/Config'

function getSchemaDefaults() {
  const paths = (ConfigModel.schema as any).paths
  const defaults: any = {}
  for (const key in paths) {
    const path = paths[key]
    if (path.defaultValue !== undefined) {
      defaults[key] = typeof path.defaultValue === 'function' ? path.defaultValue() : path.defaultValue
    }
  }
  // Manual defaults for nested/new fields (Mongoose may not expose nested defaults reliably)
  if (!defaults.roleDefs) defaults.roleDefs = [
    { key:'admin',   label:'Admin',   builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','members','config'] },
    { key:'manager', label:'Manager', builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','members'] },
    { key:'member',  label:'Member',  builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','reimbursement'] },
    { key:'finance', label:'Finance', builtin:true,  allowedMenus:['dashboard','attendance','biodata','links','budget','reimbursement','cashcard','cashier'] },
    { key:'cashier', label:'Cashier', builtin:true,  allowedMenus:['dashboard','reimbursement','cashier','cashcard','biodata'] },
    { key:'guest',   label:'Guest',   builtin:true,  allowedMenus:['dashboard','links'] },
  ]
  if (!defaults.dashboardWidgets) defaults.dashboardWidgets = [
    { key:'stat-kpi',           label:'Stat: KPI',           segment:'stats', active:true, order:1 },
    { key:'stat-nonkpi',        label:'Stat: Non KPI',       segment:'stats', active:true, order:2 },
    { key:'stat-golive',        label:'Stat: Go Live',       segment:'stats', active:true, order:3 },
    { key:'stat-anggaran',      label:'Stat: Anggaran',      segment:'stats', active:true, order:4 },
    { key:'stat-others',        label:'Stat: Others',        segment:'stats', active:true, order:5 },
    { key:'stat-highpriority',  label:'Stat: High Priority', segment:'stats', active:true, order:6 },
    { key:'progress-chart',     label:'Chart Progress (donut)', segment:'main', active:true, order:1 },
    { key:'ai-quotes',          label:'AI Quotes (daily)',   segment:'ai',    active:true, order:1 },
    { key:'ai-insight-personal',label:'AI Insight Personal', segment:'ai',    active:true, order:2 },
    { key:'ai-insight-team',    label:'AI Insight Team',     segment:'ai',    active:true, order:3 },
    { key:'top-contributors',   label:'Top Contributors',    segment:'main',  active:true, order:2 },
    { key:'upcoming-agenda',    label:'Agenda Mendatang',    segment:'main',  active:true, order:3 },
    { key:'issue-distribution', label:'Issue Distribution',  segment:'main',  active:true, order:4 },
    { key:'member-count',       label:'Member Count Card',   segment:'main',  active:false, order:5 },
  ]
  if (!defaults.linkCategories) defaults.linkCategories = [
    { key:'doc',     label:'Document',    color:'#4f8ef7', active:true },
    { key:'system',  label:'System Tool', color:'#8b7adc', active:true },
    { key:'sop',     label:'SOP',         color:'#56a47a', active:true },
    { key:'others',  label:'Others',      color:'#9aa6b3', active:true },
  ]
  if (!defaults.fonnte) defaults.fonnte = {
    apiUrl: 'https://api.fonnte.com/send',
    cashierUserId: '',
    messageToCashier: '🔔 Reimbursement Baru\n\nDari: {memberName}\nKeperluan: {purpose}\nNominal: {amount}\nKategori: {category}\n\nMohon segera diproses di menu Cashier.',
    messageToMember: '✅ Reimbursement Disetujui\n\nHi {memberName}, pengajuan reimburse "{purpose}" senilai {amount} telah ditransfer ke:\n\n🏦 {bank}\n💳 {noRekening}\n\nTerima kasih.',
  }
  return defaults
}

export async function GET() {
  try {
    await connectDB()
    let cfg = await ConfigModel.findOne({}).lean() as any
    if (!cfg) {
      const created = await ConfigModel.create({})
      cfg = created.toObject()
    }

    const defaults = getSchemaDefaults()
    let needsUpdate = false
    const updates: any = {}
    // Array fields
    const arrayFields = ['attendanceTypes','budgetCategories','activityCategories','activitySubTypes','progressSubTabs','issueStatuses','meetingCategories','loginBackgrounds','roleDefs','dashboardWidgets','linkCategories']
    for (const k of arrayFields) {
      if (!cfg[k] || cfg[k].length === 0) {
        cfg[k] = defaults[k] || []
        if (defaults[k]?.length) { updates[k] = defaults[k]; needsUpdate = true }
      }
    }
    // Object fields
    if (!cfg.fonnte || !cfg.fonnte.apiUrl) {
      cfg.fonnte = defaults.fonnte
      updates.fonnte = defaults.fonnte
      needsUpdate = true
    }
    if (needsUpdate) {
      await ConfigModel.updateOne({ _id: cfg._id }, { $set: updates })
    }

    return NextResponse.json({ data: cfg })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectDB()
    const body = await req.json()
    const cfg = await ConfigModel.findOneAndUpdate({}, body, { new:true, upsert:true })
    return NextResponse.json({ data: cfg })
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
