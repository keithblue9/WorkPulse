import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/workpulse'

declare global {
  // eslint-disable-next-line no-var
  var mongoose: { conn: mongoose.Connection | null; promise: Promise<mongoose.Connection> | null }
}

let cached = global.mongoose
if (!cached) cached = global.mongoose = { conn: null, promise: null }

export async function connectDB() {
  if (cached.conn && cached.conn.readyState === 1) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // Serverless-tuned options — faster cold start
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 5000,
      maxPoolSize: 5,        // small pool for serverless
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      family: 4,             // prefer IPv4 (faster DNS)
    } as any).then((m) => m.connection)
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null  // reset so next call retries
    throw e
  }
  return cached.conn
}
