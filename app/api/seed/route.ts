import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import { InitiativeModel } from '@/models/Initiative'
import { IssueModel } from '@/models/Issue'
import { ConfigModel } from '@/models/Config'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    await connectDB()

    const existing = await UserModel.countDocuments()
    if (existing > 0) {
      return NextResponse.json({ message: 'Already seeded', users: existing })
    }

    await Promise.all([
      UserModel.deleteMany({}),
      InitiativeModel.deleteMany({}),
      IssueModel.deleteMany({}),
      ConfigModel.deleteMany({}),
    ])

    const pw = await bcrypt.hash('workpulse123', 10)
    await UserModel.insertMany([
      { name: 'Mas E', email: 'mas.e@pertamina.com', password: pw, role: 'manager', division: 'BPD Proc' },
      { name: 'Rina S', email: 'rina.s@pertamina.com', password: pw, role: 'member', division: 'SS Proc' },
      { name: 'Budi H', email: 'budi.h@pertamina.com', password: pw, role: 'member', division: 'TnD' },
      { name: 'Dewi P', email: 'dewi.p@pertamina.com', password: pw, role: 'member', division: 'EIT' },
      { name: 'Adi K', email: 'adi.k@pertamina.com', password: pw, role: 'member', division: 'PMO' },
      { name: 'Admin', email: 'admin@pertamina.com', password: pw, role: 'admin', division: 'IT' },
    ])

    await ConfigModel.create({})

    const initiatives = await InitiativeModel.insertMany([
      {
        code: 'SI-001',
        title: 'Aplikasi KIMAP Integrated Management System (KIMs) Phase 2',
        planProgress: 50, actualProgress: 42, status: 'on_track', year: 2026,
        pics: ['BPD Proc', 'SS Proc', 'T&D'],
        milestones: [
          { title: 'Signed BRD v4 by Mgr TnD & Mgr BPD Proc', targetDate: '2026-05-29', actualDate: '2026-05-29', status: 'done' },
          { title: 'Business to Tech handover', targetDate: '2026-06-14', status: 'pending' },
          { title: 'UAT Complete', targetDate: '2026-09-30', status: 'pending' },
          { title: 'Go Live', targetDate: '2026-11-30', status: 'pending' },
        ],
        phases: [
          { name: 'Assessment Business Process & Technology', planPct: 17, actualPct: 17, planStartMonth: 1, planEndMonth: 2, actualStartMonth: 1, actualEndMonth: 2, status: 'completed' },
          { name: 'Analysis & Design', planPct: 25, actualPct: 25, planStartMonth: 2, planEndMonth: 5, actualStartMonth: 2, actualEndMonth: 5, status: 'completed' },
          { name: 'Development', planPct: 42, actualPct: 0, planStartMonth: 5, planEndMonth: 9, status: 'delayed' },
          { name: 'UAT', planPct: 8, actualPct: 0, planStartMonth: 8, planEndMonth: 10, status: 'not_started' },
          { name: 'Go Live', planPct: 4, actualPct: 0, planStartMonth: 10, planEndMonth: 12, status: 'not_started' },
          { name: 'Stabilisasi', planPct: 4, actualPct: 0, planStartMonth: 11, planEndMonth: 12, status: 'not_started' },
        ],
      },
      {
        code: 'SI-002',
        title: 'Re-Engineering iPro untuk entitas Pertamina Group',
        planProgress: 50, actualProgress: 42, status: 'on_track', year: 2026,
        pics: ['BPD Proc', 'TnD', 'SS Proc', 'EIT', 'PMO'],
        milestones: [
          { title: 'Signed BRD V04 by Mgr TnD & Mgr BPD Proc', targetDate: '2026-05-28', actualDate: '2026-05-28', status: 'done' },
          { title: 'Business to Tech handover', targetDate: '2026-06-14', status: 'pending' },
          { title: 'Development Complete', targetDate: '2026-09-30', status: 'pending' },
        ],
        phases: [
          { name: 'Assessment Business Process & Technology', planPct: 8, actualPct: 8, planStartMonth: 1, planEndMonth: 1, actualStartMonth: 1, actualEndMonth: 1, status: 'completed' },
          { name: 'Analysis & Design', planPct: 33, actualPct: 33, planStartMonth: 1, planEndMonth: 5, actualStartMonth: 1, actualEndMonth: 5, status: 'completed' },
          { name: 'Development', planPct: 33, actualPct: 0, planStartMonth: 4, planEndMonth: 8, status: 'delayed' },
          { name: 'UAT', planPct: 8, actualPct: 0, planStartMonth: 7, planEndMonth: 9, status: 'not_started' },
          { name: 'Go Live', planPct: 8, actualPct: 0, planStartMonth: 9, planEndMonth: 11, status: 'not_started' },
          { name: 'Stabilisasi', planPct: 8, actualPct: 0, planStartMonth: 10, planEndMonth: 12, status: 'not_started' },
        ],
      },
      {
        code: 'SI-003',
        title: 'Assessment End to End Process Bisnis Source to Pay',
        planProgress: 50, actualProgress: 37, status: 'at_risk', year: 2026,
        pics: ['BPD Proc'],
        milestones: [
          { title: 'Listing & Mapping update di One Pro', targetDate: '2026-05-21', actualDate: '2026-05-21', status: 'done' },
          { title: 'Framework E2E Process Assessment', targetDate: '2026-09-30', status: 'pending' },
          { title: 'Final Recommendations', targetDate: '2026-11-30', status: 'pending' },
        ],
        phases: [
          { name: 'Current State Assessment (As-Is)', planPct: 25, actualPct: 18, planStartMonth: 4, planEndMonth: 6, actualStartMonth: 4, actualEndMonth: 6, status: 'in_progress' },
          { name: 'Problem Statement & Gap Analysis', planPct: 25, actualPct: 18, planStartMonth: 4, planEndMonth: 6, actualStartMonth: 4, actualEndMonth: 6, status: 'in_progress' },
          { name: 'Future State Design (To-Be)', planPct: 33, actualPct: 0, planStartMonth: 6, planEndMonth: 9, status: 'not_started' },
          { name: 'Final Recommendations', planPct: 17, actualPct: 0, planStartMonth: 9, planEndMonth: 12, status: 'not_started' },
        ],
      },
    ])

    await IssueModel.insertMany([
      { initiativeId: initiatives[0]._id, title: 'Business to Tech Handover — KIMs Phase 2', progress: 0, status: 'on_track', nextPlan: 'Koordinasi jadwal kickoff dengan T&D', dueDate: '2026-06-14', pic: 'budi-h', picName: 'Budi H', progressHistory: [{ date: '2026-05-29', progress: 0, note: 'BRD v4 signed', updatedBy: 'Mas E' }] },
      { initiativeId: initiatives[0]._id, title: 'Development Sprint 1 — KIMs Phase 2', progress: 0, status: 'delayed', nextPlan: 'Menunggu Business to Tech handover', dueDate: '2026-07-31', pic: 'budi-h', picName: 'Budi H', progressHistory: [] },
      { initiativeId: initiatives[1]._id, title: 'Business to Tech Handover — iPRO Re-Engineering', progress: 0, status: 'on_track', nextPlan: 'Business to Tech (PIC: TnD)', dueDate: '2026-06-14', pic: 'budi-h', picName: 'Budi H', progressHistory: [{ date: '2026-05-28', progress: 0, note: 'BRD V04 signed', updatedBy: 'Mas E' }] },
      { initiativeId: initiatives[2]._id, title: 'Current State Assessment (As-Is)', progress: 72, status: 'at_risk', nextPlan: 'Framework & assessment E2E Process', dueDate: '2026-06-30', pic: 'mas-e', picName: 'Mas E', progressHistory: [{ date: '2026-05-21', progress: 72, note: 'Listing & Mapping selesai', updatedBy: 'Mas E' }] },
      { initiativeId: initiatives[2]._id, title: 'Problem Statement & Gap Analysis', progress: 72, status: 'at_risk', nextPlan: 'Lanjutkan framework consultancy', dueDate: '2026-06-30', pic: 'mas-e', picName: 'Mas E', progressHistory: [{ date: '2026-05-21', progress: 72, note: 'Roadmap kajian selesai', updatedBy: 'Mas E' }] },
      { initiativeId: initiatives[2]._id, title: 'Future State Design (To-Be)', progress: 0, status: 'on_track', nextPlan: 'Mulai setelah framework selesai', dueDate: '2026-09-30', pic: 'mas-e', picName: 'Mas E', progressHistory: [] },
    ])

    return NextResponse.json({ 
      success: true, 
      message: '🎉 Database seeded successfully!',
      data: { users: 6, initiatives: 3, issues: 6 }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
