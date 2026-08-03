import { Link } from 'react-router-dom'

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="wrap">
        <h3>Ready to bring your classroom together?</h3>
        <Link className="foot-cta" to="/auth/login">
          Tutor log in
        </Link>
        <div className="foot-links">
          <a href="#student">I&apos;m a student →</a>
          <a href="#teacher">I&apos;m a teacher →</a>
          <a href="#parent">I&apos;m a parent →</a>
        </div>
      </div>
    </footer>
  )
}
