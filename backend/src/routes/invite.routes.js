import { Router } from 'express'
import { Batch } from '../models/Batch.js'
import { Invite, publicInvite } from '../models/Invite.js'
import { User, publicUser } from '../models/User.js'
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js'
import { claimInvite, validateInviteCode } from '../services/inviteService.js'
import { generateInviteCode, generateInviteId } from '../utils/ids.js'
import { hashPassword, normalizeEmail, validatePassword } from '../utils/password.js'
import { generateReservedUserId, generateUserId } from '../utils/ids.js'
import { env } from '../config/env.js'
import { setAuthCookies, signAccessToken, signRefreshToken } from '../utils/tokens.js'

const router = Router()

function inviteResponse(invite, batch) {
  return {
    invite: publicInvite(invite, batch.name),
    inviteUrl: `${env.clientUrl}/invite/${invite.code}`,
  }
}

function displayNameFromEmail(email) {
  const local = String(email ?? '').split('@')[0] || 'Member'
  const words = local.replace(/[._+\-]+/g, ' ').trim()
  if (!words) return 'Member'
  return words.replace(/\b\w/g, (char) => char.toUpperCase())
}

function normalizeOptionalEmail(value) {
  const raw = String(value ?? '').trim()
  return raw ? normalizeEmail(raw) : null
}

async function createInvite({ batch, role, linkedStudentId = null, email = null, expiryDays, pairedInviteId = null }) {
  const inviteId = await generateInviteId()
  const code = generateInviteCode()
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  return Invite.create({
    inviteId,
    batchId: batch.batchId,
    code,
    role,
    linkedStudentId,
    pairedInviteId,
    email,
    expiresAt,
  })
}

router.get('/tutor/batches', requireAuth, requireRole('tutor'), async (req, res) => {
  const batches = await Batch.find({ tutorId: req.user.userId, status: 'active' }).sort({ createdAt: -1 })

  return res.json({
    batches: batches.map((batch) => ({
      batchId: batch.batchId,
      name: batch.name,
      subjects: batch.subjects,
      studentCount: batch.enrollment.filter((enrollment) => enrollment.status === 'active').length,
    })),
  })
})

router.post('/paired', requireAuth, requireRole('tutor'), async (req, res) => {
  const batchId = String(req.body.batchId ?? '')
  const studentEmail = normalizeOptionalEmail(req.body.studentEmail)
  const parentEmail = normalizeOptionalEmail(req.body.parentEmail)
  const expiryDays = Number(req.body.expiryDays ?? env.inviteDefaultExpiryDays)

  if (!batchId) {
    return res.status(400).json({ message: 'batchId is required' })
  }

  if (!Number.isFinite(expiryDays) || expiryDays < 1 || expiryDays > 30) {
    return res.status(400).json({ message: 'expiryDays must be between 1 and 30' })
  }

  const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
  if (!batch) {
    return res.status(404).json({ message: 'Batch not found' })
  }

  const linkedStudentId = generateReservedUserId()
  batch.enrollment.push({
    studentId: linkedStudentId,
    joinedAt: new Date(),
    status: 'pending',
  })
  await batch.save()

  const studentInvite = await createInvite({
    batch,
    role: 'student',
    linkedStudentId,
    email: studentEmail,
    expiryDays,
  })

  const parentInvite = await createInvite({
    batch,
    role: 'parent',
    linkedStudentId,
    email: parentEmail,
    expiryDays,
    pairedInviteId: studentInvite.inviteId,
  })

  studentInvite.pairedInviteId = parentInvite.inviteId
  await studentInvite.save()

  return res.status(201).json({
    batch: {
      batchId: batch.batchId,
      name: batch.name,
    },
    linkedStudentId,
    student: inviteResponse(studentInvite, batch),
    parent: inviteResponse(parentInvite, batch),
  })
})

router.get('/:code', async (req, res) => {
  const result = await validateInviteCode(req.params.code)
  if (!result.ok) {
    return res.status(result.status).json({ reason: result.reason })
  }

  return res.json({
    invite: publicInvite(result.invite, result.batchName),
    status: 'valid',
  })
})

