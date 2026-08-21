import { useEffect, useState } from 'react'
import { subjectApi } from '../../../lib/api'
import '../../../styles/dashboard.css'

export function TutorSubjectsPage() {
  const [subjects, setSubjects] = useState([])
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await subjectApi.list()
    setSubjects(res.subjects ?? [])
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function createSubject(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      setSaving(true)
      setError('')
      await subjectApi.create(name.trim())
      setName('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveRename(subject) {
    if (!editingName.trim()) return
    try {
      setSaving(true)
      await subjectApi.update(subject.subjectId, { name: editingName.trim() })
      setEditingId('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function archive(subject) {
    if (!window.confirm(`Archive ${subject.name}? Existing batches keep the name until you edit them.`)) return
    try {
      await subjectApi.archive(subject.subjectId)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="dashboard-header">
        <span className="eyebrow">Catalogue</span>
        <h1>Subjects</h1>
        <p>Create and manage subjects, then assign them when you set up a batch.</p>
      </div>
      {error && <div className="alert error">{error}</div>}

      <section className="premium-card mb-6">
        <h2>Add subject</h2>
        <form className="holiday-row mt-4" onSubmit={createSubject}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Algebra"
            required
          />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add'}
          </button>
        </form>
      </section>

      <section className="premium-card">
        <h2>Your subjects</h2>
        {subjects.length === 0 ? (
          <p className="text-muted mt-4">No subjects yet. Add one above.</p>
        ) : (
          <div className="premium-table-container mt-4">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.subjectId}>
                    <td>
                      {editingId === subject.subjectId ? (
                        <input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                        />
                      ) : (
                        subject.name
                      )}
                    </td>
                    <td>
                      <div className="button-row">
                        {editingId === subject.subjectId ? (
                          <>
                            <button type="button" className="btn-primary btn-sm" onClick={() => saveRename(subject)}>
                              Save
                            </button>
                            <button type="button" className="btn-outline btn-sm" onClick={() => setEditingId('')}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              onClick={() => {
                                setEditingId(subject.subjectId)
                                setEditingName(subject.name)
                              }}
                            >
                              Rename
                            </button>
                            <button type="button" className="danger-button" onClick={() => archive(subject)}>
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
