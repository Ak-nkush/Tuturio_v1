import { Link } from 'react-router-dom'

function StudentScene() {
  return (
    <svg className="scene" viewBox="0 0 160 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="55" y="14" width="50" height="66" rx="8" fill="none" stroke="var(--student)" strokeWidth="2.2" />
      <line x1="70" y1="70" x2="90" y2="70" stroke="var(--student)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="80" cy="45" r="4" fill="var(--student)" />
      <circle cx="80" cy="45" r="4" fill="none" stroke="var(--student)" strokeWidth="1.6">
        <animate attributeName="r" values="4;24" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0" dur="3s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

function TeacherScene() {
  return (
    <svg className="scene" viewBox="0 0 160 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="8" width="140" height="70" rx="4" fill="none" stroke="var(--teacher)" strokeWidth="2" opacity="0.35" />
      <path
        id="writeLine1"
        className="write-path"
        d="M26 32 Q45 18 62 30 T96 28 T128 34"
        fill="none"
        stroke="var(--teacher)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        id="writeLine2"
        className="write-path"
        d="M26 52 Q48 44 70 54 T118 50"
        fill="none"
        stroke="var(--teacher)"
        strokeWidth="3"
        strokeLinecap="round"
        style={{ animationDelay: '0.5s' }}
      />
      <circle r="4" fill="var(--teacher)">
        <animateMotion
          dur="4s"
          repeatCount="indefinite"
          keyPoints="0;1;1;0;0"
          keyTimes="0;0.4;0.55;0.95;1"
          calcMode="linear"
        >
          <mpath href="#writeLine1" />
        </animateMotion>
      </circle>
    </svg>
  )
}

function ParentScene() {
  return (
    <svg className="scene" viewBox="0 0 160 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="55" cy="30" r="10" fill="none" stroke="var(--parent)" strokeWidth="2.2" />
      <path d="M55 40 C40 44 38 60 40 74" fill="none" stroke="var(--parent)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="98" cy="44" r="7" fill="none" stroke="var(--parent)" strokeWidth="2.2" />
      <path d="M98 51 C91 54 90 64 92 74" fill="none" stroke="var(--parent)" strokeWidth="2.2" strokeLinecap="round" />
      <path className="arm-path" d="M46 52 Q72 46 91 52" fill="none" stroke="var(--parent)" strokeWidth="2.4" strokeLinecap="round" />
      <path
        className="heart"
        d="M70 14 c-2-4 -8-4 -8 1 c0 5 8 9 8 9 s8-4 8-9 c0-5 -6-5 -8-1z"
        fill="var(--parent)"
      />
    </svg>
  )
}

const roleCards = [
  {
    id: 'student',
    scene: <StudentScene />,
    eyebrow: 'For Students',
    title: 'Join with one link. That\u2019s it.',
    description:
      'No app to hunt for, no group to get lost in. Tap your tutor\u2019s invite link, see your batch schedule, download notes, and check your own attendance and scores.',
    cta: 'I have an invite link',
    to: '/auth/login',
  },
  {
    id: 'teacher',
    scene: <TeacherScene />,
    eyebrow: 'For Tutors',
    title: 'Run your batches, not a group chat.',
    description:
      'Create batches, mark attendance in seconds, log scores and remarks, and message every student or parent privately — without ever handing out your number.',
    cta: 'Tutor log in',
    to: '/auth/login',
  },
  {
    id: 'parent',
    scene: <ParentScene />,
    eyebrow: 'For Parents',
    title: 'Every child, one dashboard.',
    description:
      'Switch between kids in one place — attendance, assignments and progress for each, plus a private line to the tutor. Their one-on-one chat with the tutor stays theirs.',
    cta: 'I have an invite link',
    to: '/auth/login',
  },
]

export function RoleCards() {
  return (
    <section className="desks">
      <div className="wrap desk-grid">
        {roleCards.map((card) => (
          <article key={card.id} className="card fade-up" id={card.id}>
            {card.scene}
            <span className="eyebrow">{card.eyebrow}</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <Link className="cta" to={card.to}>
              {card.cta}
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
