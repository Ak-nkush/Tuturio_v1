import dotenv from 'dotenv'
import { connectDb } from '../db/connect.js'
import { User } from '../models/User.js'
import { env } from '../config/env.js'
import { generateUserId } from '../utils/ids.js'
import { hashPassword, normalizeEmail, validatePassword } from '../utils/password.js'

dotenv.config()

async function seedTutor() {
  await connectDb()

  const email = normalizeEmail(env.tutorEmail)
  const passwordError = validatePassword(env.tutorPassword)
  if (passwordError) {
    throw new Error(`TUTOR_PASSWORD invalid: ${passwordError}`)
  }

  const extras = await User.find({ role: 'tutor' }).sort({ createdAt: 1 })
  let tutor = extras[0] ?? null
  if (extras.length > 1) {
    await User.deleteMany({ role: 'tutor', userId: { $ne: tutor.userId } })
    console.log(`Removed ${extras.length - 1} extra tutor account(s). This classroom has one tutor.`)
  }

  const passwordHash = await hashPassword(env.tutorPassword)

  if (tutor) {
    tutor.name = env.tutorName
    tutor.email = email
    tutor.passwordHash = passwordHash
    tutor.tokenVersion = (tutor.tokenVersion ?? 0) + 1
    await tutor.save()
    console.log('Updated the classroom tutor:', tutor.name, tutor.email)
  } else {
    tutor = await User.create({
      userId: await generateUserId(),
      name: env.tutorName,
      email,
      role: 'tutor',
      passwordHash,
    })
    console.log('Created the classroom tutor:', tutor.name, tutor.email, `(userId: ${tutor.userId})`)
  }

  console.log('\nThis app has one tutor.')
  console.log('Login at', `${env.clientUrl}/auth/login`)
  console.log('Name:', env.tutorName)
  console.log('Email:', email)
  console.log('Password:', env.tutorPassword)

  process.exit(0)
}

seedTutor().catch((err) => {
  console.error(err)
  process.exit(1)
})
