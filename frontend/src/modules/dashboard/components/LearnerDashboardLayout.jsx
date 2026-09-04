import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { GrainOverlay } from '../../../components/layout/GrainOverlay'
import { BrandLogo } from '../../../components/brand/BrandLogo'
import { useAuth } from '../../../context/AuthContext'
import { useSocket } from '../../../context/SocketContext'
import { messageApi, notificationApi } from '../../../lib/api'
import '../../../styles/dashboard.css'
import '../../../styles/auth.css'

const TAB_TO_PATH = {
  home: '',
  calendar: '/calendar',
  work: '/attendance',
  assignments: '/assignments',
  materials: '/materials',
  chat: '/chat',
  alerts: '/notifications',
}

export function LearnerDashboardLayout({ role }) {
  const { user, logout, refreshUser } = useAuth()
  const socket = useSocket()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [unreadNotes, setUnreadNotes] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)

  const base = role === 'parent' ? '/parent/dashboard' : '/student/dashboard'
  const child = searchParams.get('child') || ''

  function href(suffix) {
    const path = `${base}${suffix}`
    if (role === 'parent' && child) return `${path}?child=${encodeURIComponent(child)}`
    return path
  }

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
    const tab = searchParams.get('tab')
    if (!tab || !TAB_TO_PATH[tab]) return
    const next = new URLSearchParams(searchParams)
    next.delete('tab')
    const qs = next.toString()
    navigate(`${base}${TAB_TO_PATH[tab]}${qs ? `?${qs}` : ''}`, { replace: true })
  }, [searchParams, base, navigate])

  useEffect(() => {
    if (!socket) return
    const bump = () => refreshBadges().catch(() => {})
    socket.on('message:received', bump)
    socket.on('notification:new', bump)
    return () => {
      socket.off('message:received', bump)
      socket.off('notification:new', bump)
    }
  }, [socket])

  const links = role === 'parent'
    ? [
        { to: href(''), end: true, icon: '⌂', label: 'Home' },
        { to: href('/calendar'), icon: '▦', label: 'Calendar' },
        { to: href('/attendance'), icon: '◷', label: 'Attendance' },
        { to: href('/assignments'), icon: '✎', label: 'Assignments' },
        { to: href('/chat'), icon: '✉', label: 'Messages', badge: unreadChats },
        { to: href('/notifications'), icon: '●', label: 'Updates', badge: unreadNotes },
        { to: href('/settings'), icon: '⚙', label: 'Settings' },
      ]
    : [
        { to: href(''), end: true, icon: '✧', label: 'My classes' },
        { to: href('/calendar'), icon: '▦', label: 'Calendar' },
        { to: href('/attendance'), icon: '◷', label: 'My attendance' },
        { to: href('/assignments'), icon: '✎', label: 'Assignments' },
        { to: href('/materials'), icon: '▤', label: 'My notes' },
        { to: href('/chat'), icon: '✉', label: 'Tutor chat', badge: unreadChats },
        { to: href('/notifications'), icon: '●', label: 'Notifications', badge: unreadNotes },
        { to: href('/settings'), icon: '⚙', label: 'Settings' },
      ]

  return (
    <div className={`dashboard-layout learner-shell role-${role}`}>
      <GrainOverlay />
      <aside className={`dashboard-sidebar sidebar-${role}`}>
        <div className="sidebar-header">
          <BrandLogo to={base} size="md" />
          <div className="user-profile">
            <span className="user-avatar">
              {user?.profilePictureUrl ? (
                <img src={user.profilePictureUrl} alt="" />
              ) : (
                user?.name?.charAt(0).toUpperCase()
              )}
            </span>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className={`user-role ${role}`}>{role === 'parent' ? 'Parent' : 'Student'}</span>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={Boolean(link.end)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
              {link.badge > 0 && <span className="nav-badge">{link.badge > 99 ? '99+' : link.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="logout-button" onClick={() => logout()}>
            Log Out
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <div className="dashboard-content-wrap">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
