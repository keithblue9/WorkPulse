import mongoose, { Schema, models } from 'mongoose'

const ProjectSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  pic: { type: String, required: true },
  members: [String],
  status: { type: String, enum: ['active','completed','on_hold','cancelled'], default: 'active' },
  priority: { type: String, enum: ['high','medium','low'], default: 'medium' },
  startDate: String,
  endDate: String,
  progress: { type: Number, default: 0 },
  // UPDATED: category is now free string (matches activityCategories from Config)
  category: { type: String, default: 'Others' },
  // NEW: sub-type (KPI-SI, KPI-Non SI, Go-Live, Others)
  subType: { type: String, default: 'Others' },
  kpiId: String,
  color: { type: String, default: '#4f8ef7' },
  tags: [String],
}, { timestamps: true })

export const ProjectModel = models.Project || mongoose.model('Project', ProjectSchema)
