import mongoose, { Schema, models } from 'mongoose'

const ReimbursementSchema = new Schema({
  userId: { type: String, required: true },
  userName: String,
  billDate: { type: String, required: true },
  purpose: { type: String, required: true },
  category: { type: String, enum: ['transport','meal','accommodation','office','other'], default: 'other' },
  bankName: { type: String, required: true },
  accountNumber: { type: String, required: true },
  accountName: String,
  amount: { type: Number, required: true },
  receiptUrl: String,
  receiptName: String,
  notes: String,
  status: { type: String, enum: ['pending','approved','rejected','paid'], default: 'pending' },
  reviewedBy: String,
  reviewedAt: String,
  reviewNote: String,
  paidAt: String,
}, { timestamps: true })

export const ReimbursementModel = models.Reimbursement || mongoose.model('Reimbursement', ReimbursementSchema)
