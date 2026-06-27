import mongoose, { Schema, models } from 'mongoose'

// Pemasukan/saldo awal dana petty cash yang ditambahkan manual.
// Pengeluaran TIDAK disimpan di sini — dihitung on-the-fly dari reimbursement (non-cash-card)
// + selisih Cash Card, di API /api/pettycash.
const InflowSchema = new Schema({
  date: String,                 // YYYY-MM-DD
  amount: { type:Number, default:0 },
  source: String,               // mis. "Saldo Awal", "Top Up Bank", dll
  notes: String,
}, { _id:true })

const PettyCashSchema = new Schema({
  year: { type:Number, required:true, unique:true },
  inflows: { type:[InflowSchema], default:[] },
}, { timestamps:true })

export const PettyCashModel = models.PettyCash || mongoose.model('PettyCash', PettyCashSchema)
