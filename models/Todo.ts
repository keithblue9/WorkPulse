import mongoose from 'mongoose'

// To-do / tugas. Tanpa assignee lain = to-do pribadi (assignee = pembuat sendiri).
// Setiap assignee punya progres sendiri (status + target selesai/ETA).
const AssigneeSchema = new mongoose.Schema({
  email: { type: String, required: true },
  name: { type: String, default: '' },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  eta: { type: String, default: '' },          // 'YYYY-MM-DD' — "per kapan" selesai menurut assignee
  updatedAt: { type: Date, default: null },
}, { _id: false })

// Linimasa: respon / update progres / perubahan oleh pembuat.
const UpdateSchema = new mongoose.Schema({
  id: { type: String, required: true },
  byEmail: { type: String, default: '' },
  byName: { type: String, default: '' },
  kind: { type: String, enum: ['comment', 'progress', 'edit', 'created'], default: 'comment' },
  text: { type: String, default: '' },
  status: { type: String, default: '' },
  eta: { type: String, default: '' },
  at: { type: Date, default: () => new Date() },
}, { _id: false })

const TodoSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  note: { type: String, default: '', maxlength: 4000 },
  createdByEmail: { type: String, required: true, index: true },
  createdByName: { type: String, default: '' },
  assignees: { type: [AssigneeSchema], default: [] },
  dueDate: { type: String, default: '' },      // 'YYYY-MM-DD'
  dueTime: { type: String, default: '' },      // 'HH:mm' opsional
  priority: { type: String, enum: ['normal', 'high'], default: 'normal' },
  updates: { type: [UpdateSchema], default: [] },
  archived: { type: Boolean, default: false },
}, { timestamps: true })

TodoSchema.index({ 'assignees.email': 1, archived: 1 })

export const TodoModel = mongoose.models.Todo || mongoose.model('Todo', TodoSchema)
