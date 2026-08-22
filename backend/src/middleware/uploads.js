import multer from 'multer'

export const SAFE_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

export const SAFE_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function createUpload({ allowedTypes, maxFileSize, maxFiles = 1 }) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: maxFiles },
    fileFilter: (_req, file, cb) => {
      if (allowedTypes.has(file.mimetype)) cb(null, true)
      else cb(new Error('File type not allowed'))
    },
  })
}
