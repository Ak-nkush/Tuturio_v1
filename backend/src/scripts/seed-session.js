import mongoose from 'mongoose'
import { connectDb } from '../db/connect.js'
import { Session } from '../models/Session.js'
import { Batch } from '../models/Batch.js'

async function seed() {
  await connectDb()
  
  // Find a batch to associate the session with
  const batch = await Batch.findOne()
  if (!batch) {
    console.log('No batches found. Create a batch first using the invite flow.')
    process.exit(0)
  }

  // Create a session for today
  const session = new Session({
    batchId: batch.batchId,
    tutorId: batch.tutorId,
    date: new Date(),
    topic: 'Chapter 5 - Algebra',
    status: 'scheduled'
  })

  await session.save()
  console.log(`Created dummy session for batch ${batch.name} on ${session.date}`)
  process.exit(0)
}

seed().catch(err => {
  console.error(err)
  process.exit(1)
})
