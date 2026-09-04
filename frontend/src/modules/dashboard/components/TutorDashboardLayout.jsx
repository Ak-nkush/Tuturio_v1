import { NavLink, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { GrainOverlay } from '../../../components/layout/GrainOverlay'
import { BrandLogo } from '../../../components/brand/BrandLogo'
import { useAuth } from '../../../context/AuthContext'
import '../../../styles/dashboard.css'
import '../../../styles/auth.css'

export function TutorDashboardLayout() {
  const { user, logout, refreshUser } = useAuth()

  useEffect(() => {
    refreshUser().catch(() => {})
  }, [refreshUser])

  return (
    <div className="dashboard-layout">
      <GrainOverlay />
      
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <BrandLogo to="/tutor/dashboard" size="md" />
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
              <span className="user-role">Tutor</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink 
            to="/tutor/dashboard" 
            end 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">✧</span>
            <span className="nav-label">Overview</span>
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/calendar" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">▦</span>
            <span className="nav-label">Calendar</span>
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/batches" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">⚄</span>
            <span className="nav-label">Batches</span>
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/students" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">☺</span>
            <span className="nav-label">Students</span>
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/chat" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">✉</span>
            <span className="nav-label">Chat</span>
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/notifications" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">●</span>
            <span className="nav-label">Notifications</span>
          </NavLink>
          <NavLink
            to="/tutor/dashboard/settings"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">⚙</span>
            <span className="nav-label">Settings</span>
          </NavLink>
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
