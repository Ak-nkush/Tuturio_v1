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

function getMimeType(fileName, fallbackMime) {
  const ext = path.extname(fileName || '').toLowerCase()
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  if (map[ext]) return map[ext]
  if (fallbackMime && fallbackMime !== 'application/octet-stream' && fallbackMime !== 'binary/octet-stream') {
    return fallbackMime
  }
  return 'application/pdf'
}

export async function sendStoredFile(res, { storageKey, fileName, mimeType }, options = {}) {
  const resolvedMime = getMimeType(fileName || storageKey, mimeType)
  const name = safeName(fileName || path.basename(storageKey) || 'document.pdf')
  const dispositionType = options.disposition || 'attachment'

  if (env.storageProvider === 'cloudinary') {
    try {
      const privateUrl = cloudinary.utils.private_download_url(storageKey, '', {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      })

      const upstream = await fetch(privateUrl)
      if (!upstream.ok) {
        console.warn(`Upstream Cloudinary fetch returned ${upstream.status}, redirecting to signed URL...`)
        return res.redirect(privateUrl)
      }

      const buffer = Buffer.from(await upstream.arrayBuffer())

      res.setHeader('Content-Type', resolvedMime)
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${name}"`)
      res.setHeader('Content-Length', buffer.length)
      return res.send(buffer)
    } catch (err) {
      console.error('Error sending Cloudinary file:', err)
      return res.status(500).json({ error: 'Failed to retrieve file from storage' })
    }
  }

  try {
    const filePath = localPath(storageKey)
    res.setHeader('Content-Type', resolvedMime)
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${name}"`)
    return res.sendFile(filePath)
  } catch (err) {
    console.error('Error sending local file:', err)
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
