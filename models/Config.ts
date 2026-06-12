import mongoose, { Schema, models } from 'mongoose'

const AttendanceTypeSchema = new Schema({
  key:String, label:String, color:String, textColor:String, icon:String, active:{ type:Boolean, default:true },
}, { _id:false })

const BudgetCategorySchema = new Schema({
  key:String, label:String, annualBudget:{ type:Number, default:0 }, pic:String, threshold:{ type:Number, default:80 },
}, { _id:false })

const TaxonomyItemSchema = new Schema({
  key:String, label:String, color:String, active:{ type:Boolean, default:true },
}, { _id:false })

const ConfigSchema = new Schema({
  appName: { type:String, default:'WorkPulse' },
  appTagline: { type:String, default:'BPD & SS Procurement' },
  appIcon: { type:String, default:'' },
  appColor: { type:String, default:'#4f8ef7' },

  loginTagline: { type:String, default:'BPD & SS Procurement — Pertamina' },
  loginBackgrounds: { type:[String], default:[] },
  loginSlideInterval: { type:Number, default:5000 },
  loginBgMaxSize: { type:Number, default:5 }, // MB

  pwaInstallEnabled: { type:Boolean, default:true },
  pwaPromptDelay: { type:Number, default:8000 },
  pwaPromptCooldown: { type:Number, default:7 },

  activeYear: { type:Number, default:2026 },
  midYearMonth: { type:Number, default:6 },
  midYearTarget: { type:Number, default:50 },
  yearEndTarget: { type:Number, default:100 },

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

  budgetCategories: {
    type: [BudgetCategorySchema],
    default: [
      { key:'cash_card', label:'Cash Card', annualBudget:0, pic:'', threshold:80 },
      { key:'petty_cash', label:'Petty Cash', annualBudget:0, pic:'', threshold:80 },
      { key:'dinas_travel', label:'Dinas & Travel', annualBudget:0, pic:'', threshold:80 },
      { key:'accommodation', label:'External Accommodation', annualBudget:0, pic:'', threshold:80 },
    ],
  },

  // Activity hierarchy
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

  notifications: {
    waEnabled: { type:Boolean, default:true },
    waDueDateReminder: { type:Boolean, default:true },
    waWeeklyDigest: { type:Boolean, default:false },
    digestDayOfWeek: { type:Number, default:5 },
    digestHour: { type:Number, default:17 },
  },
  roles: {
    managerCanEditAll: { type:Boolean, default:true },
    memberSeeOwnOnly: { type:Boolean, default:false },
    guestViewEnabled: { type:Boolean, default:false },
  },
}, { timestamps:true })

export const ConfigModel = models.Config || mongoose.model('Config', ConfigSchema)
