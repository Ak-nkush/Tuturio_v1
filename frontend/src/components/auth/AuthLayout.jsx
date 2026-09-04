import { useEffect, useState } from 'react'
import { GrainOverlay } from '../layout/GrainOverlay'
import { BrandLogo } from '../brand/BrandLogo'
import '../../styles/auth.css'

const loginScenes = [
  {
    id: 'tutor',
    title: 'For Tutors',
    subtitle: 'Run batches, notes, attendance, and progress from one calm dashboard.',
  },
  {
    id: 'student',
    title: 'For Students',
    subtitle: 'Join your batch, find class materials, and keep up with your progress.',
  },
  {
    id: 'parent',
    title: 'For Parents',
    subtitle: 'Track attendance, notes, and progress without noisy group chats.',
  },
]

function TutorScene() {
  return (
    <svg className="login-illustration" viewBox="0 0 440 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="218" cy="174" r="138" fill="#25483F" />
      <path d="M93 170c31-71 122-108 202-57" stroke="#6FB6C1" strokeWidth="9" strokeLinecap="round" />
      <path d="M76 308h300" stroke="#F4F1E6" strokeWidth="2" strokeLinecap="round" />
      <rect x="126" y="84" width="204" height="126" rx="8" fill="#19332D" stroke="#F4F1E6" strokeWidth="2.4" />
      <path d="M154 126h83M154 154h128M154 181h82" stroke="#6FB6C1" strokeWidth="5" strokeLinecap="round" />
      <path d="M303 103l19 17M324 103l-23 25" stroke="#E8A23C" strokeWidth="4" strokeLinecap="round" />
      <circle cx="150" cy="251" r="31" fill="#1D3931" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M132 290c7-27 29-38 54-22 12 8 19 22 20 40h-83c1-7 4-13 9-18Z" fill="#6FB6C1" stroke="#F4F1E6" strokeWidth="2" />
      <circle cx="290" cy="244" r="28" fill="#1D3931" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M260 308c5-42 54-57 82-20 5 6 8 13 9 20h-91Z" fill="#E8A23C" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M224 222c28 4 51 17 70 40" stroke="#F4F1E6" strokeWidth="3" strokeLinecap="round" />
      <path d="M116 65a23 23 0 1 0 46 0 23 23 0 0 0-46 0Z" stroke="#B9C2BC" strokeWidth="2" />
      <path d="M139 51v17l13-8" stroke="#F4F1E6" strokeWidth="2" strokeLinecap="round" />
      <path d="M348 84a20 20 0 1 0 40 0 20 20 0 0 0-40 0Z" stroke="#B9C2BC" strokeWidth="2" />
      <path d="M362 75l10 9-10 10M96 126l10 10M106 126l-10 10M336 240l17-11 5 20-22-9Z" stroke="#B9C2BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StudentScene() {
  return (
    <svg className="login-illustration" viewBox="0 0 440 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="226" cy="176" r="140" fill="#25483F" />
      <path d="M99 160c27-69 106-112 188-70" stroke="#8FD4A8" strokeWidth="9" strokeLinecap="round" />
      <path d="M76 308h300" stroke="#F4F1E6" strokeWidth="2" strokeLinecap="round" />
      <path d="M126 251c-26-3-37-22-40-43 24 7 40 19 40 43Z" fill="#8FD4A8" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M116 251c-6-20 1-38 16-53 12 22 10 39-16 53Z" fill="#1D3931" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M111 251v31" stroke="#F4F1E6" strokeWidth="2" strokeLinecap="round" />
      <path d="M88 282h54l-5 26H93l-5-26Z" fill="#132723" stroke="#F4F1E6" strokeWidth="1.6" />
      <path d="M155 144l84-20 31 130-84 20-31-130Z" fill="#F4F1E6" stroke="#132723" strokeWidth="2" />
      <path d="M179 166l51-12M183 181l61-15M187 198l42-10M192 218l56-13M196 235l39-9" stroke="#132723" strokeWidth="2" strokeLinecap="round" />
      <path d="M225 116h74a7 7 0 0 1 7 7v38a7 7 0 0 1-7 7h-23l-15 18v-18h-36a7 7 0 0 1-7-7v-38a7 7 0 0 1 7-7Z" fill="#F4F1E6" stroke="#B9C2BC" strokeWidth="2" />
      <circle cx="248" cy="137" r="8" fill="#8FD4A8" />
      <circle cx="270" cy="141" r="8" fill="#8FD4A8" />
      <path d="M298 204h74a10 10 0 0 1 10 10v88h-84v-98Z" fill="#8FD4A8" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M282 142c-10-14-35-12-45 6-8 13-2 28 12 33 15 6 35-5 41-20 2-6 0-14-8-19Z" fill="#132723" />
      <path d="M245 178c-23 12-38 41-31 82h57c12-32 9-61-26-82Z" fill="#F4F1E6" stroke="#132723" strokeWidth="2" />
      <path d="M241 198l-18 54M255 199l12 53" stroke="#132723" strokeWidth="2" strokeLinecap="round" />
      <path d="M215 260c-4 24-10 39-19 48h42l15-48h-38ZM271 260c4 21 14 37 31 48h42c-17-13-26-29-31-48h-42Z" fill="#132723" />
      <path d="M205 308c-17 0-28 4-34 12h55l12-12h-33ZM312 308c-8 4-12 9-13 15h59c-3-8-10-13-22-15h-24Z" fill="#8FD4A8" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M129 83a24 24 0 1 0 48 0 24 24 0 0 0-48 0Z" stroke="#B9C2BC" strokeWidth="2" />
      <path d="M153 67v19l15-9" stroke="#F4F1E6" strokeWidth="2" strokeLinecap="round" />
      <path d="M371 90l10 9-10 10M118 130l10 10M128 130l-10 10M333 81l11-13 19 4-10 15" stroke="#B9C2BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ParentScene() {
  return (
    <svg className="login-illustration" viewBox="0 0 440 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="220" cy="176" r="140" fill="#25483F" />
      <path d="M95 160c31-72 123-105 201-55" stroke="#C77B94" strokeWidth="9" strokeLinecap="round" />
      <path d="M78 308h300" stroke="#F4F1E6" strokeWidth="2" strokeLinecap="round" />
      <rect x="250" y="88" width="88" height="154" rx="13" fill="#19332D" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M270 120h48M270 147h32M270 174h48M270 202h30" stroke="#C77B94" strokeWidth="5" strokeLinecap="round" />
      <circle cx="160" cy="135" r="34" fill="#1D3931" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M130 226c3-47 28-74 67-62 30 9 44 34 45 72v72H125l5-82Z" fill="#F4F1E6" stroke="#132723" strokeWidth="2" />
      <circle cx="251" cy="208" r="25" fill="#1D3931" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M218 308c3-42 24-68 62-58 26 7 40 27 42 58H218Z" fill="#C77B94" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M180 225c24 24 52 34 84 30" stroke="#132723" strokeWidth="4" strokeLinecap="round" />
      <path d="M206 75c-8-14-29-12-29 5 0 20 29 34 29 34s29-14 29-34c0-17-21-19-29-5Z" fill="#C77B94" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M96 250c-22-2-33-18-36-37 22 6 35 17 36 37Z" fill="#8FD4A8" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M96 250c-4-18 3-34 17-47 10 20 7 35-17 47Z" fill="#1D3931" stroke="#F4F1E6" strokeWidth="2" />
      <path d="M94 250v58" stroke="#F4F1E6" strokeWidth="2" strokeLinecap="round" />
      <path d="M71 281h49l-5 27H76l-5-27Z" fill="#132723" stroke="#F4F1E6" strokeWidth="1.6" />
      <path d="M327 276l21-13 6 24-27-11ZM101 97l14 14M115 97l-14 14M346 112a22 22 0 1 0 44 0 22 22 0 0 0-44 0Z" stroke="#B9C2BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoginIllustration({ scene }) {
  if (scene.id === 'tutor') return <TutorScene />
  if (scene.id === 'parent') return <ParentScene />
  return <StudentScene />
}

function LoginBrand() {
  return <BrandLogo className="login-brand" size="lg" />
}

export function AuthLayout({ title, subtitle, children, variant = 'default' }) {
  const [activeScene, setActiveScene] = useState(0)

  useEffect(() => {
    if (variant !== 'login') return undefined

    const interval = window.setInterval(() => {
      setActiveScene((current) => (current + 1) % loginScenes.length)
    }, 4200)

    return () => window.clearInterval(interval)
  }, [variant])

  if (variant === 'login') {
    const scene = loginScenes[activeScene]

    return (
      <main className="login-template-page">
        <section className="login-template-card">
          <div className={`login-template-art ${scene.id}`}>
            <LoginIllustration scene={scene} />
            <div className="login-copy">
              <span>{scene.title}</span>
              <h1>{title}</h1>
              {subtitle && <p>{scene.subtitle || subtitle}</p>}
              <div className="login-dots" aria-hidden="true">
                {loginScenes.map((item, index) => (
                  <span key={item.id} className={index === activeScene ? 'active' : ''} />
                ))}
              </div>
            </div>
          </div>
          <div className="login-template-form">
            <div className="login-form-inner">
              <LoginBrand />
              {children}
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <div className="auth-page">
      <GrainOverlay />
      <nav className="landing-nav">
        <div className="nav-inner">
          <BrandLogo to="/" className="logo" size="md" />
        </div>
      </nav>
      <main className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  )
}
