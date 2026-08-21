import { NavLink, Outlet } from 'react-router-dom'
import { GrainOverlay } from '../../../components/layout/GrainOverlay'
import { useAuth } from '../../../context/AuthContext'
import '../../../styles/dashboard.css'

export function TutorDashboardLayout() {
  const { user, logout } = useAuth()

  return (
    <div className="dashboard-layout">
      <GrainOverlay />
      
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h2>Tuturio</h2>
          <div className="user-profile">
            <span className="user-avatar">{user?.name?.charAt(0).toUpperCase()}</span>
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
            Overview
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/batches" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">⚄</span>
            Batches
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/students" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">☺</span>
            Students
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/chat" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">✉</span>
            Chat
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/notifications" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">●</span>
            Notifications
          </NavLink>
          <NavLink 
            to="/tutor/dashboard/analytics" 
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">◈</span>
            Analytics
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
