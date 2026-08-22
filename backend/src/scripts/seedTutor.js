import dotenv from 'dotenv'
import { connectDb } from '../db/connect.js'
import { User } from '../models/User.js'
import { Batch } from '../models/Batch.js'
import { env } from '../config/env.js'
import { generateBatchId, generateUserId } from '../utils/ids.js'
import { hashPassword, normalizeEmail, validatePassword } from '../utils/password.js'

dotenv.config()

async function seedTutor() {
  await connectDb()

  const email = normalizeEmail(env.tutorEmail)
  const passwordError = validatePassword(env.tutorPassword)
  if (passwordError) {
    throw new Error(`TUTOR_PASSWORD invalid: ${passwordError}`)
  }

  let tutor = await User.findOne({ role: 'tutor' })

  if (tutor) {
    if (tutor.name === 'Demo Tutor') {
      tutor.name = env.tutorName === 'Demo Tutor' ? 'Ananya Sharma' : env.tutorName
      if (!tutor.bio) {
        tutor.bio = 'Physics for grades 9–12. Board exams and JEE foundation, weekday evenings.'
      }
      await tutor.save()
      console.log('Updated seeded tutor profile:', tutor.name)
    }
    console.log('Tutor already exists:', tutor.email)
  } else {
    const userId = await generateUserId()
    tutor = await User.create({
      userId,
      name: env.tutorName,
      email,
      role: 'tutor',
      passwordHash: await hashPassword(env.tutorPassword),
    })
    console.log('Created tutor:', tutor.email, `(userId: ${tutor.userId})`)
  }

  let batch = await Batch.findOne({ tutorId: tutor.userId, status: 'active' })
  if (!batch) {
    const batchId = await generateBatchId()
    batch = await Batch.create({
      batchId,
      tutorId: tutor.userId,
      name: 'Grade 10 Math — Evening',
      subjects: ['Algebra', 'Geometry'],
    })
    console.log('Created sample batch:', batch.name, `(batchId: ${batch.batchId})`)
  } else {
    console.log('Sample batch already exists:', batch.name)
  }

  console.log('\nSeed complete.')
  console.log('Login at', `${env.clientUrl}/auth/login`)
  console.log('Email:', email)
  console.log('Password:', env.tutorPassword)

  process.exit(0)
}

seedTutor().catch((err) => {
  console.error(err)
  process.exit(1)
})
