import mongoose, { Schema, models } from 'mongoose'
const CashierSchema = new Schema({
  year: { type:Number, required:true },
  saldoAwal: { type:Number, default:0 },
  // Manual top-ups (non Cash Card)
  manualTopUps: { type:[{ date:String, amount:Number, source:String, notes:String }], default:[] },
}, { timestamps:true })
export const CashierModel = models.Cashier || mongoose.model('Cashier', CashierSchema)
