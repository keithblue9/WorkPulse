import mongoose, { Schema, models } from 'mongoose'

const MeetingReportSchema = new Schema({
  title: { type:String, required:true },
  category: { type:String, default:'general' },
  meetingDate: { type:String, required:true },
  notes: { type:String, default:'' },
  pic: { type:String, default:'' },
  attendees: [String],
  evidenceUrl: String,
  evidenceName: String,
  status: { type:String, enum:['draft','published','archived'], default:'published' },
  authorId: String,
  authorName: String,
  tags: [String],
}, { timestamps: true })

export const MeetingReportModel = models.MeetingReport || mongoose.model('MeetingReport', MeetingReportSchema)
