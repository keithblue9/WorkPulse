import mongoose, { Schema, models } from 'mongoose'

const AttendanceSchema = new Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true },   // "YYYY-MM-DD"
  type: { type: String, required: true },
  note: String,
}, { timestamps: true })

// Unique per user per day
AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true })

export const AttendanceModel = models.Attendance || mongoose.model('Attendance', AttendanceSchema)
