import mongoose, { Schema, models } from 'mongoose'
const MeetingReportSchema = new Schema({
  title: { type:String, required:true },
  category: { type:String, default:'general' },
  meetingDate: String,
  location: String,
  duration: Number,
  attendees: [String],
  picTags: [String],
  categoryTags: [String],
  agenda: String, discussion: String, decisions: String, actionItems: String,
  // Form-facing fields used by /dashboard/meetings (the schema missed these → Mongoose strip-on-save)
  notes: String, pic: String,
  attachments: { type:[{url:String,name:String,type:String,size:Number}], default:[] },
  evidenceUrl: String, evidenceName: String,
  tags: [String],
  authorId: String, authorName: String,
}, { timestamps:true })
export const MeetingReportModel = models.MeetingReport || mongoose.model('MeetingReport', MeetingReportSchema)
