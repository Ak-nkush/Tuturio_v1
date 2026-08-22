import { Router } from 'express'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { areRelated, conversationTypeForRoles } from '../services/relationshipService.js'

const router = Router()
router.use(requireAuth)

router.post('/', async (req, res) => {
  try {
    const peerId = String(req.body.peerId ?? req.body.userId ?? '')
    if (!peerId) return res.status(400).json({ error: 'peerId is required' })
    if (!(await areRelated(req.user.userId, peerId))) {
      return res.status(403).json({ error: 'You can only start tutor-student or tutor-parent conversations' })
    }
    const [me, peer] = await Promise.all([
      User.findOne({ userId: req.user.userId }),
      User.findOne({ userId: peerId }),
    ])
    res.status(201).json({
      conversation: {
        id: peerId,
        type: conversationTypeForRoles(me?.role, peer?.role),
        tutorId: me?.role === 'tutor' ? me.userId : peer.userId,
        studentId: peer?.role === 'student' ? peer.userId : me?.role === 'student' ? me.userId : null,
        parentId: peer?.role === 'parent' ? peer.userId : me?.role === 'parent' ? me.userId : null,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
