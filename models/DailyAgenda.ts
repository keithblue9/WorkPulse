import mongoose, { Schema, models } from 'mongoose'

const AgendaItemSchema = new Schema({
  time: String,         // "08:00" or "fullday"
  endTime: String,      // "10:00"
  title: { type: String, required: true },
  description: String,
  type: { type: String, enum: ['meeting','task','dinas','wfo','wfh','event','other'], default: 'task' },
  location: String,     // online / venue name
  attendees: [String],
  priority: { type: String, enum: ['high','medium','low'], default: 'medium' },
  status: { type: String, enum: ['planned','done','cancelled'], default: 'planned' },
  isRecurring: { type: Boolean, default: false },
  projectId: String,
  issueId: String,
}, { _id: true })

const DailyAgendaSchema = new Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },    // "YYYY-MM-DD"
  items: [AgendaItemSchema],
  dayNote: String,
}, { timestamps: true })

DailyAgendaSchema.index({ userId: 1, date: 1 }, { unique: true })

export const DailyAgendaModel = models.DailyAgenda || mongoose.model('DailyAgenda', DailyAgendaSchema)
