import mongoose, { Schema, models } from 'mongoose'

// Enhancement IT Requirement BPDP. Skor 0–5 per item (User, Fulfiller, Flow Aplikasi, Proses Bisnis);
// kategori & prioritas dihitung saat dibaca (lib/enhancement), tidak disimpan.
const ItemSchema = new Schema({
  t: String, u: Number, f: Number, fl: Number, pb: Number,
  du: String, df: String, dfl: String, dpb: String, // narasi tiap skor
}, { _id: false })

const PhaseSchema = new Schema({ key: String, start: String, end: String, pct: Number }, { _id: false })

const ActSchema = new Schema({ name: String, start: String, end: String, w: Number, pct: Number, notes: String }, { _id: false })
const CarrySchema = new Schema({ from: Number, to: Number, at: Date, by: String, prevType: String, prevCode: String }, { _id: false })

const EnhancementSchema = new Schema({
  code: { type: String, default: '' },
  app: { type: String, required: true },
  year: { type: Number, required: true, index: true },
  title: { type: String, required: true },
  type: { type: String, default: 'New' },
  initiator: { type: String, default: '' },
  items: { type: [ItemSchema], default: [] },
  stage: { type: Number, default: 1 },            // 1 Drafting … 7 Development; BRD % = stage / 7
  weights: { type: [Number], default: undefined }, // 5 bobot per enhancement; kosong = template Configuration
  phases: { type: [PhaseSchema], default: [] },    // BRD, Development, UAT, Go Live, Stabilisasi
  pic: { type: [String], default: [] },
  notes: { type: String, default: '' },
  source: { file: String, sheet: String, row: Number, importedAt: Date },
  // Alur terpadu (Progress Project → Enhancement). Semua opsional; dokumen lama tetap terbaca apa adanya.
  klas: { type: String },                          // 'SI' (KPI) | 'Non-SI'; kosong dibaca Non-SI
  acts: { type: [ActSchema], default: undefined }, // aktivitas kustom; kosong = template 5 aktivitas
  hiddenGuest: { type: Boolean },
  carriedFrom: { type: Number },                   // tahun asal pertama sebelum Carry Over
  carryLog: { type: [CarrySchema], default: undefined },
  fromInitiative: { type: String, index: true },   // _id initiative asal (migrasi Progress Project)
  createdBy: String,
  updatedBy: String,
}, { timestamps: true })

export const EnhancementModel = models.Enhancement || mongoose.model('Enhancement', EnhancementSchema)
