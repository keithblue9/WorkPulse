import mongoose, { Schema, models } from 'mongoose'

const ProjectSchema = new Schema({
  // Core
  title: { type: String, required: true },
  description: String, // free text / narasi / points
  category: { type: String, default: 'Others' },   // iVendor, iPRO, OnePro, ...
  subType: { type: String, default: 'Others' },    // KPI / Non-KPI / Go-Live / Anggaran / Others
  status: { type: String, default: 'on_track' },   // editable in config (issueStatuses)
  priority: { type: String, enum:['high','medium','low'], default:'medium' },
  // NEW: PIC tags (multi-member)
  pic: { type: [String], default: [] },
  picName: String, // legacy single-PIC display
  members: [String], // legacy/optional
  // NEW: Action Date (replaces startDate/endDate/progress)
  actionDate: String,
  // NEW: Progress narrative (point2 / bullet)
  progressNotes: String,
  // NEW: Next Plan narrative
  nextPlan: String,
  // NEW: Target Week
  targetWeek: String,
  // NEW: Offline/Online + location
  mode: { type: String, enum:['online','offline'], default:'online' },
  location: String,
  // For Calendar display
  startTime: String,
  endTime: String,
  // Legacy
  startDate: String, endDate: String, progress: Number, kpiId: String, color: String, tags: [String],
}, { timestamps: true })

export const ProjectModel = models.Project || mongoose.model('Project', ProjectSchema)
