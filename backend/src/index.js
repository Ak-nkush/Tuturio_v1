import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import { connectDb } from './db/connect.js'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import inviteRoutes from './routes/invite.routes.js'

const app = express()

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/invites', inviteRoutes)

async function start() {
  await connectDb()
  app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
