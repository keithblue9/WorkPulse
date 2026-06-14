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
      socketTimeoutMS: 20000,
      connectTimeoutMS: 8000,
      maxPoolSize: 10,       // up to 10 concurrent ops per warm function instance
      minPoolSize: 1,        // keep 1 connection warm to cut reconnect latency
      maxIdleTimeMS: 30000,  // hold idle conns longer (fewer reconnects during active day)
      family: 4,             // prefer IPv4 (faster DNS)
      compressors: ['zlib'], // compress wire traffic — helps with larger payloads
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
