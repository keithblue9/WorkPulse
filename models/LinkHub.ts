import mongoose, { Schema, models } from 'mongoose'

const LinkHubSchema = new Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  description: String,
  category: { type: String, default: 'general' },
  icon: String,
  addedBy: String,
  pinned: { type: Boolean, default: false },
  clickCount: { type: Number, default: 0 },
}, { timestamps: true })

export const LinkHubModel = models.LinkHub || mongoose.model('LinkHub', LinkHubSchema)
