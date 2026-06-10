import mongoose, { Schema, models } from 'mongoose'

const MilestoneSchema = new Schema({
  title: String,
  targetDate: String,
  actualDate: String,
  status: { type: String, enum: ['pending', 'done', 'delayed'], default: 'pending' },
})

const PhaseSchema = new Schema({
  name: String,
  planPct: { type: Number, default: 0 },
  actualPct: { type: Number, default: 0 },
  planStartMonth: Number,
  planEndMonth: Number,
  actualStartMonth: Number,
  actualEndMonth: Number,
  status: { type: String, enum: ['not_started', 'in_progress', 'completed', 'delayed'], default: 'not_started' },
})

const InitiativeSchema = new Schema({
  code: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  planProgress: { type: Number, default: 0 },
  actualProgress: { type: Number, default: 0 },
  status: { type: String, enum: ['on_track', 'at_risk', 'delayed', 'completed'], default: 'on_track' },
  milestones: [MilestoneSchema],
  phases: [PhaseSchema],
  pics: [{ type: String }],
  year: { type: Number, default: new Date().getFullYear() },
}, { timestamps: true })

export const InitiativeModel = models.Initiative || mongoose.model('Initiative', InitiativeSchema)
