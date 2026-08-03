import { customAlphabet } from 'nanoid'
import { User } from '../models/User.js'
import { Batch } from '../models/Batch.js'
import { Invite } from '../models/Invite.js'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6)

async function nextPublicId(prefix, model) {
  const count = await model.countDocuments()
  return `${prefix}-${String(count + 1).padStart(5, '0')}`
}

export async function generateUserId() {
  return nextPublicId('USR', User)
}

export function generateReservedUserId() {
  return `USR-${nanoid()}`
}

export async function generateBatchId() {
  return nextPublicId('BAT', Batch)
}

export async function generateInviteId() {
  return nextPublicId('INV', Invite)
}

export function generateInviteCode() {
  return nanoid()
}
