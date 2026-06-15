import mongoose, { Schema, models } from 'mongoose'

// Week-level cell: { month: 1-12, week: 1-4 }
const PhaseSchema = new Schema({
  name: String,
  planPct: { type:Number, default:0 },     // weight of this phase in the plan (auto = planWeeks/totalPlanWeeks × 100)
  actualPct: { type:Number, default:0 },    // auto = (actualWeeks / planWeeks) × planPct
  // Week-level selections — arrays of "M-W" strings e.g. "3-1","3-2" (month 3 week 1,2)
  planCells: { type:[String], default:[] },
  actualCells: { type:[String], default:[] },
  // Legacy month-level (kept for back-compat / migration)
  planStartMonth: Number, planEndMonth: Number,
  actualStartMonth: Number, actualEndMonth: Number,
  progressNotes: String,
}, { _id:false })

const InitiativeSchema = new Schema({
  code: { type:String, required:true },
  title: { type:String, required:true },
  planProgress: { type:Number, default:0 },     // auto = sum of phase planPct (=100 if all planned)
  actualProgress: { type:Number, default:0 },   // auto = sum of phase actualPct
  spi: { type:Number, default:null },           // Schedule Performance Index (schedule efficiency, capped 1.0)
  status: { type:String, default:'on_track' },
  year: { type:Number, default:2026 },
  pic: { type:[String], default:[] },
  progressNotes: String,
  phases: { type:[PhaseSchema], default:[] },
}, { timestamps:true })

InitiativeSchema.index({ year: 1 })

export const InitiativeModel = models.Initiative || mongoose.model('Initiative', InitiativeSchema)
