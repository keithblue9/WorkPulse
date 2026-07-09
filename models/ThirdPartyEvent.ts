import mongoose, { Schema, models } from 'mongoose'

// Sub-item biaya pada Rencana (Others: meals, suvenir, snacks, dll + lain2 free text)
const CostItemSchema = new Schema({
  key: String,          // 'meals' | 'suvenir' | 'snacks' | 'oleh2' | 'voucher' | 'custom'
  label: String,        // untuk 'custom' / lain2 (free text)
  pax: { type:Number, default:0 },
  times: { type:Number, default:0 },     // dipakai meals
  price: { type:Number, default:0 },     // harga per unit
}, { _id:false })

const ThirdPartyEventSchema = new Schema({
  kind: { type:String, enum:['rencana','realisasi'], required:true },
  year: { type:Number, required:true },
  month: { type:Number, required:true },  // 1-12 (untuk filter)

  // ---------- Rencana (slide 7) ----------
  namaEO: String,                 // PTC/Kinanti/MTT/Others — free text
  judulKegiatan: String,
  tanggalKegiatan: String,        // YYYY-MM-DD (kompat lama = tanggal mulai)
  tanggalMulai: String,           // YYYY-MM-DD
  tanggalSelesai: String,         // YYYY-MM-DD
  durasiHari: { type:Number, default:0 },
  kota: String,
  venue: String,
  jumlahPeserta: { type:Number, default:0 },
  picInternal: String,            // penanggung jawab internal
  kontakEO: String,               // PIC / kontak EO
  catatan: String,                // catatan tambahan
  // Meeting Room
  mrPax: { type:Number, default:0 }, mrDays: { type:Number, default:0 }, mrPrice: { type:Number, default:0 },
  // Bedroom
  brRooms: { type:Number, default:0 }, brNights: { type:Number, default:0 }, brPrice: { type:Number, default:0 },
  // Others (array of cost items)
  others: { type:[CostItemSchema], default:[] },
  // estimasi disimpan juga (snapshot) supaya list cepat; tetap dihitung ulang di UI
  estimasiBiaya: { type:Number, default:0 },

  // ---------- Realisasi (slide 8) ----------
  nominalTagihan: { type:Number, default:0 },
  nomorPO: String,
  tglVendorBAST: String,          // YYYY-MM-DD
  tglApproveBAST: String,
  nomorInvoice: String,
  tglInvoice: String,

  createdBy: String,
}, { timestamps:true })

ThirdPartyEventSchema.index({ kind:1, year:1, month:1 })

export const ThirdPartyEventModel = models.ThirdPartyEvent || mongoose.model('ThirdPartyEvent', ThirdPartyEventSchema)
