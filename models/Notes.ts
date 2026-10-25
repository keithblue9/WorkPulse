import mongoose, { Schema, models } from 'mongoose'
const NotesSchema = new Schema({
  title: { type:String, required:true },
  category: { type:String, default:'Others' }, // from activityCategories (iVendor, iPRO, ...)
  date: String,
  content: String,         // free narasi
  images: { type:[String], default:[] }, // pasted images (base64 data urls)
  attendees: [String],
  picTags: [String],       // tag PIC
  categoryTags: [String],  // tag activity categories
  tags: [String],
  attachments: { type:[{url:String,name:String,type:String,size:Number}], default:[] },
  evidenceUrl: String, evidenceName: String,
  authorId: String, authorName: String,
  pinned: Boolean,         // opsional: disematkan di atas grup (catatan lama tanpa field = tidak di-pin)
}, { timestamps:true })
export const NotesModel = models.Notes || mongoose.model('Notes', NotesSchema)
