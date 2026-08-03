import { Link } from 'react-router-dom'

function LogoIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="4" width="26" height="18" rx="2" stroke="var(--chalk)" strokeWidth="1.6" />
      <path d="M6 9 h10 M6 13 h14 M6 17 h8" stroke="var(--chalk)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

export function LandingNavbar() {
  return (
    <nav className="landing-nav">
      <div className="nav-inner">
        <Link to="/" className="logo">
          <LogoIcon />
          Tuturio
        </Link>
        <div className="roletabs">
          <a className="student" href="#student">
            I&apos;m a Student
          </a>
          <a className="teacher" href="#teacher">
            I&apos;m a Tutor
          </a>
          <a className="parent" href="#parent">
            I&apos;m a Parent
          </a>
        </div>
      </div>
    </nav>
  )
}
