import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { v2 as cloudinary } from 'cloudinary'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localRoot = path.join(__dirname, '../../uploads/private')

if (env.storageProvider === 'cloudinary') {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  })
}

function safeName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
}

function localPath(key) {
  const normalized = path.normalize(key).replace(/^([/\\])+/, '')
  const target = path.resolve(localRoot, normalized)
  if (!target.startsWith(path.resolve(localRoot) + path.sep)) throw new Error('Invalid storage key')
  return target
}

export async function storeFile({ buffer, originalName, mimeType, folder }) {
  if (!buffer?.length) throw new Error('File is empty')

  if (env.storageProvider === 'cloudinary') {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `tuturio/${folder}`, resource_type: 'raw', type: 'authenticated' },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
      )
      stream.end(buffer)
    })
    return { storageKey: result.public_id, provider: 'cloudinary' }
  }

  const storageKey = `${folder}/${crypto.randomUUID()}-${safeName(originalName)}`
  const target = localPath(storageKey)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, buffer)
  return { storageKey, provider: 'local', mimeType }
}

export async function scanFile(buffer, mimeType) {
  if (!env.fileScanUrl) return { clean: true }
  const response = await fetch(env.fileScanUrl, {
    method: 'POST',
    headers: { 'Content-Type': mimeType || 'application/octet-stream' },
    body: buffer,
  })
  if (!response.ok) throw new Error('File failed the security scan')
  const text = await response.text()
  if (text) {
    try {
      const body = JSON.parse(text)
      if (body.clean === false) throw new Error('File failed the security scan')
    } catch (err) {
      if (err.message === 'File failed the security scan') throw err
    }
  }
  return { clean: true }
}

export async function sendStoredFile(res, { storageKey, fileName, mimeType }) {
  if (env.storageProvider === 'cloudinary') {
    const url = cloudinary.url(storageKey, {
      resource_type: 'raw',
      type: 'authenticated',
      sign_url: true,
      secure: true,
      expires_at: Math.floor(Date.now() / 1000) + 60,
    })
    return res.redirect(url)
  }

  try {
    return res.download(localPath(storageKey), fileName, { headers: { 'Content-Type': mimeType || 'application/octet-stream' } })
  } catch {
    return res.status(404).json({ error: 'File not found' })
  }
}

export async function deleteStoredFile(storageKey) {
  if (!storageKey) return
  if (env.storageProvider === 'cloudinary') {
    await cloudinary.uploader.destroy(storageKey, { resource_type: 'raw', type: 'authenticated' })
    return
  }
  await fs.rm(localPath(storageKey), { force: true })
}
