import mongoose, { Schema, models } from 'mongoose'
const PhaseSchema = new Schema({
  name: String,
  planPct: { type:Number, default:0 },
  actualPct: { type:Number, default:0 },
  planStartMonth: Number, planEndMonth: Number,
  actualStartMonth: Number, actualEndMonth: Number,
  progressNotes: String,
}, { _id:false })
const InitiativeSchema = new Schema({
  code: { type:String, required:true },
  title: { type:String, required:true },
  planProgress: { type:Number, default:0 },     // auto-calculated from phases
  actualProgress: { type:Number, default:0 },   // auto-calculated from phases
  status: { type:String, default:'on_track' },
  year: { type:Number, default:2026 },
  pic: { type:[String], default:[] },
  progressNotes: String,
  phases: { type:[PhaseSchema], default:[] },
}, { timestamps:true })
export const InitiativeModel = models.Initiative || mongoose.model('Initiative', InitiativeSchema)
