import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import { UserModel } from '@/models/User'
import { ConfigModel } from '@/models/Config'
import { InitiativeModel } from '@/models/Initiative'

export async function POST() {
  try {
    await connectDB()
    // Default PIN: 123456
    const defaultPin = await bcrypt.hash('123456', 10)

    const users = [
      { name:'Mas E',  email:'mas.e@workpulse.com',  password:defaultPin, role:'manager', division:'BPD Procurement', active:true, noPekerja:'BPD-001', jabatan:'Manager' },
      { name:'Admin',  email:'admin@workpulse.com',  password:defaultPin, role:'admin',   division:'IT', active:true, jabatan:'IT Admin' },
      { name:'Rina S', email:'rina.s@workpulse.com', password:defaultPin, role:'member',  division:'SS Procurement', active:true, jabatan:'Senior Analyst' },
      { name:'Budi H', email:'budi.h@workpulse.com', password:defaultPin, role:'member',  division:'TnD', active:true },
      { name:'Dewi P', email:'dewi.p@workpulse.com', password:defaultPin, role:'member',  division:'EIT', active:true },
      { name:'Adi K',  email:'adi.k@workpulse.com',  password:defaultPin, role:'member',  division:'PMO', active:true },
      { name:'Finance',email:'finance@workpulse.com',password:defaultPin, role:'finance', division:'Finance', active:true },
    ]
    for (const u of users) {
      await UserModel.findOneAndUpdate({ email:u.email }, u, { upsert:true })
    }

    const existingCfg = await ConfigModel.findOne({})
    if (!existingCfg) await ConfigModel.create({ appName:'WorkPulse', appTagline:'BPD & SS Procurement', appColor:'#4f8ef7', activeYear:2026 })

    const initCount = await InitiativeModel.countDocuments({})
    if (initCount === 0) {
      await InitiativeModel.insertMany([
        { code:'SI-001', title:'OnePro Phase 3 — PAL & KIMs', planProgress:50, actualProgress:42, status:'on_track', year:2026, phases:[
          { name:'Assessment Business Process & Tech', planPct:100, actualPct:100, planStartMonth:1, planEndMonth:2, actualStartMonth:1, actualEndMonth:2 },
          { name:'Analysis & Design', planPct:100, actualPct:75, planStartMonth:2, planEndMonth:4, actualStartMonth:2, actualEndMonth:4 },
          { name:'Development Sprint 1-3', planPct:0, actualPct:0, planStartMonth:4, planEndMonth:9 },
          { name:'UAT & Go Live', planPct:0, actualPct:0, planStartMonth:10, planEndMonth:12 },
        ]},
        { code:'SI-002', title:'Re-Engineering iPro untuk Pertamina Group', planProgress:50, actualProgress:42, status:'on_track', year:2026, phases:[
          { name:'Assessment', planPct:100, actualPct:100, planStartMonth:1, planEndMonth:2 },
          { name:'Analysis & Design', planPct:100, actualPct:80, planStartMonth:2, planEndMonth:4 },
          { name:'Development', planPct:0, actualPct:0, planStartMonth:5, planEndMonth:9 },
          { name:'UAT', planPct:0, actualPct:0, planStartMonth:10, planEndMonth:11 },
        ]},
        { code:'SI-003', title:'E2E Process Source-to-Pay Assessment', planProgress:50, actualProgress:37, status:'at_risk', year:2026, phases:[
          { name:'As-Is Assessment', planPct:100, actualPct:72, planStartMonth:1, planEndMonth:3 },
          { name:'Problem Statement & Gap Analysis', planPct:100, actualPct:60, planStartMonth:3, planEndMonth:5 },
          { name:'To-Be Design', planPct:0, actualPct:0, planStartMonth:5, planEndMonth:9 },
          { name:'Final Recommendations', planPct:0, actualPct:0, planStartMonth:10, planEndMonth:12 },
        ]},
      ])
    }

    return NextResponse.json({ success:true, message:'Seeded. Default PIN for all users: 123456' })
  } catch (e:any) { return NextResponse.json({ error:e.message }, { status:500 }) }
}

export async function GET() { return POST() }
