import mongoose, { Schema, models } from 'mongoose'

const ProgressEntrySchema = new Schema({
  date: String, progress: Number, note: String, updatedBy: String,
}, { _id: false })

const CommentSchema = new Schema({
  text: String, authorId: String, authorName: String,
}, { timestamps: true })

const AttachmentSchema = new Schema({
  name: String, url: String,
}, { timestamps: true })

const IssueSchema = new Schema({
  initiativeId: { type: Schema.Types.ObjectId, ref: 'Initiative', required: true },
  title: { type: String, required: true },
  description: String,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  status: { type: String, enum: ['on_track', 'at_risk', 'delayed', 'completed'], default: 'on_track' },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  nextPlan: { type: String, default: '' },
  dueDate: { type: String, required: true },
  pic: { type: String, required: true },
  picName: String,
  tags: [String],
  progressHistory: [ProgressEntrySchema],
  comments: [CommentSchema],
  attachments: [AttachmentSchema],
  createdBy: String,
}, { timestamps: true })

export const IssueModel = models.Issue || mongoose.model('Issue', IssueSchema)
