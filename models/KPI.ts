import mongoose, { Schema, models } from 'mongoose'

// KPI Target → SI / Non-SI → Milestones
const KPIItemSchema = new Schema({
  title: { type: String, required: true },
  category: { type: String, enum: ['SI', 'Non-SI', 'Others', 'GoLive'], default: 'SI' },
  projectName: String,       // e.g. "OnePro PAL", "iVendor VM 3.0"
  pic: [String],
  weight: { type: Number, default: 0 },   // bobot dalam % (0-1)
  planPct: { type: Number, default: 0 },
  actualPct: { type: Number, default: 0 },
  status: { type: String, enum: ['on_track','at_risk','delayed','completed'], default: 'on_track' },
  year: { type: Number, default: 2026 },
  phases: [{
    name: String,
    planPct: Number,
    actualPct: Number,
    planStartWeek: Number,
    planEndWeek: Number,
    actualStartWeek: Number,
    actualEndWeek: Number,
    status: { type: String, enum: ['not_started','in_progress','completed','delayed'], default: 'not_started' },
  }],
}, { timestamps: true })

export const KPIModel = models.KPI || mongoose.model('KPI', KPIItemSchema)
