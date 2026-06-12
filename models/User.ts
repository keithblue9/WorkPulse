import mongoose, { Schema, models } from 'mongoose'
const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  // role kept for back-compat. roles[] is the new multi-role field
  role: { type: String, default: 'member' },
  roles: { type: [String], default: ['member'] },
  division: { type: String, default: '' },
  avatar: String,
  active: { type: Boolean, default: true },
  lastLogin: String,
  // Biodata
  noPekerja: String, jabatan: String,
  birthPlace: String, birthDate: String,
  alamatJakarta: String, alamatAsal: String,
  emailKantor: String, emailPribadi: String,
  phone: String, phoneLinkAja: String,
  bank: String, noRekening: String,
  kontakDaruratNama: String, kontakDaruratHubungan: String, kontakDaruratHp: String,
  sizeKaos: String, sizeKemeja: String, sizeBaju: String, sizeJaket: String, sizeCelana: String, sizeSepatu: String,
  address: String, hobbies: String, favoriteFood: String,
  // Cashier extras (only for users with role=cashier)
  fonnteToken: String,
  // Pref
  preferredTheme: { type: String, default: 'dark' },
  lastAttendanceCheck: String, lastInstallPromptDismiss: String,
  lastBirthdayPopup: String, // YYYY-MM-DD
}, { timestamps: true })
export const UserModel = models.User || mongoose.model('User', UserSchema)
