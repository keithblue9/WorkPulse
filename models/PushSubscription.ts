import mongoose from 'mongoose'

const PushSubscriptionSchema = new mongoose.Schema({
  userEmail: { type: String, required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
}, { timestamps: true })

export const PushSubscriptionModel = mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema)
