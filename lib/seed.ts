import { connectDB } from '../lib/db'
import { InitiativeModel } from '../models/Initiative'
import { IssueModel } from '../models/Issue'
import { UserModel } from '../models/User'
import { ConfigModel } from '../models/Config'
import bcrypt from 'bcryptjs'

async function seed() {
  await connectDB()
  console.log('🌱 Seeding WorkPulse...')

  // Clear
  await Promise.all([
    UserModel.deleteMany({}),
    InitiativeModel.deleteMany({}),
    IssueModel.deleteMany({}),
    ConfigModel.deleteMany({}),
  ])

  // Users
  const pw = await bcrypt.hash('workpulse123', 10)
  const users = await UserModel.insertMany([
    { name: 'Mas E', email: 'mas.e@pertamina.com', password: pw, role: 'manager', division: 'BPD Proc' },
    { name: 'Rina S', email: 'rina.s@pertamina.com', password: pw, role: 'member', division: 'BPD Procurement' },
    { name: 'Budi H', email: 'budi.h@pertamina.com', password: pw, role: 'member', division: 'TnD' },
    { name: 'Dewi P', email: 'dewi.p@pertamina.com', password: pw, role: 'member', division: 'EIT' },
    { name: 'Adi K', email: 'adi.k@pertamina.com', password: pw, role: 'member', division: 'PMO' },
    { name: 'Admin', email: 'admin@pertamina.com', password: pw, role: 'admin', division: 'IT' },
  ])
  console.log(`✅ ${users.length} users created`)

  // Config
  await ConfigModel.create({})
  console.log('✅ Config created')

  // Initiatives
  const initiatives = await InitiativeModel.insertMany([
    {
      code: 'SI-001',
      title: 'Aplikasi KIMAP Integrated Management System (KIMs) Phase 2',
      description: 'Pengembangan sistem manajemen terintegrasi berbasis SAP/iVendor',
      planProgress: 50,
      actualProgress: 42,
      status: 'on_track',
      year: 2026,
      pics: ['BPD Proc', 'T&D'],
      milestones: [
        { title: 'Signed BRD v4 by Mgr TnD & Mgr BPD Proc', targetDate: '2026-05-29', actualDate: '2026-05-29', status: 'done' },
        { title: 'Business to Tech handover', targetDate: '2026-06-14', status: 'pending' },
        { title: 'Development Start', targetDate: '2026-05-01', status: 'pending' },
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
      description: 'Re-engineering sistem iPRO untuk seluruh entitas Pertamina Group',
      planProgress: 50,
      actualProgress: 42,
      status: 'on_track',
      year: 2026,
      pics: ['BPD Proc', 'TnD', 'EIT', 'PMO'],
      milestones: [
        { title: 'Assessment', targetDate: '2026-01-13', actualDate: '2026-01-13', status: 'done' },
        { title: 'Pengiriman BRD V00', targetDate: '2026-02-10', actualDate: '2026-02-10', status: 'done' },
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
      description: 'Assessment proses bisnis end-to-end Source to Pay menggunakan One Pro',
      planProgress: 50,
      actualProgress: 37,
      status: 'at_risk',
      year: 2026,
      pics: ['BPD Proc'],
      milestones: [
        { title: 'Listing & Mapping update di One Pro', targetDate: '2026-05-21', actualDate: '2026-05-21', status: 'done' },
        { title: 'Roadmap kajian [objektif, tata waktu, output]', targetDate: '2026-05-21', actualDate: '2026-05-21', status: 'done' },
        { title: 'Framework & assessment E2E Process', targetDate: '2026-09-30', status: 'pending' },
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
  console.log(`✅ ${initiatives.length} initiatives created`)

  // Issues
  const issueData = [
    {
      initiativeId: initiatives[0]._id,
      title: 'Business to Tech Handover — KIMs Phase 2',
      description: 'Serah terima dokumen BRD yang telah ditandatangani ke tim T&D untuk mulai development',
      progress: 0,
      status: 'on_track',
      nextPlan: 'Koordinasi jadwal kickoff dengan T&D',
      dueDate: '2026-06-14',
      pic: 'Budi H',
      picName: 'Budi H',
      progressHistory: [
        { date: '2026-05-29', progress: 0, note: 'BRD v4 signed, siap serah terima', updatedBy: 'Mas E' },
      ],
    },
    {
      initiativeId: initiatives[0]._id,
      title: 'Development Sprint 1 — KIMs Phase 2',
      description: 'Development modul inti sistem KIMs berdasarkan BRD yang telah disetujui',
      progress: 0,
      status: 'delayed',
      nextPlan: 'Menunggu Business to Tech handover selesai',
      dueDate: '2026-07-31',
      pic: 'Budi H',
      picName: 'Budi H',
      progressHistory: [],
    },
    {
      initiativeId: initiatives[1]._id,
      title: 'Business to Tech Handover — iPRO Re-Engineering',
      description: 'Serah terima BRD V04 iPRO ke tim T&D untuk mulai development',
      progress: 0,
      status: 'on_track',
      nextPlan: 'Business to Tech (PIC: TnD)',
      dueDate: '2026-06-14',
      pic: 'Budi H',
      picName: 'Budi H',
      progressHistory: [
        { date: '2026-05-28', progress: 0, note: 'BRD V04 signed. Ready for handover.', updatedBy: 'Mas E' },
      ],
    },
    {
      initiativeId: initiatives[2]._id,
      title: 'Current State Assessment (As-Is) — E2E Process',
      description: 'Pemetaan proses bisnis existing Source to Pay di seluruh entitas',
      progress: 72,
      status: 'at_risk',
      nextPlan: 'Framework & assessment End-to-End Process (Business practice & Consultancy)',
      dueDate: '2026-06-30',
      pic: 'Mas E',
      picName: 'Mas E',
      progressHistory: [
        { date: '2026-05-21', progress: 72, note: 'Listing & Mapping selesai di One Pro', updatedBy: 'Mas E' },
        { date: '2026-04-15', progress: 40, note: 'Identifikasi gap aplikasi as-is', updatedBy: 'Mas E' },
      ],
    },
    {
      initiativeId: initiatives[2]._id,
      title: 'Problem Statement & Gap Analysis — E2E Process',
      description: 'Analisis kesenjangan proses bisnis current state vs best practice',
      progress: 72,
      status: 'at_risk',
      nextPlan: 'Lanjutkan penyusunan framework consultancy',
      dueDate: '2026-06-30',
      pic: 'Mas E',
      picName: 'Mas E',
      progressHistory: [
        { date: '2026-05-21', progress: 72, note: 'Roadmap kajian selesai disusun', updatedBy: 'Mas E' },
      ],
    },
    {
      initiativeId: initiatives[2]._id,
      title: 'Future State Design (To-Be) — E2E Process',
      description: 'Desain proses bisnis ideal Source to Pay berdasarkan gap analysis',
      progress: 0,
      status: 'on_track',
      nextPlan: 'Mulai setelah Business practice & Consultancy framework selesai',
      dueDate: '2026-09-30',
      pic: 'Mas E',
      picName: 'Mas E',
      progressHistory: [],
    },
  ]
  const issues = await IssueModel.insertMany(issueData)
  console.log(`✅ ${issues.length} issues created`)

  console.log('\n🎉 Seed complete!')
  console.log('─────────────────────────────────────')
  console.log('Login credentials:')
  console.log('  Manager : mas.e@pertamina.com / workpulse123')
  console.log('  Admin   : admin@pertamina.com / workpulse123')
  console.log('  Member  : rina.s@pertamina.com / workpulse123')
  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
