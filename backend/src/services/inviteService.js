import { Batch } from '../models/Batch.js'
import { Invite } from '../models/Invite.js'

export async function validateInviteCode(code) {
  const invite = await Invite.findOne({ code })

  if (!invite) {
    return { ok: false, status: 404, reason: 'not_found' }
  }

  if (invite.revoked) {
    return { ok: false, status: 410, reason: 'batch_unavailable' }
  }

  if (invite.expiresAt < new Date()) {
    return { ok: false, status: 410, reason: 'expired' }
  }

  if (invite.used) {
    return { ok: false, status: 409, reason: 'used' }
  }

  const batch = await Batch.findOne({ batchId: invite.batchId })
  if (!batch || batch.status !== 'active') {
    return { ok: false, status: 410, reason: 'batch_unavailable' }
  }

  return { ok: true, invite, batchName: batch.name }
}

export async function claimInvite(code) {
  return Invite.findOneAndUpdate(
    {
      code,
      used: false,
      revoked: false,
      expiresAt: { $gt: new Date() },
    },
    { $set: { used: true } },
    { new: false },
  )
}
