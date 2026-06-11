import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { InitiativeModel } from '@/models/Initiative'
import { IssueModel } from '@/models/Issue'
import { KPIModel } from '@/models/KPI'
import { ProjectModel } from '@/models/Project'
import { DailyAgendaModel } from '@/models/DailyAgenda'
import { BudgetModel } from '@/models/Budget'
import { AnnouncementModel } from '@/models/Announcement'
import { ReimbursementModel } from '@/models/Reimbursement'
import { LinkHubModel } from '@/models/LinkHub'
import { AttendanceModel } from '@/models/Attendance'

export async function POST(req: NextRequest) {
  try {
    await connectDB()
    const { confirm, scope } = await req.json()
    if (confirm !== 'RESET') return NextResponse.json({ error:'Konfirmasi salah' }, { status:400 })

    const results: Record<string, number> = {}
    const all = scope === 'all'

    if (all || scope?.includes('initiatives')) { const r = await InitiativeModel.deleteMany({}); results.initiatives = r.deletedCount }
    if (all || scope?.includes('issues')) { const r = await IssueModel.deleteMany({}); results.issues = r.deletedCount }
    if (all || scope?.includes('kpi')) { const r = await KPIModel.deleteMany({}); results.kpi = r.deletedCount }
    if (all || scope?.includes('activities')) { const r = await ProjectModel.deleteMany({}); results.activities = r.deletedCount }
    if (all || scope?.includes('agenda')) { const r = await DailyAgendaModel.deleteMany({}); results.agenda = r.deletedCount }
    if (all || scope?.includes('budget')) { const r = await BudgetModel.deleteMany({}); results.budget = r.deletedCount }
    if (all || scope?.includes('announcements')) { const r = await AnnouncementModel.deleteMany({}); results.announcements = r.deletedCount }
    if (all || scope?.includes('reimbursements')) { const r = await ReimbursementModel.deleteMany({}); results.reimbursements = r.deletedCount }
    if (all || scope?.includes('links')) { const r = await LinkHubModel.deleteMany({}); results.links = r.deletedCount }
    if (all || scope?.includes('attendance')) { const r = await AttendanceModel.deleteMany({}); results.attendance = r.deletedCount }

    return NextResponse.json({ success:true, results })
  } catch (e: any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}
