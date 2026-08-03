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
  tutorPassword: process.env.TUTOR_PASSWORD ?? 'ChangeMeNow123456!',
  tutorName: process.env.TUTOR_NAME ?? 'Demo Tutor',
  isDev: process.env.NODE_ENV !== 'production',
}
