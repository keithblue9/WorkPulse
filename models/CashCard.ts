import mongoose, { Schema, models } from 'mongoose'
const CashCardSchema = new Schema({
  year: { type:Number, required:true },
  month: { type:Number, required:true }, // 1-12
  date: String, // YYYY-MM-DD
  // Top Up
  prNo: String,
  topUpAmount: { type:Number, default:0 },
  // Settlement
  jojonomicId: String,
  poNo: String,
  settlementAmount: { type:Number, default:0 },
  notes: String,
  createdBy: String,
}, { timestamps:true })
export const CashCardModel = models.CashCard || mongoose.model('CashCard', CashCardSchema)
