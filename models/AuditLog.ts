import mongoose from 'mongoose'

// Riwayat perubahan (siapa mengubah apa). Koleksi baru, hanya ditambah — data lama tidak disentuh.
const AuditLogSchema = new mongoose.Schema({
  entity: { type: String, required: true },      // 'activity' | 'reimbursement'
  entityId: { type: String, required: true },
  action: { type: String, enum: ['create', 'update', 'delete'], required: true },
  by: String,                                     // nama pengguna
  byEmail: String,
  changes: [{ _id: false, field: String, label: String, from: String, to: String }],
  note: String,
}, { timestamps: { createdAt: true, updatedAt: false } })

AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 })

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema)
