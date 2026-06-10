import mongoose, { Schema, models } from 'mongoose'

const AttendanceTypeSchema = new Schema({
  key: String, label: String, color: String, textColor: String, icon: String, active: { type: Boolean, default: true },
}, { _id: false })

const BudgetCategorySchema = new Schema({
  key: String, label: String, annualBudget: { type: Number, default: 0 }, pic: String,
  threshold: { type: Number, default: 80 }, // % threshold for alert
}, { _id: false })

const ConfigSchema = new Schema({
  // App branding
  appName: { type: String, default: 'WorkPulse' },
  appTagline: { type: String, default: 'BPD & SS Procurement' },
  appIcon: { type: String, default: '' }, // base64 or URL
  appFavicon: { type: String, default: '' },
  appColor: { type: String, default: '#4f8ef7' }, // primary color

  // Period
  activeYear: { type: Number, default: 2026 },
  midYearMonth: { type: Number, default: 6 },
  midYearTarget: { type: Number, default: 50 },
  yearEndTarget: { type: Number, default: 100 },

  // Attendance
  attendanceTypes: {
    type: [AttendanceTypeSchema],
    default: [
      { key: 'wfo', label: 'WFO', color: '#1a2d4a', textColor: '#4f8ef7', active: true },
      { key: 'wfh', label: 'WFH', color: '#1e1630', textColor: '#a78bfa', active: true },
      { key: 'dinas', label: 'Dinas Luar', color: '#2a1f0a', textColor: '#f59e0b', active: true },
      { key: 'cuti', label: 'Cuti', color: '#142a1e', textColor: '#22c55e', active: true },
      { key: 'sakit', label: 'Sakit', color: '#2a1010', textColor: '#ef4444', active: true },
      { key: 'izin', label: 'Izin', color: '#1a1a2a', textColor: '#9da3b8', active: true },
      { key: 'wfa', label: 'WFA', color: '#1a1a2e', textColor: '#818cf8', active: true },
    ],
  },

  // Budget
  budgetCategories: {
    type: [BudgetCategorySchema],
    default: [
      { key: 'dinas_travel', label: 'Dinas & Travel', annualBudget: 0, pic: '', threshold: 80 },
      { key: 'accommodation', label: 'External Accommodation', annualBudget: 0, pic: '', threshold: 80 },
    ],
  },

  // Notifications
  notifications: {
    waEnabled: { type: Boolean, default: true },
    waDueDateReminder: { type: Boolean, default: true },
    waWeeklyDigest: { type: Boolean, default: false },
    digestDayOfWeek: { type: Number, default: 5 },
    digestHour: { type: Number, default: 17 },
  },

  // Roles
  roles: {
    managerCanEditAll: { type: Boolean, default: true },
    memberSeeOwnOnly: { type: Boolean, default: false },
    guestViewEnabled: { type: Boolean, default: false },
  },
}, { timestamps: true })

export const ConfigModel = models.Config || mongoose.model('Config', ConfigSchema)
