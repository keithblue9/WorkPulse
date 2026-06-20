import mongoose from 'mongoose'

const PresenceSchema = new mongoose.Schema({
  key: { type: String, unique: true, index: true }, // internal: email · guest: guest:<tabId>
  name: String,
  role: String,
  isGuest: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true })

// Auto-remove stale presence rows 5 min after the last heartbeat (self-cleaning).
PresenceSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 300 })

export const PresenceModel = mongoose.models.Presence || mongoose.model('Presence', PresenceSchema)
