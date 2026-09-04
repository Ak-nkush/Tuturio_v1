import { Link } from 'react-router-dom'

export function BrandLogo({ to, className = '', size = 'md' }) {
  const mark = (
    <img
      src="/tuturio-wordmark.png?v=2"
      alt="Tuturio"
      className={`brand-logo-img size-${size}`}
      draggable="false"
    />
  )

  if (to) {
    return (
      <Link to={to} className={`brand-logo ${className}`} aria-label="Tuturio home">
        {mark}
      </Link>
    )
  }

  return (
    <span className={`brand-logo ${className}`} aria-label="Tuturio">
      {mark}
    </span>
  )
}
