import mongoose, { Schema, models } from 'mongoose'

const TaxonomyItemSchema = new Schema({ key:String, label:String, color:String, active:{ type:Boolean, default:true } }, { _id:false })
const BudgetCategorySchema = new Schema({ key:String, label:String, annualBudget:{ type:Number, default:0 }, annualBudgetUSD:{ type:Number, default:0 }, pic:String, threshold:{ type:Number, default:80 } }, { _id:false })
const AttendanceTypeSchema = new Schema({ key:String, label:String, color:String, textColor:String, icon:String, active:{ type:Boolean, default:true } }, { _id:false })

// NEW: role with menu permissions
const RoleSchema = new Schema({
  key: String,             // 'admin' | 'manager' | 'member' | 'finance' | 'cashier' | 'ccholder' | 'guest' | custom
  label: String,
  builtin: { type: Boolean, default: false },
  allowedMenus: { type: [String], default: [] }, // ['dashboard','activities','calendar','issues',...]
  description: String,
}, { _id:false })

// Dashboard widget toggle
const DashboardWidgetSchema = new Schema({
  key: String,            // 'stat-kpi','stat-nonkpi','stat-golive','stat-anggaran','stat-others','stat-highpriority','progress-chart','quotes','ai-insight-team','ai-insight-personal','top-contributors','agenda','issue-distribution','member-count'
  label: String,
  segment: { type:String, default:'main' }, // segment grouping (main/secondary)
  active: { type: Boolean, default: true },        // visibilitas utk internal
  activeGuest: { type: Boolean, default: true },   // visibilitas utk guest/eksternal
  order: { type: Number, default: 0 },
  size: { type: String, enum: ['full', 'half'], default: 'full' },        // ukuran utk internal
  sizeGuest: { type: String, enum: ['full', 'half'], default: 'full' },   // ukuran utk guest
}, { _id:false })