router.post('/:code/redeem', optionalAuth, async (req, res) => {
  const code = req.params.code
  const password = String(req.body.password ?? '')

  const preview = await validateInviteCode(code)
  if (!preview.ok) {
    return res.status(preview.status).json({ reason: preview.reason })
  }

  const { invite, batchName } = preview
  const requestedEmail = normalizeEmail(String(req.body.email ?? ''))
  const email = invite.email ? normalizeEmail(invite.email) : requestedEmail
  const name = String(req.body.name ?? '').trim() || (email ? displayNameFromEmail(email) : '')

  if (req.user && req.user.role !== invite.role) {
    return res.status(409).json({
      reason: 'wrong_role',
      message: `You're logged in as ${req.user.role}. Log out to join as ${invite.role}.`,
      currentRole: req.user.role,
      inviteRole: invite.role,
    })
  }

  const batch = await Batch.findOne({ batchId: invite.batchId, status: 'active' })
  if (!batch) {
    return res.status(410).json({ reason: 'batch_unavailable' })
  }

  if (invite.role === 'parent' && !invite.linkedStudentId) {
    return res.status(400).json({ message: 'Parent invite is missing linked student' })
  }

  if (req.user && req.user.role === invite.role) {
    const claimed = await claimInvite(code)
    if (!claimed) {
      return res.status(409).json({ reason: 'unavailable' })
    }

    if (invite.role === 'student') {
      const enrollment = batch.enrollment.find((item) => item.studentId === req.user.userId && item.status !== 'removed')
      if (enrollment) {
        enrollment.status = 'active'
      } else {
        batch.enrollment.push({ studentId: req.user.userId, joinedAt: new Date(), status: 'active' })
      }
      await batch.save()
    } else {
      await linkParentToStudent(req.user.userId, invite.linkedStudentId, batch)
    }

    return res.json({
      message: 'Enrolled successfully',
      batchName,
      user: publicUser(await User.findOne({ userId: req.user.userId })),
    })
  }

  if (!email || !password) {
    return res.status(400).json({ message: invite.email ? 'Password is required' : 'Email and password are required' })
  }

  const requestedName = String(req.body.name ?? '').trim()
  if (requestedName && (requestedName.length < 2 || requestedName.length > 80)) {
    return res.status(400).json({ message: 'Username must be between 2 and 80 characters' })
  }

  const passwordError = validatePassword(password)
  if (passwordError) return res.status(400).json({ message: passwordError })

  if (invite.email && invite.email !== email) {
    return res.status(400).json({ message: 'This invite is tied to a different email address' })
  }

  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.role !== invite.role) {
      return res.status(409).json({
        message: `This email is already registered as a ${existing.role}`,
        existingRole: existing.role,
      })
    }

    const claimed = await claimInvite(code)
    if (!claimed) return res.status(409).json({ reason: 'unavailable' })

    const { verifyPassword } = await import('../utils/password.js')
    const passwordOk = await verifyPassword(password, existing.passwordHash)
    if (!passwordOk) {
      return res.status(401).json({ message: 'Email already registered. Log in with your existing password.' })
    }

    if (invite.role === 'student') {
      const enrollment = batch.enrollment.find((item) => item.studentId === existing.userId && item.status !== 'removed')
      if (enrollment) {
        enrollment.status = 'active'
      } else {
        batch.enrollment.push({ studentId: existing.userId, joinedAt: new Date(), status: 'active' })
      }
      await batch.save()
    } else {
      await linkParentToStudent(existing.userId, invite.linkedStudentId, batch)
    }

    const accessToken = signAccessToken(existing)
    const refreshToken = signRefreshToken(existing)
    setAuthCookies(res, accessToken, refreshToken)

    return res.json({
      message: 'Linked to batch successfully',
      batchName,
      user: publicUser(existing),
    })
  }

  const claimed = await claimInvite(code)
  if (!claimed) {
    return res.status(409).json({ reason: 'unavailable' })
  }

  const userId = await generateUserId()
  const user = await User.create({
    userId: invite.role === 'student' && invite.linkedStudentId ? invite.linkedStudentId : userId,
    name,
    email,
    role: invite.role,
    passwordHash: await hashPassword(password),
    linkedStudentIds: invite.role === 'parent' && invite.linkedStudentId ? [invite.linkedStudentId] : [],
  })

  if (invite.role === 'student') {
    const enrollment = batch.enrollment.find((enrollmentItem) => enrollmentItem.studentId === user.userId && enrollmentItem.status !== 'removed')
    if (enrollment) {
      enrollment.status = 'active'
      if (enrollment.parentId && !user.linkedParentIds.includes(enrollment.parentId)) {
        user.linkedParentIds.push(enrollment.parentId)
        await user.save()
      }
    } else {
      batch.enrollment.push({ studentId: user.userId, joinedAt: new Date(), status: 'active' })
    }
    await batch.save()
  } else if (invite.linkedStudentId) {
    await linkParentToStudent(user.userId, invite.linkedStudentId, batch)
  }

  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  setAuthCookies(res, accessToken, refreshToken)

  return res.status(201).json({
    message: 'Account created',
    batchName,
    user: publicUser(user),
  })
})

