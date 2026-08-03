const testimonials = [
  {
    role: 'student',
    quote:
      'I just tap the link my tutor sent. No more scrolling through fifty messages to find yesterday\u2019s notes.',
    who: '— 10th grade student',
  },
  {
    role: 'teacher',
    quote:
      'I closed five WhatsApp groups and my attendance notebook the same week. Everything\u2019s in one place now.',
    who: '— Independent tutor',
  },
  {
    role: 'parent',
    quote: 'I can check both my kids\u2019 attendance and scores without pinging the tutor to ask.',
    who: '— Parent of two',
  },
]

export function Testimonials() {
  return (
    <section className="board">
      <div className="wrap">
        <div className="board-title">
          <h3>Pinned to the corkboard</h3>
          <span>What people in each seat actually say</span>
        </div>
        <div className="notes">
          {testimonials.map((note) => (
            <div key={note.role} className={`note ${note.role}`}>
              <span className="pin" />
              <p className="quote">{note.quote}</p>
              <div className="who">{note.who}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
