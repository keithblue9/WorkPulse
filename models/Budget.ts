import mongoose, { Schema, models } from 'mongoose'

const BudgetEntrySchema = new Schema({
  categoryKey: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },   // 1-12
  planAmount: { type: Number, default: 0 },
  actualAmount: { type: Number, default: 0 },
  description: String,
  pic: String,
  receipts: [{ name: String, url: String }],
}, { timestamps: true })

BudgetEntrySchema.index({ categoryKey: 1, year: 1, month: 1 })

export const BudgetModel = models.Budget || mongoose.model('Budget', BudgetEntrySchema)
