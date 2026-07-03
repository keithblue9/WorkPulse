import mongoose, { Schema, models } from 'mongoose'

const TrainingItem = new Schema({
  id: { type: String, required: true },
  training: { type: String, default: '' },   // 'ISEC' | 'SMART' | 'lainnya'
  customName: { type: String, default: '' },  // diisi kalau training==='lainnya'
  date: { type: String, default: '' },
  note: { type: String, default: '' },
}, { _id: false })

const KpiItem = new Schema({
  id: { type: String, required: true },
  jenis: { type: String, default: '' },       // 'P-HORSE' | 'Survey' | 'lainnya'
  customName: { type: String, default: '' },   // diisi kalau jenis==='lainnya'
  jumlah: { type: Number, default: 0 },
  lastDate: { type: String, default: '' },
  note: { type: String, default: '' },
}, { _id: false })

const MandatorySchema = new Schema({
  userId: { type: String, required: true },   // email/id member
  year: { type: Number, required: true },
  // MCU (satu per member per tahun)
  mcu: {
    done: { type: String, default: 'belum' },  // 'sudah' | 'belum'
    date: { type: String, default: '' },
    result: { type: String, default: '' },     // 'P1'..'P6'
  },
  trainings: { type: [TrainingItem], default: [] },
  supportKpi: { type: [KpiItem], default: [] },
}, { timestamps: true })

MandatorySchema.index({ userId: 1, year: 1 }, { unique: true })

export const MandatoryModel = models.Mandatory || mongoose.model('Mandatory', MandatorySchema)
