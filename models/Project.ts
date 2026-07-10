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
  actionDate: String,       // start date (or single day)
  actionDateEnd: String,    // optional end date for multi-day activities
  recurrence: String,       // '', 'weekly', 'biweekly', 'monthly'
  recurrenceGroupId: String, // links generated recurring instances together
  showInList: { type: Boolean, default: true }, // false = sembunyi dari list Activities (tetap muncul di Calendar)
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
  // Hide from dashboard Issues view (Status Distribution / High Priority / Detail all respect this)
  hidden: { type: Boolean, default: false },
}, { timestamps: true })

ProjectSchema.index({ subType: 1 })
ProjectSchema.index({ category: 1 })
ProjectSchema.index({ actionDate: 1 })
ProjectSchema.index({ priority: 1 })

export const ProjectModel = models.Project || mongoose.model('Project', ProjectSchema)
