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

  // Pick up a file pre-attached via "Send via Chat" from SessionWorkspacePage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('chatAttachment')
      if (!stored) return
      sessionStorage.removeItem('chatAttachment')
      const { dataUrl, filename } = JSON.parse(stored)
      fetch(dataUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], filename, { type: blob.type })
          setFiles((prev) => [...prev, file])
        })
        .catch(() => {})
    } catch {
      // ignore corrupt sessionStorage entries
    }
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

  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')

  const people = useMemo(() => {
    const byId = new Map()

    if (isLearner) {
      // For learner (student/parent), list conversations and include assigned tutor
      conversations.forEach((c) => {
        byId.set(c.userId, { ...c })
      })
      contacts.forEach((c) => {
        if (!byId.has(c.userId)) {
          byId.set(c.userId, { ...c, unread: 0, lastMessage: '' })
        }
      })
    } else {
      // For tutor: ONLY show conversations that actually have messages!
      conversations.forEach((c) => {
        const contactInfo = contacts.find((item) => item.userId === c.userId)
        byId.set(c.userId, {
          ...contactInfo,
          ...c,
          name: c.name || contactInfo?.name || c.userId,
          role: c.role || contactInfo?.role || 'student',
        })
      })

      // If activeId is currently open (e.g. freshly picked via + New Chat), keep it in the list
      if (activeId && !byId.has(activeId)) {
        const contact = contacts.find((c) => c.userId === activeId)
        if (contact) {
          byId.set(activeId, {
            ...contact,
            lastMessage: '',
            unread: 0,
          })
        }
      }
    }

    return [...byId.values()].sort((a, b) => {
      const unreadDiff = Number(b.unread ?? 0) - Number(a.unread ?? 0)
      if (unreadDiff) return unreadDiff
      const dateA = a.lastAt ? new Date(a.lastAt).getTime() : 0
      const dateB = b.lastAt ? new Date(b.lastAt).getTime() : 0
      if (dateB !== dateA) return dateB - dateA
      return String(a.name).localeCompare(String(b.name))
    })
  }, [contacts, conversations, activeId, isLearner])

  const availableContacts = useMemo(() => {
    const conversationUserIds = new Set(conversations.map((c) => c.userId))
    const list = contacts.filter((c) => !conversationUserIds.has(c.userId))
    if (!newChatSearch.trim()) return list
    const q = newChatSearch.toLowerCase()
    return list.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        (c.role === 'parent' ? 'parent' : 'student').includes(q),
    )
  }, [contacts, conversations, newChatSearch])

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

  const activePerson = people.find((person) => person.userId === activeId) || contacts.find((c) => c.userId === activeId)

  function openThread(userId) {
    setActiveId(userId)
  }

  function closeThread() {
    setActiveId('')
    setMessages([])
    setDraft('')
    setFiles([])
  }

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
    <div className={`chat-page${activeId ? ' is-thread-open' : ''}`}>
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
      <div className={`chat-layout${activeId ? ' is-thread-open' : ''}`}>
        <aside className="chat-list premium-card">
          {!isLearner && (
            <div className="chat-list-top">
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
                    {(() => {
                      const totalUnread = option.id === 'all' ? (unreadByFilter.student + unreadByFilter.parent) : unreadByFilter[option.id]
                      return totalUnread > 0 ? (
                        <span className="chat-unread">{totalUnread > 99 ? '99+' : totalUnread}</span>
                      ) : null
                    })()}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="chat-new-btn"
                onClick={() => setNewChatOpen(true)}
                title="Start a new chat with an enrolled student or parent"
              >
                + New Chat
              </button>
            </div>
          )}
          {people.length === 0 ? (
            <div className="chat-empty-sidebar">
              <p className="text-muted">
                {isLearner
                  ? 'No tutor conversation yet. You will see your tutor here after you join a batch.'
                  : 'No active conversations.'}
              </p>
              {!isLearner && availableContacts.length > 0 && (
                <button
                  type="button"
                  className="btn-outline btn-sm mt-3"
                  onClick={() => setNewChatOpen(true)}
                >
                  + Start a Chat
                </button>
              )}
            </div>
          ) : visiblePeople.length === 0 ? (
            <div className="chat-empty-sidebar">
              <p className="text-muted">
                {roleFilter === 'parent'
                  ? 'No parent conversations.'
                  : 'No student conversations.'}
              </p>
              {!isLearner && availableContacts.length > 0 && (
                <button
                  type="button"
                  className="btn-outline btn-sm mt-3"
                  onClick={() => setNewChatOpen(true)}
                >
                  + Start a Chat
                </button>
              )}
            </div>
          ) : (
            visiblePeople.map((person) => (
              <button
                type="button"
                key={person.userId}
                className={`chat-person ${activeId === person.userId ? 'active' : ''} kind-${personKind(person)}`}
                onClick={() => openThread(person.userId)}
              >
                <span className={`chat-avatar kind-${personKind(person)}`} aria-hidden="true">{initials(person.name)}</span>
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

        {newChatOpen && (
          <div className="modal-overlay" onClick={() => setNewChatOpen(false)}>
            <div className="modal-card new-chat-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Start a New Chat</h3>
                <button type="button" className="modal-close" onClick={() => setNewChatOpen(false)}>
                  ×
                </button>
              </div>
              <div className="new-chat-search-wrap">
                <input
                  type="text"
                  className="new-chat-search-input"
                  placeholder="Search enrolled students or parents…"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="new-chat-results">
                {availableContacts.length === 0 ? (
                  <p className="text-muted p-4 text-center">
                    {contacts.length === 0
                      ? 'No contacts found.'
                      : newChatSearch
                        ? 'No matching contacts found.'
                        : 'All contacts already have active chat threads.'}
                  </p>
                ) : (
                  availableContacts.map((c) => (
                    <button
                      key={c.userId}
                      type="button"
                      className="new-chat-contact-row"
                      onClick={() => {
                        openThread(c.userId)
                        setNewChatOpen(false)
                        setNewChatSearch('')
                      }}
                    >
                      <span className={`chat-avatar kind-${personKind(c)}`}>
                        {initials(c.name)}
                      </span>
                      <div className="new-chat-contact-info">
                        <strong>{c.name}</strong>
                        <small>{c.role === 'parent' ? 'Parent' : 'Student'}</small>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
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
                <button type="button" className="chat-back" onClick={closeThread} aria-label="Back to conversations">
                  ←
                </button>
                <span className={`chat-avatar kind-${personKind(activePerson)}`} aria-hidden="true">{initials(activePerson?.name)}</span>
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
                <button
                  type="button"
                  className="chat-icon-btn"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Attach a file"
                >
                  +
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onDraftKeyDown}
                  placeholder="Write a message…"
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
                  type="submit"
                  className="chat-send-btn"
                  disabled={sending || (!draft.trim() && files.length === 0)}
                >
                  {sending ? '…' : 'Send'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
