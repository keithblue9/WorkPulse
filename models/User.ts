import mongoose, { Schema, models } from 'mongoose'

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  // PIN-based authentication: 6-digit code hashed via bcrypt (still stored in password field for compatibility)
  password: { type: String, required: true },
  role: { type: String, enum: ['admin','manager','member','guest','finance'], default: 'member' },
  division: { type: String, default: '' },
  avatar: String,
  active: { type: Boolean, default: true },
  lastLogin: String,

  // ─── MEMBER BIODATA ───────────────────────
  noPekerja: String,
  jabatan: String,
  birthPlace: String,
  birthDate: String,
  alamatJakarta: String,
  alamatAsal: String,
  emailKantor: String,
  emailPribadi: String,
  phone: String,
  phoneLinkAja: String,
  bank: String,
  noRekening: String,
  kontakDaruratNama: String,
  kontakDaruratHubungan: String,
  kontakDaruratHp: String,
  sizeKaos: String,
  sizeKemeja: String,
  sizeBaju: String,    // legacy
  sizeJaket: String,
  sizeCelana: String,
  sizeSepatu: String,

  // Legacy
  address: String, hobbies: String, favoriteFood: String,

  // Preferences
  preferredTheme: { type: String, default: 'dark' },
  lastAttendanceCheck: String,
  lastInstallPromptDismiss: String,
}, { timestamps: true })

export const UserModel = models.User || mongoose.model('User', UserSchema)
