import { BrandLogo } from '../brand/BrandLogo'

export function LandingNavbar() {
  return (
    <nav className="landing-nav">
      <div className="nav-inner">
        <BrandLogo to="/" className="logo" size="md" />
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
