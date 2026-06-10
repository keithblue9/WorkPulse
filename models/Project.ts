import mongoose, { Schema, models } from 'mongoose'

const ProjectSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  pic: { type: String, required: true },   // primary owner
  members: [String],
  status: { type: String, enum: ['active','completed','on_hold','cancelled'], default: 'active' },
  priority: { type: String, enum: ['high','medium','low'], default: 'medium' },
  startDate: String,
  endDate: String,
  progress: { type: Number, default: 0 },
  category: { type: String, enum: ['SI','Non-SI','Others'], default: 'Others' },
  kpiId: String,
  color: { type: String, default: '#4f8ef7' },
  tags: [String],
}, { timestamps: true })

export const ProjectModel = models.Project || mongoose.model('Project', ProjectSchema)
