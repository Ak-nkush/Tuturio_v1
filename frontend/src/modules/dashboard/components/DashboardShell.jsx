import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { GrainOverlay } from '../../../components/layout/GrainOverlay'
import { BrandLogo } from '../../../components/brand/BrandLogo'

const ROLE_LABEL = {
  tutor: 'Tutor',
  student: 'Student',
  parent: 'Parent',
}

export function DashboardShell({ role, homeTo, user, onLogout, links }) {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.classList.toggle('dashboard-nav-lock', navOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('dashboard-nav-lock')
    }
  }, [navOpen])

  const roleLabel = ROLE_LABEL[role] ?? role

  return (
    <div className={`dashboard-layout role-${role}${role !== 'tutor' ? ' learner-shell' : ''}${navOpen ? ' is-nav-open' : ''}`}>
      <GrainOverlay />
      <header className="dashboard-topbar">
        <button
          type="button"
          className="nav-menu-btn"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
        <BrandLogo to={homeTo} size="sm" />
        <span className={`topbar-role ${role}`}>{roleLabel}</span>
      </header>
      <button
        type="button"
        className="nav-backdrop"
        aria-label="Close menu"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />
      <aside className={`dashboard-sidebar sidebar-${role}`}>
        <div className="sidebar-header">
          <BrandLogo to={homeTo} size="md" />
          <div className="user-profile">
            <span className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className={`user-role ${role}`}>{roleLabel}</span>
            </div>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.label}
              to={link.to}
              end={Boolean(link.end)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setNavOpen(false)}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
              {link.badge > 0 && <span className="nav-badge">{link.badge > 99 ? '99+' : link.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="logout-button" onClick={() => onLogout()}>
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
