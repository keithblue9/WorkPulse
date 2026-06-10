import mongoose, { Schema, models } from 'mongoose'

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'member', 'guest', 'finance'], default: 'member' },
  division: { type: String, default: '' },
  phone: String,
  avatar: String, // base64 or URL
  active: { type: Boolean, default: true },
  lastLogin: String,
  // Extended profile
  birthDate: String,
  birthPlace: String,
  address: String,
  hobbies: String,
  favoriteFood: String,
  // Clothing sizes
  sizeBaju: String,
  sizeJaket: String,
  sizeCelana: String,
  sizeSepatu: String,
}, { timestamps: true })

export const UserModel = models.User || mongoose.model('User', UserSchema)
