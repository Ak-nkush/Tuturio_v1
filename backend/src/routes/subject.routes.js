import { Router } from 'express'
import { Subject, publicSubject } from '../models/Subject.js'
import { Batch } from '../models/Batch.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateSubjectId } from '../utils/ids.js'

const router = Router()
router.use(requireAuth, requireRole('tutor'))

router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true'
    const filter = { tutorId: req.user.userId }
    if (!includeArchived) filter.status = 'active'
    const subjects = await Subject.find(filter).sort({ name: 1 })
    res.json({ subjects: subjects.map(publicSubject) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim()
    if (!name) return res.status(400).json({ error: 'Subject name is required' })

    const existing = await Subject.findOne({
      tutorId: req.user.userId,
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    })
    if (existing) {
      if (existing.status === 'archived') {
        existing.status = 'active'
        existing.name = name
        await existing.save()
        return res.json({ subject: publicSubject(existing) })
      }
      return res.status(409).json({ error: 'A subject with that name already exists' })
    }

    const subject = await Subject.create({
      subjectId: await generateSubjectId(),
      tutorId: req.user.userId,
      name,
    })
    res.status(201).json({ subject: publicSubject(subject) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:subjectId', async (req, res) => {
  try {
    const subject = await Subject.findOne({
      subjectId: req.params.subjectId,
      tutorId: req.user.userId,
    })
    if (!subject) return res.status(404).json({ error: 'Subject not found' })

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim()
      if (!name) return res.status(400).json({ error: 'Subject name cannot be empty' })
      const previous = subject.name
      subject.name = name
      await Batch.updateMany(
        { tutorId: req.user.userId, subjects: previous },
        { $set: { 'subjects.$': name } },
      )
    }
    if (req.body.status === 'active' || req.body.status === 'archived') {
      subject.status = req.body.status
    }
    await subject.save()
    res.json({ subject: publicSubject(subject) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:subjectId', async (req, res) => {
  try {
    const subject = await Subject.findOne({
      subjectId: req.params.subjectId,
      tutorId: req.user.userId,
    })
    if (!subject) return res.status(404).json({ error: 'Subject not found' })
    subject.status = 'archived'
    await subject.save()
    res.json({ message: 'Subject archived' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
