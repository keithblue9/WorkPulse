import mongoose, { Schema, models } from 'mongoose'

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'member', 'guest'], default: 'member' },
  division: { type: String, default: '' },
  avatar: { type: String },
}, { timestamps: true })

export const UserModel = models.User || mongoose.model('User', UserSchema)
