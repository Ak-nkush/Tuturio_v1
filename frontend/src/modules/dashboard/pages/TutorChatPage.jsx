import { useEffect, useMemo, useState } from 'react'
import { messageApi } from '../../../lib/api'
import { useAuth } from '../../../context/AuthContext'
import { useSocket } from '../../../context/SocketContext'
import '../../../styles/dashboard.css'

export function TutorChatPage() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function loadLists() {
    const [c, v] = await Promise.all([messageApi.contacts(), messageApi.conversations()])
    setContacts(c.contacts ?? [])
    setConversations(v.conversations ?? [])
  }

  async function loadThread(userId) {
    if (!userId) return
    const res = await messageApi.thread(userId)
    setMessages(res.messages ?? [])
    await messageApi.markRead(userId).catch(() => {})
  }

  useEffect(() => {
    loadLists().catch((err) => setError(err.message))
  }, [])

  const socket = useSocket()

  // Load thread when switching conversations
  useEffect(() => {
    if (!activeId) return
    loadThread(activeId).catch((err) => setError(err.message))
  }, [activeId])

  // Setup Socket.io real-time listeners for messaging and read receipts
  useEffect(() => {
    if (!socket) return

    const handleMessageReceived = (msg) => {
      if (msg.senderId === activeId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev
          return [...prev, msg]
        })
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

    const handleMessagesRead = (payload) => {
      if (payload.readerId === activeId) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === user?.userId ? { ...m, isRead: true } : m))
        )
      }
      loadLists().catch(() => {})
    }

    socket.on('message:received', handleMessageReceived)
    socket.on('message:sent', handleMessageSent)
    socket.on('messages:read', handleMessagesRead)

    return () => {
      socket.off('message:received', handleMessageReceived)
      socket.off('message:sent', handleMessageSent)
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
    return [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)))
  }, [contacts, conversations])

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

  return (
    <div>
      <div className="dashboard-header">
        <span className="eyebrow">Private</span>
        <h1>Chat</h1>
        <p>Message students and parents with text or safe file attachments.</p>
      </div>
      {error && <div className="alert error">{error}</div>}
      <div className="chat-layout">
        <aside className="chat-list premium-card">
          {people.length === 0 ? (
            <p className="text-muted">No contacts yet. Invite students to a batch first.</p>
          ) : (
            people.map((person) => (
              <button
                type="button"
                key={person.userId}
                className={`chat-person ${activeId === person.userId ? 'active' : ''}`}
                onClick={() => setActiveId(person.userId)}
              >
                <strong>{person.name}</strong>
                <small>{person.role}{person.unread ? ` · ${person.unread} new` : ''}</small>
                {person.lastMessage && <p>{person.lastMessage}</p>}
              </button>
            ))
          )}
        </aside>
        <section className="chat-thread premium-card">
          {!activeId ? (
            <div className="empty-state">Select a student or parent to start a private conversation.</div>
          ) : (
            <>
              <div className="chat-messages">
                {messages.map((m) => (
                  <div key={m._id} className={`chat-bubble ${m.senderId === user?.userId ? 'mine' : 'theirs'}`}>
                    {m.content && <p>{m.content}</p>}
                    {(m.attachments ?? []).map((file) => (
                      <a key={file.url} href={file.url} target="_blank" rel="noreferrer">
                        {file.filename}
                      </a>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '2px' }}>
                      <small style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </small>
                      {m.senderId === user?.userId && (
                        <span style={{ fontSize: '12px', color: m.isRead ? '#00e676' : 'rgba(255, 255, 255, 0.6)' }} title={m.isRead ? 'Seen' : 'Sent'}>
                          {m.isRead ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <form className="chat-compose" onSubmit={send}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message"
                />
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx"
                  multiple
                  onChange={(e) => setFiles([...e.target.files])}
                />
                <button type="submit" className="btn-primary" disabled={sending}>
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
