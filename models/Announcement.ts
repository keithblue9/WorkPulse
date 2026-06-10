import mongoose, { Schema, models } from 'mongoose'

const AnnouncementSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  type: { type: String, enum: ['info','meeting','urgent','event'], default: 'info' },
  meetingLink: String,
  meetingPlatform: { type: String, enum: ['teams','meet','zoom','other'] },
  meetingTime: String,
  meetingDate: String,
  authorId: String,
  authorName: String,
  pinned: { type: Boolean, default: false },
  readBy: [String],
}, { timestamps: true })

export const AnnouncementModel = models.Announcement || mongoose.model('Announcement', AnnouncementSchema)
