import mongoose, { Schema, models } from 'mongoose'

const DocumentSchema = new Schema({
  url:String, name:String, type:String, size:Number,
}, { _id:false })

const ReimbursementSchema = new Schema({
  userId: String, userName: String,
  title: { type:String, required:true },
  description: String,
  amount: { type:Number, required:true },
  category: { type:String, default:'general' },
  source: { type:String, enum:['cash_card','petty_cash'], default:'petty_cash' },
  isCashCard: { type:Boolean, default:false },
  bank: String, noRekening: String,
  billDate: String,   // tanggal bukti/nota/invoice (YYYY-MM-DD)
  documents: { type:[DocumentSchema], default:[] },
  receiptUrl: String,
  // Status flow: submitted (Menunggu) -> done (dibayar cashier) -> verified (divalidasi CC Holder saat settlement)
  status: { type:String, enum:['submitted','done','verified','rejected','draft','approved','paid','reversal_requested','reversal_approved'], default:'submitted' },
  // Settlement verification (slide 4)
  verifiedAt: String, verifiedBy: String, settlementMonth: Number, settlementYear: Number,
  // Reversal / cancellation flow
  reversalRequestedBy: String, reversalRequestedAt: String, reversalReason: String,
  reversalApprovedBy: String, reversalApprovedAt: String,
  // Cashier transfer
  biayaAntarBank: { type:Number, default:0 },
  hasBiayaAntarBank: { type:Boolean, default:false },
  totalTransfer: Number, // amount + biayaAntarBank
  transferredAt: String,
  transferredBy: String,
  whatsappSent: { type:Boolean, default:false },
  // Approval (legacy)
  submittedAt: String, approvedAt: String, approvedBy: String, rejectReason: String, notes: String,
}, { timestamps:true })

ReimbursementSchema.index({ status: 1 })
ReimbursementSchema.index({ createdAt: -1 })

export const ReimbursementModel = models.Reimbursement || mongoose.model('Reimbursement', ReimbursementSchema)
