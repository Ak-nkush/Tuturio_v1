import dotenv from 'dotenv'

dotenv.config()

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri: required('MONGODB_URI'),
  clientUrl: required('CLIENT_URL'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY ?? '15m',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY ?? '7d',
  inviteDefaultExpiryDays: Number(process.env.INVITE_DEFAULT_EXPIRY_DAYS ?? 7),
  tutorEmail: process.env.TUTOR_EMAIL ?? 'tutor@tuturio.local',
  tutorPassword: process.env.TUTOR_PASSWORD ?? 'MeeraJoshi8',
  tutorName: process.env.TUTOR_NAME ?? 'Meera Joshi',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Tuturio <noreply@tuturio.local>',
  isDev: process.env.NODE_ENV !== 'production',
  storageProvider: process.env.STORAGE_PROVIDER ?? (process.env.NODE_ENV === 'production' ? 'cloudinary' : 'local'),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY ?? '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  fileScanUrl: process.env.FILE_SCAN_URL ?? '',
}

if (!['local', 'cloudinary'].includes(env.storageProvider)) {
  throw new Error('STORAGE_PROVIDER must be local or cloudinary')
}
if (!env.isDev && env.storageProvider !== 'cloudinary') {
  throw new Error('Production requires STORAGE_PROVIDER=cloudinary')
}
if (env.storageProvider === 'cloudinary' && (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret)) {
  throw new Error('Cloudinary credentials are required when STORAGE_PROVIDER=cloudinary')
}
