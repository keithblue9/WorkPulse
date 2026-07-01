import mongoose from 'mongoose'

// One content line. `kind`: 'text' = paragraf biasa (bukan to-do), 'bullet'/'number' = checklist item.
const ItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  text: { type: String, default: '' },
  checked: { type: Boolean, default: false },
  type: { type: String, enum: ['bullet', 'number', 'text'], default: 'bullet' },
}, { _id: false })

const ReminderSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  mode: { type: String, enum: ['once', 'daily', 'weekly', 'biweekly', 'monthly'], default: 'once' },
  // mode='once'  -> datetime is an ISO string (specific date+time)
  // recurring    -> time 'HH:mm'. weekly/biweekly pakai weekday(0-6), monthly pakai dayOfMonth(1-31).
  datetime: { type: String, default: '' },
  time: { type: String, default: '' },
  weekday: { type: Number, default: null },     // 0=Minggu ... 6=Sabtu (weekly/biweekly)
  dayOfMonth: { type: Number, default: null },  // 1..31 (monthly)
  anchorDate: { type: String, default: '' },    // 'YYYY-MM-DD' — patokan paritas biweekly
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
