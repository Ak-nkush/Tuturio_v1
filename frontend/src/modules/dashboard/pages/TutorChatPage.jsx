import { useEffect, useMemo, useRef, useState } from 'react'
import { messageApi } from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'
import { useSocket } from '../../../context/SocketContext'
import '../../../styles/dashboard.css'

function personKind(person) {
  if (person?.type === 'tutor_parent' || person?.role === 'parent') return 'parent'
  return 'student'
}

function threadLabel(person, isLearner) {
  if (!person) return ''
  if (isLearner) return 'Your tutor'
  return personKind(person) === 'parent' ? 'Parent' : 'Student'
}

function tickState(message) {
  if (message.isRead) return 'read'
  if (message.isDelivered) return 'delivered'
  return 'sent'
}

function MessageTicks({ message }) {
  const state = tickState(message)
  const label = state === 'read' ? 'Read' : state === 'delivered' ? 'Delivered' : 'Sent'
  return (
    <span className={`chat-ticks ${state}`} title={label} aria-label={label}>
      {state === 'sent' ? '✓' : '✓✓'}
    </span>
  )
}

function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function TutorChatPage({ embedded = false }) {
  const { user } = useAuth()
  const isLearner = user?.role === 'student' || user?.role === 'parent'
  const [contacts, setContacts] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [roleFilter, setRoleFilter] = useState('all')
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  async function loadLists() {
    const [c, v] = await Promise.all([messageApi.contacts(), messageApi.conversations()])
    setContacts(c.contacts ?? [])
    setConversations(v.conversations ?? [])
  }

  async function loadThread(userId) {
    if (!userId) return
    setConversations((current) =>
      current.map((row) => (row.userId === userId ? { ...row, unread: 0 } : row)),
    )
    const res = await messageApi.thread(userId)
    setMessages(res.messages ?? [])
    await messageApi.markRead(userId).catch(() => {})
    await loadLists().catch(() => {})
  }

  useEffect(() => {
    loadLists().catch((err) => setError(err.message))
  }, [])

  const socket = useSocket()

  useEffect(() => {
    if (!activeId) return
    loadThread(activeId).catch((err) => setError(err.message))
  }, [activeId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, activeId])

  useEffect(() => {
    if (!socket) return

    const handleMessageReceived = (msg) => {
      if (msg.senderId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev
          return [...prev, msg]
        })
        setConversations((current) =>
          current.map((row) => (row.userId === activeId ? { ...row, unread: 0 } : row)),
        )
        messageApi.markRead(activeId).catch(() => {})
      }
      loadLists().catch(() => {})
    }

    const handleMessageSent = (msg) => {
      if (msg.receiverId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev
          return [...prev, msg]
        })
      }
      loadLists().catch(() => {})
    }

    const handleMessagesDelivered = (payload) => {
      if (payload.recipientId === activeId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.userId ? { ...m, isDelivered: true } : m,
          ),
        )
      }
    }

    const handleMessagesRead = (payload) => {
      if (payload.readerId === activeId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.userId ? { ...m, isRead: true, isDelivered: true } : m,
          ),
        )
      }
      loadLists().catch(() => {})
    }

    socket.on('message:received', handleMessageReceived)
    socket.on('message:sent', handleMessageSent)
    socket.on('messages:delivered', handleMessagesDelivered)
    socket.on('messages:read', handleMessagesRead)

    return () => {
      socket.off('message:received', handleMessageReceived)
      socket.off('message:sent', handleMessageSent)
      socket.off('messages:delivered', handleMessagesDelivered)
      socket.off('messages:read', handleMessagesRead)
    }
  }, [socket, activeId, user])

  const people = useMemo(() => {
    const byId = new Map()
    contacts.forEach((c) => byId.set(c.userId, { ...c, unread: 0, lastMessage: '' }))
    conversations.forEach((c) => {
      const existing = byId.get(c.userId) ?? { userId: c.userId, name: c.name, role: 'student' }
      byId.set(c.userId, { ...existing, ...c })
    })
    return [...byId.values()].sort((a, b) => {
      const unreadDiff = Number(b.unread ?? 0) - Number(a.unread ?? 0)
      if (unreadDiff) return unreadDiff
      return String(a.name).localeCompare(String(b.name))
    })
  }, [contacts, conversations])

  const visiblePeople = useMemo(() => {
    if (isLearner || roleFilter === 'all') return people
    return people.filter((person) => personKind(person) === roleFilter)
  }, [people, roleFilter, isLearner])

  const filterCounts = useMemo(() => ({
    all: people.length,
    student: people.filter((person) => personKind(person) === 'student').length,
    parent: people.filter((person) => personKind(person) === 'parent').length,
  }), [people])

  const unreadByFilter = useMemo(() => ({
    student: people.filter((person) => personKind(person) === 'student').reduce((sum, person) => sum + (person.unread ?? 0), 0),
    parent: people.filter((person) => personKind(person) === 'parent').reduce((sum, person) => sum + (person.unread ?? 0), 0),
  }), [people])

  useEffect(() => {
    if (!activeId) return
    if (!visiblePeople.some((person) => person.userId === activeId)) {
      setActiveId('')
      setMessages([])
    }
  }, [roleFilter, visiblePeople, activeId])

  const activePerson = people.find((person) => person.userId === activeId)

  async function send(e) {
    e.preventDefault()
    if (!activeId || (!draft.trim() && files.length === 0)) return
    try {
      setSending(true)
      await messageApi.send({ receiverId: activeId, content: draft.trim(), files })
      setDraft('')
      setFiles([])
      await loadThread(activeId)
      await loadLists()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  function onDraftKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <div className="chat-page">
      {!embedded && (
        <div className="dashboard-header chat-page-header">
          <div>
            <span className="eyebrow">Private</span>
            <h1>Chat</h1>
            <p>
              {isLearner
                ? 'Private messages with your tutor only.'
                : 'Message students and parents. Students and parents cannot message each other.'}
            </p>
          </div>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      <div className="chat-layout">
        <aside className="chat-list premium-card">
          {!isLearner && (
            <div className="chat-filter" role="tablist" aria-label="Filter conversations">
              {[
                { id: 'all', label: 'All' },
                { id: 'student', label: 'Students' },
                { id: 'parent', label: 'Parents' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={roleFilter === option.id}
                  className={`chat-filter-btn ${roleFilter === option.id ? 'active' : ''}`}
                  onClick={() => setRoleFilter(option.id)}
                >
                  {option.label}
                  <span className="chat-filter-count">{filterCounts[option.id]}</span>
                  {option.id !== 'all' && unreadByFilter[option.id] > 0 && (
                    <span className="chat-unread">{unreadByFilter[option.id] > 99 ? '99+' : unreadByFilter[option.id]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {people.length === 0 ? (
            <p className="text-muted">
              {isLearner
                ? 'No tutor conversation yet. You will see your tutor here after you join a batch.'
                : 'No contacts yet. Invite students to a batch first.'}
            </p>
          ) : visiblePeople.length === 0 ? (
            <p className="text-muted">
              {roleFilter === 'parent'
                ? 'No parent conversations yet. Invite a parent, then they can message you here.'
                : 'No student conversations in this filter.'}
            </p>
          ) : (
            visiblePeople.map((person) => (
              <button
                type="button"
                key={person.userId}
                className={`chat-person ${activeId === person.userId ? 'active' : ''}`}
                onClick={() => setActiveId(person.userId)}
              >
                <span className="chat-avatar" aria-hidden="true">{initials(person.name)}</span>
                <span className="chat-person-copy">
                  <strong>{person.name}</strong>
                  <small>{threadLabel(person, isLearner)}</small>
                  {person.lastMessage && <p>{person.lastMessage}</p>}
                </span>
                {person.unread > 0 && <span className="chat-unread">{person.unread > 99 ? '99+' : person.unread}</span>}
              </button>
            ))
          )}
        </aside>
        <section className="chat-thread premium-card">
          {!activeId ? (
            <div className="empty-state chat-empty">
              {isLearner
                ? 'Select your tutor to start a private conversation.'
                : roleFilter === 'parent'
                  ? 'Select a parent to see their messages.'
                  : roleFilter === 'student'
                    ? 'Select a student to see their messages.'
                    : 'Select a student or parent to start a private conversation.'}
            </div>
          ) : (
            <>
              <header className="chat-thread-head">
                <span className="chat-avatar" aria-hidden="true">{initials(activePerson?.name)}</span>
                <div>
                  <strong>{activePerson?.name ?? 'Conversation'}</strong>
                  <small>{threadLabel(activePerson, isLearner)}</small>
                </div>
              </header>
              <div className="chat-messages">
                {messages.length === 0 && (
                  <p className="text-muted chat-empty-thread">No messages yet. Say hello.</p>
                )}
                {messages.map((m) => (
                  <div key={m._id} className={`chat-bubble ${m.senderId === user?.userId ? 'mine' : 'theirs'}`}>
                    {m.content && <p>{m.content}</p>}
                    {(m.attachments ?? []).map((file) => (
                      <a key={file.url} href={file.url} target="_blank" rel="noreferrer">
                        {file.filename}
                      </a>
                    ))}
                    <div className="chat-meta">
                      <small>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </small>
                      {m.senderId === user?.userId && <MessageTicks message={m} />}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {files.length > 0 && (
                <ul className="chat-file-chips">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      {file.name}
                      <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <form className="chat-compose" onSubmit={send}>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onDraftKeyDown}
                  placeholder="Write a message"
                  rows={1}
                />
                <input
                  ref={fileInputRef}
                  className="chat-file-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx"
                  multiple
                  onChange={(e) => setFiles([...e.target.files])}
                />
                <button
                  type="button"
                  className="btn-outline chat-attach"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Attach
                </button>
                <button type="submit" className="btn-primary" disabled={sending}>
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
