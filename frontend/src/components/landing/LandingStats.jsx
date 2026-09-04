const stats = [
  {
    value: '0',
    label: 'phone numbers exchanged between tutor, student, or parent',
  },
  {
    value: '1 link',
    label: 'is all it takes for a student or parent to join a batch',
  },
  {
    value: '1 view',
    label: 'for parents to see attendance, scores and progress for every child',
  },
]

export function LandingStats() {
  return (
    <section className="stats">
      <div className="wrap">
        {stats.map((stat) => (
          <div key={stat.value} className="fade-up">
            <div className="stat-num">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
