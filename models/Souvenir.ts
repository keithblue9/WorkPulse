import mongoose, { Schema, models } from 'mongoose'

// Pergerakan stok (in = masuk/beli, out = keluar/dipakai)
const StockMoveSchema = new Schema({
  type: { type:String, enum:['in','out'], required:true },
  qty: { type:Number, default:0 },
  date: String,                 // YYYY-MM-DD
  note: String,                 // keterangan (mis. "dipakai event UAT IPRO" / "beli batch 1")
  by: String,                   // pencatat
}, { _id:true, timestamps:true })

// Souvenir: ide usulan + tracking stok
const SouvenirSchema = new Schema({
  kind: { type:String, enum:['usulan','stok'], default:'usulan' },   // pisahkan daftar usulan vs barang stok
  nama: { type:String, required:true },
  deskripsi: String,
  hargaSatuan: { type:Number, default:0 },
  jumlahUsulan: { type:Number, default:0 },       // usulan jumlah yg diajukan
  link: String,                                    // link e-commerce
  status: { type:String, enum:['usulan','disetujui','ditolak','stok'], default:'usulan' },
  catatan: String,
  moves: { type:[StockMoveSchema], default:[] },   // ledger stok in/out
  createdBy: String,
}, { timestamps:true })

export const SouvenirModel = models.Souvenir || mongoose.model('Souvenir', SouvenirSchema)
