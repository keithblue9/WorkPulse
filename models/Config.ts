import mongoose, { Schema, models } from 'mongoose'

const AttendanceTypeSchema = new Schema({
  key: String,
  label: String,
  color: String,
  textColor: String,
  icon: String,
  active: { type: Boolean, default: true },
}, { _id: false })

const ConfigSchema = new Schema({
  activeYear: { type: Number, default: 2026 },
  midYearMonth: { type: Number, default: 6 },
  midYearTarget: { type: Number, default: 50 },
  yearEndTarget: { type: Number, default: 100 },
  attendanceTypes: {
    type: [AttendanceTypeSchema],
    default: [
      { key: 'wfo', label: 'WFO', color: '#1a2d4a', textColor: '#4f8ef7', active: true },
      { key: 'wfh', label: 'WFH', color: '#1e1630', textColor: '#a78bfa', active: true },
      { key: 'dinas', label: 'Dinas Luar', color: '#2a1f0a', textColor: '#f59e0b', active: true },
      { key: 'cuti', label: 'Cuti', color: '#142a1e', textColor: '#22c55e', active: true },
      { key: 'sakit', label: 'Sakit', color: '#2a1010', textColor: '#ef4444', active: true },
      { key: 'izin', label: 'Izin', color: '#1a1a2a', textColor: '#9da3b8', active: true },
    ],
  },
  notifications: {
    waEnabled: { type: Boolean, default: true },
    waDueDateReminder: { type: Boolean, default: true },
    waWeeklyDigest: { type: Boolean, default: false },
    digestDayOfWeek: { type: Number, default: 5 },
    digestHour: { type: Number, default: 17 },
  },
  roles: {
    managerCanEditAll: { type: Boolean, default: true },
    memberSeeOwnOnly: { type: Boolean, default: false },
    guestViewEnabled: { type: Boolean, default: false },
  },
}, { timestamps: true })

export const ConfigModel = models.Config || mongoose.model('Config', ConfigSchema)
