import mongoose, { Schema, models } from 'mongoose'

// Sub-feature per app (mis. iVendor: DPT, CSMS, Akun)
const GoLiveSubFeatureSchema = new Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  order: { type: Number, default: 0 },
}, { _id: false })

const GoLiveAppSchema = new Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  order: { type: Number, default: 999 },
  subFeatures: { type: [GoLiveSubFeatureSchema], default: [] },
}, { timestamps: true })

// Entity apps shape: { [appKey]: { date:string, subs: { [subKey]: boolean } } }
const GoLiveEntitySchema = new Schema({
  name: { type: String, required: true },
  cocd: { type: String, default: '' },
  group: { type: String, default: '' },
  client: { type: String, default: '' },
  order: { type: Number, default: 999 },
  apps: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false })

export const GoLiveAppModel = models.GoLiveApp || mongoose.model('GoLiveApp', GoLiveAppSchema)
export const GoLiveEntityModel = models.GoLiveEntity || mongoose.model('GoLiveEntity', GoLiveEntitySchema)
