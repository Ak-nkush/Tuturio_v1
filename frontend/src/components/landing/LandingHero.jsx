function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

export function LandingHero() {
  return (
    <header className="hero">
      <div className="wrap">
        <h1>
          Everything the WhatsApp
          <br />
          group did. Minus the numbers.
        </h1>
        <div className="squiggle-wrap">
          <svg className="squiggle" width="220" height="20" viewBox="0 0 220 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path
              d="M4 14 Q 30 2, 55 12 T 110 10 T 165 12 T 216 8"
              stroke="var(--chalk)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="sub">
          One private space for a tutor&apos;s batches — attendance, notes, progress and chat — where students and
          parents join by invite link only.
        </p>
        <div className="badge">
          <LockIcon />
          No phone numbers ever shared between tutor, students, or parents
        </div>
      </div>
    </header>
  )
}
