import { Router } from 'express'
import { Resource } from '../models/Resource.js'
import { Message } from '../models/Message.js'
import { Submission } from '../models/Submission.js'
import { Assignment } from '../models/Assignment.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { canAccessBatch } from '../services/accessService.js'
import { sendStoredFile } from '../services/storageService.js'
import { validObjectIdParam } from '../utils/validate.js'
import { areRelated } from '../services/relationshipService.js'

const router = Router()
router.use(requireAuth)

router.get('/resources/:resourceId', validObjectIdParam('resourceId'), async (req, res) => {
  const resource = await Resource.findById(req.params.resourceId)
  if (!resource || resource.type !== 'file' || !resource.storageKey) return res.status(404).json({ error: 'File not found' })
  const { allowed } = await canAccessBatch(req.user, resource.batchId)
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  return sendStoredFile(res, resource)
})

router.get('/messages/:messageId/:attachmentIndex', validObjectIdParam('messageId'), async (req, res) => {
  const message = await Message.findById(req.params.messageId)
  const index = Number(req.params.attachmentIndex)
  if (!message || !Number.isInteger(index) || !message.attachments[index]?.storageKey) return res.status(404).json({ error: 'File not found' })
  if (message.senderId !== req.user.userId && message.receiverId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' })
  return sendStoredFile(res, message.attachments[index])
})

router.get('/submissions/:submissionId', validObjectIdParam('submissionId'), async (req, res) => {
  const submission = await Submission.findById(req.params.submissionId)
  if (!submission?.storageKey) return res.status(404).json({ error: 'File not found' })
  const assignment = await Assignment.findById(submission.assignmentId)
  if (!assignment) return res.status(404).json({ error: 'File not found' })
  let allowed = req.user.userId === submission.studentId || (req.user.role === 'tutor' && assignment.tutorId === req.user.userId)
  if (!allowed && req.user.role === 'parent') {
    const parent = await User.findOne({ userId: req.user.userId })
    allowed = Boolean(parent?.linkedStudentIds.includes(submission.studentId))
  }
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })
  return sendStoredFile(res, submission)
})

export default router