async function linkParentToStudent(parentId, studentId, batch) {
  const parent = await User.findOne({ userId: parentId })
  const student = await User.findOne({ userId: studentId })

  if (!parent) return

  if (!parent.linkedStudentIds.includes(studentId)) {
    parent.linkedStudentIds.push(studentId)
    await parent.save()
  }

  if (student && !student.linkedParentIds.includes(parentId)) {
    student.linkedParentIds.push(parentId)
    await student.save()
  }

  const enrollment = batch.enrollment.find((enrollmentItem) => enrollmentItem.studentId === studentId && enrollmentItem.status !== 'removed')
  if (enrollment) {
    enrollment.parentId = parentId
  } else {
    batch.enrollment.push({
      studentId,
      parentId,
      joinedAt: new Date(),
      status: 'active',
    })
  }

  await batch.save()
}

router.post('/', requireAuth, requireRole('tutor'), async (req, res) => {
  const batchId = String(req.body.batchId ?? '')
  const role = req.body.role
  const linkedStudentId = req.body.linkedStudentId ? String(req.body.linkedStudentId) : null
  const email = req.body.email ? normalizeEmail(String(req.body.email)) : null
  const expiryDays = Number(req.body.expiryDays ?? env.inviteDefaultExpiryDays)

  if (!batchId || !['student', 'parent'].includes(role)) {
    return res.status(400).json({ message: 'batchId and role (student|parent) are required' })
  }

  if (role === 'parent' && !linkedStudentId) {
    return res.status(400).json({ message: 'linkedStudentId is required for parent invites' })
  }

  const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
  if (!batch) {
    return res.status(404).json({ message: 'Batch not found' })
  }

  if (role === 'parent') {
    const studentExists = batch.enrollment.some((enrollment) => enrollment.studentId === linkedStudentId)
    if (!studentExists) {
      batch.enrollment.push({
        studentId: linkedStudentId,
        joinedAt: new Date(),
        status: 'active',
      })
      await batch.save()
    }
  }

  const inviteId = await generateInviteId()
  const code = generateInviteCode()
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)

  const invite = await Invite.create({
    inviteId,
    batchId,
    code,
    role,
    linkedStudentId: role === 'parent' ? linkedStudentId : null,
    email,
    expiresAt,
  })

  const inviteUrl = `${env.clientUrl}/invite/${code}`

  return res.status(201).json({
    invite: publicInvite(invite, batch.name),
    inviteUrl,
  })
})

router.post('/:code/send', requireAuth, requireRole('tutor'), async (req, res) => {
  const code = req.params.code
  
  const invite = await Invite.findOne({ code })
  if (!invite) {
    return res.status(404).json({ message: 'Invite not found' })
  }

  const batch = await Batch.findOne({ batchId: invite.batchId, tutorId: req.user.userId })
  if (!batch) {
    return res.status(403).json({ message: 'Not authorized to send this invite' })
  }

  if (!invite.email) {
    return res.status(400).json({ message: 'This invite does not have an email address associated with it' })
  }

  const { sendInviteEmail } = await import('../utils/email.js')
  const inviteUrl = `${env.clientUrl}/invite/${invite.code}`
  
  try {
    await sendInviteEmail(invite.email, invite.role, inviteUrl, batch.name)
    return res.json({ message: 'Invite email sent successfully' })
  } catch (err) {
    console.error('Failed to send invite email:', err)
    const setup = /not set up yet/i.test(err.message)
    return res.status(setup ? 503 : 500).json({ message: err.message || 'Failed to send invite email' })
  }
})

// Revoking an invite also revokes its paired invite, so a student/parent pair
// cannot be partially onboarded from an invitation the tutor has withdrawn.
router.post('/:code/revoke', requireAuth, requireRole('tutor'), async (req, res) => {
  const invite = await Invite.findOne({ code: req.params.code })
  if (!invite) return res.status(404).json({ message: 'Invite not found' })
  if (invite.used) return res.status(409).json({ message: 'Redeemed invites cannot be revoked' })

  const batch = await Batch.findOne({ batchId: invite.batchId, tutorId: req.user.userId, status: 'active' })
  if (!batch) return res.status(403).json({ message: 'Not authorized to revoke this invite' })

  const inviteIds = [invite.inviteId, invite.pairedInviteId].filter(Boolean)
  await Invite.updateMany({ inviteId: { $in: inviteIds }, used: false }, { $set: { revoked: true } })
  return res.json({ message: 'Invite revoked' })
})

export default router
