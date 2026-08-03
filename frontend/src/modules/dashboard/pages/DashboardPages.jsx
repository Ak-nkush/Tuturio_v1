import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GrainOverlay } from '../../../components/layout/GrainOverlay'
import { useAuth } from '../../../context/AuthContext'
import { inviteApi } from '../../../lib/api'
import '../../../styles/auth.css'

function DashboardShell({ title, description, children }) {
  const { user, logout } = useAuth()

  return (
    <div className="dashboard-page">
      <GrainOverlay />
      <div className="wrap dashboard-wrap">
        <div className="dashboard-header">
          <div>
            <h1>{title}</h1>
            <p>{description}</p>
            {user && (
              <p className="signed-in">
                Signed in as {user.name} ({user.email})
              </p>
            )}
          </div>
          <div className="dashboard-actions">
            <Link to="/">Home</Link>
            <button type="button" onClick={() => logout()}>
              Log out
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function InviteLinkCard({ label, inviteUrl, email, code }) {
  const [copied, setCopied] = useState(false)
  const [sendState, setSendState] = useState('idle')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function sendEmail() {
    if (sendState === 'sending') return
    setSendState('sending')
    try {
      await inviteApi.send(code)
      setSendState('sent')
      window.setTimeout(() => setSendState('idle'), 3000)
    } catch (err) {
      console.error(err)
      setSendState('error')
      window.setTimeout(() => setSendState('idle'), 3000)
    }
  }

  return (
    <article className="invite-link-card">
      <div>
        <span>{label}</span>
        {email && <p>Locked to {email}</p>}
      </div>
      <input value={inviteUrl} readOnly aria-label={`${label} invite link`} />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button type="button" onClick={copyLink}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {email && (
          <button type="button" onClick={sendEmail} disabled={sendState === 'sending'}>
            {sendState === 'idle' ? 'Send email' : sendState === 'sending' ? 'Sending...' : sendState === 'sent' ? 'Sent!' : 'Failed'}
          </button>
        )}
      </div>
    </article>
  )
}

export function TutorDashboardPage() {
  const [batches, setBatches] = useState([])
  const [batchId, setBatchId] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [expiryDays, setExpiryDays] = useState('7')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [invitePair, setInvitePair] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    inviteApi
      .batches()
      .then((res) => {
        setBatches(res.batches)
        setBatchId(res.batches[0]?.batchId ?? '')
        setStatus('ready')
      })
      .catch((err) => {
        setError(err?.message ?? 'Could not load batches')
        setStatus('error')
      })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInvitePair(null)
    setSubmitting(true)

    try {
      const res = await inviteApi.createPaired({
        batchId,
        studentEmail: studentEmail.trim(),
        parentEmail: parentEmail.trim(),
        expiryDays: Number(expiryDays),
      })
      setInvitePair(res)
    } catch (err) {
      setError(err?.message ?? 'Could not create invite links')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell
      title="Tutor dashboard"
      description="Generate paired invite links for a student and their parent from one form."
    >
      <section className="invite-panel">
        <div className="invite-panel-copy">
          <span className="role-badge student">Module 1</span>
          <h2>Generate invite links</h2>
          <p>
            Choose a batch, optionally lock each link to an email, then send the student and parent their
            own single-use links.
          </p>
        </div>

        <form className="invite-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label htmlFor="batch">Batch</label>
            <select
              id="batch"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={status !== 'ready' || batches.length === 0}
              required
            >
              {batches.length === 0 && <option value="">No active batches found</option>}
              {batches.map((batch) => (
                <option key={batch.batchId} value={batch.batchId}>
                  {batch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="invite-grid">
            <div className="auth-field">
              <label htmlFor="student-email">Student email</label>
              <input
                id="student-email"
                type="email"
                value={studentEmail}
                onChange={(e) => setStudentEmail(e.target.value)}
                placeholder="student@example.com"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="parent-email">Parent email</label>
              <input
                id="parent-email"
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@example.com"
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="expiry">Link expiry</label>
            <select id="expiry" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)}>
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>

          <button type="submit" className="auth-btn" disabled={submitting || !batchId}>
            {submitting ? 'Creating links…' : 'Create student + parent links'}
          </button>
        </form>
      </section>

      {invitePair && (
        <section className="invite-results" aria-live="polite">
          <div>
            <h2>Links ready</h2>
            <p>
              Batch: {invitePair.batch.name}. Student ID reserved: {invitePair.linkedStudentId}.
            </p>
          </div>
          <div className="invite-result-grid">
            <InviteLinkCard
              label="Student invite"
              inviteUrl={invitePair.student.inviteUrl}
              email={invitePair.student.invite.email}
              code={invitePair.student.invite.code}
            />
            <InviteLinkCard
              label="Parent invite"
              inviteUrl={invitePair.parent.inviteUrl}
              email={invitePair.parent.invite.email}
              code={invitePair.parent.invite.code}
            />
          </div>
        </section>
      )}
    </DashboardShell>
  )
}

export function StudentDashboardPage() {
  return (
    <DashboardShell
      title="My batches"
      description="Your enrolled batches, schedule, notes, and attendance will appear here in upcoming modules."
    />
  )
}

export function ParentDashboardPage() {
  return (
    <DashboardShell
      title="Parent dashboard"
      description="Multiple student links now attach to one parent account. The child switcher UI lands in Module 8."
    />
  )
}
