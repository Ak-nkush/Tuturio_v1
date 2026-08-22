import { Router } from 'express'
import { Resource } from '../models/Resource.js'
import { Batch } from '../models/Batch.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createUpload, SAFE_DOCUMENT_TYPES } from '../middleware/uploads.js'
import { storeFile, deleteStoredFile, scanFile } from '../services/storageService.js'
import { canAccessBatch } from '../services/accessService.js'
import { notifyMany } from '../services/notificationService.js'
import { uploadRateLimiter } from '../middleware/rateLimit.js'

const upload = createUpload({ allowedTypes: SAFE_DOCUMENT_TYPES, maxFileSize: 10 * 1024 * 1024 })

function publicResource(resource) {
  const value = resource.toObject ? resource.toObject() : resource
  return {
    ...value,
    downloadUrl: value.type === 'file' ? `/api/files/resources/${value._id}` : null,
  }
}

function batchRecipients(batch) {
  const students = []
  const parents = []
  for (const row of batch.enrollment ?? []) {
    if (row.status !== 'active') continue
    students.push(row.studentId)
    if (row.parentId) parents.push(row.parentId)
  }
  return { students, parents }
}

async function notifyResourceShared(batch, title) {
  const { students, parents } = batchRecipients(batch)
  await notifyMany(students, {
    title: 'New material shared',
    message: `"${title}" was added to ${batch.name}`,
    type: 'batch',
    event: 'batch',
    link: '/student/dashboard?tab=materials',
  })
  await notifyMany(parents, {
    title: 'New material shared',
    message: `"${title}" was added to ${batch.name}`,
    type: 'batch',
    event: 'batch',
    link: '/parent/dashboard?tab=materials',
  })
}

const router = Router()
router.use(requireAuth)

router.get('/batch/:batchId', async (req, res) => {
  try {
    const { allowed, batch } = await canAccessBatch(req.user, req.params.batchId)
    if (!batch) return res.status(404).json({ error: 'Batch not found' })
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    const query = String(req.query.q ?? '').trim()
    const filter = { batchId: req.params.batchId }
    if (query) filter.title = { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    const resources = await Resource.find(filter).sort({ createdAt: -1 })
    res.json({ resources: resources.map(publicResource) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/upload', requireRole('tutor'), uploadRateLimiter, upload.single('file'), async (req, res) => {
  try {
    const batchId = String(req.body.batchId ?? '')
    const title = String(req.body.title ?? req.file?.originalname ?? 'Untitled').trim()

    if (!batchId || !req.file) {
      return res.status(400).json({ error: 'batchId and file are required' })
    }

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    await scanFile(req.file.buffer, req.file.mimetype)
    const stored = await storeFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `resources/${batchId}`,
    })
    const resource = await Resource.create({
      tutorId: req.user.userId,
      batchId,
      title,
      type: 'file',
      storageKey: stored.storageKey,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    })

    await notifyResourceShared(batch, title)
    res.status(201).json({ resource: publicResource(resource) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message ?? 'Server error' })
  }
})

router.post('/link', requireRole('tutor'), async (req, res) => {
  try {
    const batchId = String(req.body.batchId ?? '')
    const title = String(req.body.title ?? '').trim()
    const url = String(req.body.url ?? '').trim()

    if (!batchId || !title || !url) {
      return res.status(400).json({ error: 'batchId, title, and url are required' })
    }

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const resource = await Resource.create({
      tutorId: req.user.userId,
      batchId,
      title,
      type: 'link',
      url,
    })

    await notifyResourceShared(batch, title)
    res.status(201).json({ resource: publicResource(resource) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', requireRole('tutor'), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
    if (!resource || resource.tutorId !== req.user.userId) {
      return res.status(404).json({ error: 'Resource not found' })
    }

    if (resource.type === 'file') await deleteStoredFile(resource.storageKey)

    await resource.deleteOne()
    res.json({ message: 'Deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
