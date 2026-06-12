import mongoose, { Schema, models } from 'mongoose'

const DocumentSchema = new Schema({
  url: String, name: String, type: String, size: Number,
}, { _id: false })

const ReimbursementSchema = new Schema({
  userId: String,
  userName: String,
  title: { type:String, required:true },
  description: String,
  amount: { type:Number, required:true },
  category: { type:String, default:'general' },
  // Source: cash_card or petty_cash
  source: { type:String, enum:['cash_card','petty_cash'], default:'petty_cash' },
  isCashCard: { type:Boolean, default:false }, // user flag
  // Bank
  bank: String,
  noRekening: String,
  // Multi-document upload
  documents: { type:[DocumentSchema], default:[] },
  // Legacy: single receiptUrl
  receiptUrl: String,
  // Status workflow
  status: { type:String, enum:['draft','submitted','approved','rejected','paid'], default:'submitted' },
  submittedAt: String,
  approvedAt: String,
  approvedBy: String,
  rejectReason: String,
  notes: String,
}, { timestamps:true })

export const ReimbursementModel = models.Reimbursement || mongoose.model('Reimbursement', ReimbursementSchema)
