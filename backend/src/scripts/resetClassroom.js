import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { env } from '../config/env.js'
import { connectDb } from '../db/connect.js'
import { User } from '../models/User.js'
import { Batch } from '../models/Batch.js'
import { Session } from '../models/Session.js'
import { Invite } from '../models/Invite.js'
import { Attendance } from '../models/Attendance.js'
import { Progress } from '../models/Progress.js'
import { Announcement } from '../models/Announcement.js'
import { Resource } from '../models/Resource.js'
import { Assignment } from '../models/Assignment.js'
import { Submission } from '../models/Submission.js'
import { Message } from '../models/Message.js'
import { Notification } from '../models/Notification.js'
import { Subject } from '../models/Subject.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function resetClassroom() {
  await connectDb()

  await Promise.all([
    User.deleteMany({ role: { $ne: 'tutor' } }),
    Batch.deleteMany({}),
    Session.deleteMany({}),
    Invite.deleteMany({}),
    Attendance.deleteMany({}),
    Progress.deleteMany({}),
    Announcement.deleteMany({}),
    Resource.deleteMany({}),
    Assignment.deleteMany({}),
    Submission.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Subject.deleteMany({}),
  ])

  const tutor = await User.findOne({ role: 'tutor' })
  if (tutor) {
    tutor.bio = ''
    tutor.linkedStudentIds = []
    tutor.linkedParentIds = []
    tutor.name = env.tutorName
    await tutor.save()
  }

  const uploads = path.join(__dirname, '../../uploads/private')
  await fs.rm(uploads, { recursive: true, force: true })
  await fs.mkdir(uploads, { recursive: true })

  console.log('Cleared batches, invites, students, parents, sessions, files, and messages.')
  console.log('Tutor login is unchanged.')
  process.exit(0)
}

resetClassroom().catch((err) => {
  console.error(err)
  process.exit(1)
})
