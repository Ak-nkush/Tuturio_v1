import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useSocket } from '../../../context/SocketContext'
import { messageApi, notificationApi } from '../../../lib/api'
import { DashboardShell } from './DashboardShell'
import '../../../styles/dashboard.css'
import '../../../styles/auth.css'

export function TutorDashboardLayout() {
  const { user, logout, refreshUser } = useAuth()
  const socket = useSocket()
  const location = useLocation()
  const [unreadNotes, setUnreadNotes] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)

  async function refreshBadges() {
    const [notes, chats] = await Promise.all([
      notificationApi.list().catch(() => ({ notifications: [] })),
      messageApi.conversations().catch(() => ({ conversations: [] })),
    ])
    setUnreadNotes((notes.notifications ?? []).filter((n) => !n.isRead).length)
    setUnreadChats((chats.conversations ?? []).reduce((sum, c) => sum + (c.unread ?? 0), 0))
  }

  useEffect(() => {
    refreshUser().catch(() => {})
  }, [refreshUser])

  useEffect(() => {
    refreshBadges().catch(() => {})
  }, [location.pathname])

  useEffect(() => {
    if (!socket) return
    const bump = () => refreshBadges().catch(() => {})
    socket.on('message:received', bump)
    socket.on('message:sent', bump)
    socket.on('messages:read', bump)
    socket.on('notification:new', bump)
    return () => {
      socket.off('message:received', bump)
      socket.off('message:sent', bump)
      socket.off('messages:read', bump)
      socket.off('notification:new', bump)
    }
  }, [socket])

  const links = [
    { to: '/tutor/dashboard', end: true, icon: '✧', label: 'Overview' },
    { to: '/tutor/dashboard/calendar', icon: '▦', label: 'Calendar' },
    { to: '/tutor/dashboard/batches', icon: '⚄', label: 'Batches' },
    { to: '/tutor/dashboard/students', icon: '☺', label: 'Students' },
    { to: '/tutor/dashboard/chat', icon: '✉', label: 'Chat', badge: unreadChats },
    { to: '/tutor/dashboard/notifications', icon: '●', label: 'Notifications', badge: unreadNotes },
    { to: '/tutor/dashboard/settings', icon: '⚙', label: 'Settings' },
  ]

  return (
    <DashboardShell
      role="tutor"
      homeTo="/tutor/dashboard"
      user={user}
      onLogout={logout}
      links={links}
    />
  )
}
