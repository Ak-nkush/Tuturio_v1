import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { mongoConnectOptions } from './mongoUri.js'

export async function connectDb() {
  await mongoose.connect(env.mongoUri, mongoConnectOptions(env.mongoUri))
  console.log(`MongoDB connected (${mongoose.connection.name})`)
}
