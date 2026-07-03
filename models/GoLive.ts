import mongoose, { Schema, models } from 'mongoose'

// Aplikasi (kolom) — bisa nambah selain iVendor/iPRO/MySSC
const GoLiveAppSchema = new Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  order: { type: Number, default: 999 },
}, { timestamps: true })

// Entitas (baris) — apps: { [appKey]: { done:boolean, date:string } }
const GoLiveEntitySchema = new Schema({
  name: { type: String, required: true },     // nama perusahaan/entitas
  cocd: { type: String, default: '' },        // Company Code
  group: { type: String, default: '' },       // Holding / SH Upstream / dst
  order: { type: Number, default: 999 },
  apps: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false })

export const GoLiveAppModel = models.GoLiveApp || mongoose.model('GoLiveApp', GoLiveAppSchema)
export const GoLiveEntityModel = models.GoLiveEntity || mongoose.model('GoLiveEntity', GoLiveEntitySchema)
