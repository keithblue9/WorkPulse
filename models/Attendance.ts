import mongoose, { Schema, models } from 'mongoose'

const TimeSlotSchema = new Schema({
  type: { type: String, required: true },
  label: String,
  startTime: String,   // "08:00" or "fullday"
  endTime: String,     // "17:00"
  isFullDay: { type: Boolean, default: false },
  note: String,
}, { _id: true })

const AttendanceSchema = new Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },
  slots: { type: [TimeSlotSchema], default: [] },
  // Legacy support
  type: String,
  note: String,
}, { timestamps: true })

AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true })

export const AttendanceModel = models.Attendance || mongoose.model('Attendance', AttendanceSchema)
