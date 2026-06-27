import mongoose, { Schema, models } from 'mongoose'
const MonthlyRealizationSchema = new Schema({
  month: Number,
  realisasiIDR: { type:Number, default:0 },
  realisasiUSD: { type:Number, default:0 },
  notes: String,
}, { _id:false })
const BudgetSchema = new Schema({
  year: { type:Number, required:true },
  category: { type:String, required:true }, // budgetCategories.key
  annualBudgetIDR: { type:Number, default:0 },
  annualBudgetUSD: { type:Number, default:0 },
  // Realisasi tahunan langsung (dipakai Budget Report). Kalau 0, fallback ke jumlah monthly[].
  annualRealIDR: { type:Number, default:0 },
  annualRealUSD: { type:Number, default:0 },
  monthly: { type:[MonthlyRealizationSchema], default:[] },
}, { timestamps:true })
export const BudgetModel = models.Budget || mongoose.model('Budget', BudgetSchema)
