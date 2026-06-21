import mongoose from 'mongoose'

// One checklist line item. `type` controls how it's rendered/numbered in the UI
// (bullet vs ordered-number list), independent of its checked state.
const ItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, default: '' },
  checked: { type: Boolean, default: false },
  type: { type: String, enum: ['bullet', 'number'], default: 'bullet' },
}, { _id: false })

const ReminderSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['once', 'daily'], default: 'once' },
  // mode='once'  -> datetime is an ISO string (specific date+time)
  // mode='daily' -> time is 'HH:mm', fires every day at that local time
  datetime: { type: String, default: '' },
  time: { type: String, default: '' },
  lastFiredKey: { type: String, default: '' }, // dedupe key so the cron doesn't double-send
}, { _id: false })

const QuickNoteSchema = new mongoose.Schema({
  ownerEmail: { type: String, required: true, index: true }, // creator — always retains access
  title: { type: String, default: 'Catatan' },
  items: { type: [ItemSchema], default: [] },
  reminder: { type: ReminderSchema, default: () => ({}) },
  // Collaborative share: every email here has full edit access, same as the owner.
  sharedWith: { type: [String], default: [] },
  lastEditedBy: { type: String, default: '' },
  archived: { type: Boolean, default: false },
}, { timestamps: true })

QuickNoteSchema.index({ ownerEmail: 1, archived: 1 })
QuickNoteSchema.index({ sharedWith: 1 })

export const QuickNoteModel = mongoose.models.QuickNote || mongoose.model('QuickNote', QuickNoteSchema)
