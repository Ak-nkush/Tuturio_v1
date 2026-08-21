import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDb } from './db/connect.js'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import inviteRoutes from './routes/invite.routes.js'
import analyticsRoutes from './routes/analytics.routes.js'
import announcementRoutes from './routes/announcement.routes.js'
import assignmentRoutes from './routes/assignment.routes.js'
import attendanceRoutes from './routes/attendance.routes.js'
import batchRoutes from './routes/batch.routes.js'
import messageRoutes from './routes/message.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import progressRoutes from './routes/progress.routes.js'
import resourceRoutes from './routes/resource.routes.js'
import sessionRoutes from './routes/session.routes.js'
import userRoutes from './routes/user.routes.js'
import subjectRoutes from './routes/subject.routes.js'
import { initSocket } from './services/socketService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.clientUrl,
    credentials: true,
  },
})

initSocket(io)


app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  }),
)
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRoutes)
app.use('/api/invites', inviteRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/assignments', assignmentRoutes)
app.use('/api/attendance', attendanceRoutes)
app.use('/api/batches', batchRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/resources', resourceRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/subjects', subjectRoutes)
app.use('/api/users', userRoutes)

async function start() {
  await connectDb()
  httpServer.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`)
  })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