const ConfigSchema = new Schema({
  appName: { type:String, default:'WorkPulse' },
  appTagline: { type:String, default:'BPD Procurement' },
  appIcon: { type:String, default:'' },
  appColor: { type:String, default:'#4f8ef7' },

  loginTagline: { type:String, default:'BPD Procurement — Pertamina' },
  loginBackgrounds: { type:[String], default:[] },
  loginSlideInterval: { type:Number, default:5000 },
  loginBgMaxSize: { type:Number, default:5 },

  pwaInstallEnabled: { type:Boolean, default:true },
  pwaPromptDelay: { type:Number, default:8000 },
  pwaPromptCooldown: { type:Number, default:7 },

  activeYear: { type:Number, default:2026 },

  attendanceTypes: {
    type: [AttendanceTypeSchema],
    default: [
      { key:'wfo', label:'WFO', textColor:'#4f8ef7', color:'#1a2d4a', active:true },
      { key:'wfh', label:'WFH', textColor:'#8b7adc', color:'#1e1630', active:true },
      { key:'dinas', label:'Dinas Luar', textColor:'#c9954d', color:'#2a1f0a', active:true },
      { key:'cuti', label:'Cuti', textColor:'#56a47a', color:'#142a1e', active:true },
      { key:'sakit', label:'Sakit', textColor:'#d65f5f', color:'#2a1010', active:true },
      { key:'izin', label:'Izin', textColor:'#9aa6b3', color:'#1a1a2a', active:true },
    ],
  },

  // BUDGET: removed Cash Card / Petty Cash (slide 14), kept Travel & External Accommodation
  budgetCategories: {
    type: [BudgetCategorySchema],
    default: [
      { key:'travel', label:'Dinas & Travel', annualBudget:0, annualBudgetUSD:0, pic:'', threshold:80 },
      { key:'accommodation', label:'External Accommodation', annualBudget:0, annualBudgetUSD:0, pic:'', threshold:80 },
    ],
  },
  budgetThresholdTotal: { type:Number, default:80 },

  activityCategories: {
    type: [TaxonomyItemSchema],
    default: [
      { key:'iVendor', label:'iVendor', color:'#4f8ef7', active:true },
      { key:'iPRO',    label:'iPRO',    color:'#8b7adc', active:true },
      { key:'OnePro',  label:'OnePro',  color:'#56a47a', active:true },
      { key:'PAL',     label:'PAL',     color:'#c9954d', active:true },
      { key:'KIMS',    label:'KIMS',    color:'#5fb3ad', active:true },
      { key:'Others',  label:'Others',  color:'#9aa6b3', active:true },
    ],
  },
  activitySubTypes: {
    type: [TaxonomyItemSchema],
    default: [
      { key:'KPI',     label:'KPI',      color:'#4f8ef7', active:true },
      { key:'Non-KPI', label:'Non KPI',  color:'#8b7adc', active:true },
      { key:'Go-Live', label:'Go Live',  color:'#56a47a', active:true },
      { key:'Others',  label:'Others',   color:'#9aa6b3', active:true },
      { key:'Anggaran',label:'Anggaran', color:'#c9954d', active:true },
    ],
  },
  progressSubTabs: {
    type: [TaxonomyItemSchema],
    default: [
      { key:'KPI',     label:'KPI',      color:'#4f8ef7', active:true },
      { key:'Non-KPI', label:'Non KPI',  color:'#8b7adc', active:true },
      { key:'Go-Live', label:'Go Live',  color:'#56a47a', active:true },
      { key:'Others',  label:'Others',   color:'#9aa6b3', active:true },
      { key:'Anggaran',label:'Anggaran', color:'#c9954d', active:true },
    ],
  },
  issueStatuses: {
    type: [TaxonomyItemSchema],
    default: [
      { key:'on_track',  label:'On Track',  color:'#56a47a', active:true },
      { key:'at_risk',   label:'At Risk',   color:'#c9954d', active:true },
      { key:'delayed',   label:'Delayed',   color:'#d65f5f', active:true },
      { key:'completed', label:'Completed', color:'#4f8ef7', active:true },
    ],
  },
  meetingCategories: {
    type: [TaxonomyItemSchema],
    default: [
      { key:'weekly',  label:'Weekly Meeting',     color:'#4f8ef7', active:true },
      { key:'project', label:'Project Discussion', color:'#8b7adc', active:true },
      { key:'1on1',    label:'1-on-1',             color:'#56a47a', active:true },
      { key:'workshop',label:'Workshop',           color:'#c9954d', active:true },
      { key:'external',label:'External',           color:'#d65f5f', active:true },
      { key:'general', label:'General',            color:'#9aa6b3', active:true },
    ],
  },

  // NEW: Link Hub categories editable
  linkCategories: {
    type: [TaxonomyItemSchema],
    default: [
      { key:'doc',     label:'Document',      color:'#4f8ef7', active:true },
      { key:'system',  label:'System Tool',   color:'#8b7adc', active:true },
      { key:'sop',     label:'SOP',           color:'#56a47a', active:true },
      { key:'others',  label:'Others',        color:'#9aa6b3', active:true },
    ],
  },

  // NEW: Roles with menu permissions
  roleDefs: {
    type: [RoleSchema],
    default: [
      { key:'admin',    label:'Admin',     builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','settlementcc','members','config'] },
      { key:'manager',  label:'Manager',   builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','budget','reimbursement','cashcard','cashier','members'] },
      { key:'member',   label:'Member',    builtin:true,  allowedMenus:['dashboard','activities','calendar','issues','progress','attendance','biodata','links','meetings','notes','reimbursement'] },
      { key:'finance',  label:'Finance',   builtin:true,  allowedMenus:['dashboard','attendance','biodata','links','budget','reimbursement','cashcard','cashier'] },
      { key:'cashier',  label:'Cashier',   builtin:true,  allowedMenus:['dashboard','reimbursement','cashier','cashcard','biodata'] },
      { key:'ccholder', label:'CC Holder', builtin:true,  allowedMenus:['dashboard','reimbursement','cashcard','settlementcc'] },
      { key:'guest',    label:'Guest',     builtin:true,  allowedMenus:['dashboard','links'] },
    ],
  },

  // NEW: Dashboard widgets toggle
  dashboardWidgets: {
    type: [DashboardWidgetSchema],
    default: [
      { key:'stat-kpi',           label:'Stat: KPI',            segment:'stats', active:true,  order:1 },
      { key:'stat-nonkpi',        label:'Stat: Non KPI',        segment:'stats', active:true,  order:2 },
      { key:'stat-golive',        label:'Stat: Go Live',        segment:'stats', active:true,  order:3 },
      { key:'stat-anggaran',      label:'Stat: Anggaran',       segment:'stats', active:true,  order:4 },
      { key:'stat-others',        label:'Stat: Others',         segment:'stats', active:true,  order:5 },
      { key:'stat-highpriority',  label:'Stat: High Priority',  segment:'stats', active:true,  order:6 },
      { key:'progress-chart',     label:'Chart Progress Project (donut)', segment:'main',  active:true, order:1 },
      { key:'ai-quotes',          label:'AI Quotes (daily)',    segment:'ai',    active:true,  order:1 },
      { key:'ai-insight-personal',label:'AI Insight Personal',  segment:'ai',    active:true,  order:2 },
      { key:'ai-insight-team',    label:'AI Insight Team',      segment:'ai',    active:true,  order:3 },
      { key:'top-contributors',   label:'Top Contributors',     segment:'main',  active:true,  order:2 },
      { key:'upcoming-agenda',    label:'Agenda Mendatang',     segment:'main',  active:true,  order:3 },
      { key:'issue-distribution', label:'Issue Distribution',   segment:'main',  active:true,  order:4 },
      { key:'member-count',       label:'Member Count Card',    segment:'main',  active:false, order:5 },
    ],
  },

  // NEW: WhatsApp/Fonnte templates
  fonnte: {
    apiUrl: { type:String, default:'https://api.fonnte.com/send' },
    cashierUserId: String, // userId who acts as cashier (gets pesan saat ada reimburse)
    messageToCashier: { type:String, default:'🔔 Reimbursement Baru\n\nDari: {memberName}\nKeperluan: {purpose}\nNominal: {amount}\nKategori: {category}\n\nMohon segera diproses di menu Cashier.' },
    messageToMember: { type:String, default:'✅ Reimbursement Disetujui\n\nHi {memberName}, pengajuan reimburse "{purpose}" senilai {amount} telah ditransfer ke:\n\n🏦 {bank}\n💳 {noRekening}\n\nTerima kasih.' },
  },

  notifications: {
    waEnabled: { type:Boolean, default:true },
    waDueDateReminder: { type:Boolean, default:true },
    waWeeklyDigest: { type:Boolean, default:false },
  },

  // Push notification flow reimbursement (member pengaju + cashier)
  reimburseNotif: {
    enabled: { type:Boolean, default:true },        // master switch
    notifySubmit: { type:Boolean, default:true },   // saat member submit -> pengaju + cashier
    notifyTransfer: { type:Boolean, default:true }, // saat cashier transfer -> pengaju + cashier
  },

  // Guard: tanggal terakhir broadcast pengingat harian (absen + agenda) dikirim — biar 1x/hari
  lastDailyBroadcast: { type:String, default:'' },
}, { timestamps:true })

export const ConfigModel = models.Config || mongoose.model('Config', ConfigSchema)
