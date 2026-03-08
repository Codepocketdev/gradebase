import { useState, useEffect } from 'react'
import { Plus, School, Trash2, X, Users, Pencil, Check, AlertTriangle, Loader, Eye, Calendar, CalendarDays, Sun, Home } from 'lucide-react'
import { getClasses, replaceAllClasses } from '../db'
import { syncSaveClass, syncDeleteClass } from '../nostrSync'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

const CLASS_COLORS = [
  { bg: '#f0fdf4', color: '#00c97a', border: '#bbf7d0' },
  { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
  { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
  { bg: '#fff7ed', color: '#f97316', border: '#fed7aa' },
  { bg: '#fef2f2', color: '#ef4444', border: '#fecaca' },
  { bg: '#f0fdfa', color: '#14b8a6', border: '#99f6e4' },
  { bg: '#fefce8', color: '#eab308', border: '#fef08a' },
  { bg: '#fdf2f8', color: '#ec4899', border: '#fbcfe8' },
]

const COLOR_OPTIONS = [
  '#00c97a','#3b82f6','#a855f7','#f97316',
  '#ef4444','#14b8a6','#eab308','#ec4899',
]

const colorFromHex = (hex) => {
  const map = {
    '#00c97a': CLASS_COLORS[0], '#3b82f6': CLASS_COLORS[1],
    '#a855f7': CLASS_COLORS[2], '#f97316': CLASS_COLORS[3],
    '#ef4444': CLASS_COLORS[4], '#14b8a6': CLASS_COLORS[5],
    '#eab308': CLASS_COLORS[6], '#ec4899': CLASS_COLORS[7],
  }
  return map[hex] || CLASS_COLORS[0]
}

// Lunch type config
const LUNCH_TYPES = [
  { id: 'monthly', label: 'Monthly', Icon: Calendar     },
  { id: 'weekly',  label: 'Weekly',  Icon: CalendarDays },
  { id: 'daily',   label: 'Daily',   Icon: Sun          },
  { id: 'home',    label: 'Home',    Icon: Home         },
]

function LunchBadge({ type, small = false }) {
  const cfg = LUNCH_TYPES.find(l => l.id === type) || LUNCH_TYPES[0]
  const { Icon } = cfg
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: small ? 9 : 10, fontWeight: 700, padding: small ? '2px 6px' : '3px 8px',
      borderRadius: 20, background: 'rgba(79,255,176,0.1)',
      border: '1px solid rgba(79,255,176,0.25)', color: 'var(--accent)',
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      <Icon size={small ? 9 : 10} />
      {cfg.label}
    </span>
  )
}

export default function Classes({ user, userRole, dataVersion }) {
  const [classes, setClasses]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [showAdd, setShowAdd]           = useState(false)
  const [editingClass, setEditingClass] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expandedClass, setExpandedClass] = useState(null)
  const [newName, setNewName]           = useState('')
  const [newColor, setNewColor]         = useState('#00c97a')
  const [msg, setMsg]                   = useState('')
  const [lunchSaving, setLunchSaving]   = useState(null) // npub being saved

  const canManage = userRole === 'teacher'
  const isAdmin   = userRole === 'admin'

  useEffect(() => {
    getClasses().then(list => {
      const filtered = userRole === 'teacher'
        ? (list || []).filter(c => c.teacherNpub === user?.npub)
        : (list || [])
      setClasses(filtered)
      setLoading(false)
    })
  }, [dataVersion])

  // Live Nostr subscription for teacher
  useEffect(() => {
    if (userRole !== 'teacher' || !user?.npub) return
    let closed = false
    const sockets = []
    let latestCreatedAt = 0
    const seen = new Set()

    const subscribe = (relayUrl) => {
      let ws, reconnectTimer
      const connect = () => {
        if (closed) return
        try {
          ws = new WebSocket(relayUrl)
          const subId = 'cls-' + Math.random().toString(36).slice(2, 8)
          ws.onopen = () => {
            if (closed) { ws.close(); return }
            ws.send(JSON.stringify(['REQ', subId, {
              kinds: [1], authors: [user.pk], '#t': ['gradebase-classes'], limit: 20,
            }]))
          }
          ws.onmessage = async ({ data }) => {
            if (closed) return
            let msg
            try { msg = JSON.parse(data) } catch { return }
            if (msg[0] !== 'EVENT') return
            const ev = msg[2]
            if (!ev || seen.has(ev.id)) return
            seen.add(ev.id)
            if (ev.created_at <= latestCreatedAt) return
            latestCreatedAt = ev.created_at
            const raw = ev.content.startsWith('CLASSES:') ? ev.content.slice('CLASSES:'.length) : null
            if (!raw) return
            try {
              const incoming = JSON.parse(raw)
              if (!Array.isArray(incoming)) return
              let teacherNpub = user.npub
              try { const { nip19 } = await import('nostr-tools'); teacherNpub = nip19.npubEncode(ev.pubkey) } catch {}
              const { getClasses, replaceAllClasses } = await import('../db')
              const existing = await getClasses()
              const others   = existing.filter(c => c.teacherNpub !== teacherNpub)
              await replaceAllClasses([...others, ...incoming])
              if (!closed) setClasses(incoming)
            } catch (e) { console.warn('[Classes] parse error:', e) }
          }
          ws.onerror = () => {}
          ws.onclose = () => { if (!closed) reconnectTimer = setTimeout(connect, 4000) }
        } catch {}
      }
      connect()
      sockets.push({ close: () => { closed = true; clearTimeout(reconnectTimer); try { ws?.close() } catch {} } })
    }
    RELAYS.forEach(subscribe)
    return () => { closed = true; sockets.forEach(s => s.close()) }
  }, [user?.npub, userRole])

  // ── Set lunch type for a student ─────────────────────────────────
  const setStudentLunchType = async (cls, studentNpub, lunchType) => {
    setLunchSaving(studentNpub)
    const allClasses = await getClasses()
    const updated = allClasses.map(c => {
      if (c.id !== cls.id) return c
      return {
        ...c,
        students: c.students.map(s => s.npub === studentNpub ? { ...s, lunchType } : s)
      }
    })
    await replaceAllClasses(updated)
    // Update local state
    setClasses(prev => prev.map(c => {
      if (c.id !== cls.id) return c
      return { ...c, students: c.students.map(s => s.npub === studentNpub ? { ...s, lunchType } : s) }
    }))
    // Publish updated class to Nostr (teacher only — admin view is read-only for lunch)
    if (canManage) {
      const updatedCls = updated.find(c => c.id === cls.id)
      syncSaveClass(user.nsec, updatedCls).catch(console.warn)
    }
    setLunchSaving(null)
  }

  const resetForm = () => { setNewName(''); setNewColor('#00c97a'); setShowAdd(false); setEditingClass(null) }
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const addClass = async () => {
    if (!newName.trim()) return
    setSaving(true)
    const cls = {
      id: Date.now().toString(), name: newName.trim(), color: colorFromHex(newColor),
      students: [], teacherNpub: user?.npub || '', createdAt: Date.now(),
    }
    const updated = [...classes, cls]
    await replaceAllClasses(updated)
    setClasses(updated); resetForm()
    syncSaveClass(user.nsec, cls)
      .then(() => showMsg('ok: Class published to Nostr'))
      .catch(() => showMsg('ok: Saved locally'))
    setSaving(false)
  }

  const saveEdit = async () => {
    if (!newName.trim() || !editingClass) return
    setSaving(true)
    const updated = classes.map(c =>
      c.id === editingClass.id ? { ...c, name: newName.trim(), color: colorFromHex(newColor) } : c
    )
    await replaceAllClasses(updated)
    setClasses(updated)
    const edited = updated.find(c => c.id === editingClass.id)
    resetForm()
    syncSaveClass(user.nsec, edited)
      .then(() => showMsg('ok: Changes published to Nostr'))
      .catch(() => showMsg('ok: Saved locally'))
    setSaving(false)
  }

  const deleteClass = async (id) => {
    setSaving(true)
    const updated = classes.filter(c => c.id !== id)
    await replaceAllClasses(updated)
    setClasses(updated); setDeleteTarget(null)
    syncDeleteClass(user.nsec, id).catch(console.warn)
    setSaving(false)
  }

  const openEdit = (cls) => {
    setEditingClass(cls); setNewName(cls.name)
    const entry = Object.entries({
      '#00c97a': 0, '#3b82f6': 1, '#a855f7': 2, '#f97316': 3,
      '#ef4444': 4, '#14b8a6': 5, '#eab308': 6, '#ec4899': 7,
    }).find(([, i]) => CLASS_COLORS[i].color === cls.color?.color)
    setNewColor(entry ? entry[0] : '#00c97a')
    setShowAdd(true)
  }

  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0)

  if (deleteTarget) return (
    <div style={S.page}>
      <div style={S.header}><div style={S.title}>Classes</div></div>
      <div style={{ padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fef2f2', border: '1px solid #fecaca', display: 'grid', placeItems: 'center' }}>
          <AlertTriangle size={28} color="#ef4444" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Delete "{deleteTarget.name}"?</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            This will permanently delete this class
            {deleteTarget.students?.length > 0 ? ` and remove all ${deleteTarget.students.length} student${deleteTarget.students.length !== 1 ? 's' : ''}.` : '.'}
          </div>
        </div>
        <button onClick={() => deleteClass(deleteTarget.id)} style={{ ...S.primaryBtn, background: '#ef4444' }}>
          <Trash2 size={15} /> Yes, Delete Class
        </button>
        <button onClick={() => setDeleteTarget(null)} style={S.secondaryBtn}>Cancel</button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>Classes</div>
          <div style={S.subtitle}>{classes.length} class{classes.length !== 1 ? 'es' : ''} · {totalStudents} student{totalStudents !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(79,255,176,0.08)', border: '1px solid rgba(79,255,176,0.2)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
              <Eye size={12} /> View Only
            </div>
          )}
          {canManage && (
            <button style={S.addBtn} onClick={() => { resetForm(); setShowAdd(true) }}>
              <Plus size={15} /> New Class
            </button>
          )}
        </div>
      </div>

      {msg && (
        <div style={{ margin: '0 20px', padding: '10px 14px', borderRadius: 10, background: msg.startsWith('ok') ? 'rgba(0,201,122,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('ok') ? 'rgba(0,201,122,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 12, color: msg.startsWith('ok') ? '#00c97a' : '#ef4444', fontWeight: 600 }}>
          {msg.replace(/^(ok|err): /, '')}
        </div>
      )}

      {showAdd && canManage && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && resetForm()}>
          <div style={S.sheet}>
            <button style={S.closeBtn} onClick={resetForm}><X size={15} /></button>
            <div style={S.sheetTitle}>{editingClass ? 'Edit Class' : 'New Class'}</div>
            <div style={S.inputLabel}>Class Name</div>
            <input style={S.input} placeholder="e.g. Grade 4A, Pre-Primary 1..."
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (editingClass ? saveEdit() : addClass())} autoFocus />
            <div style={{ ...S.inputLabel, marginTop: 14 }}>Class Color</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map(hex => (
                <button key={hex} onClick={() => setNewColor(hex)} style={{
                  width: 34, height: 34, borderRadius: '50%', background: hex, border: 'none', cursor: 'pointer',
                  outline: newColor === hex ? `3px solid ${hex}` : 'none', outlineOffset: 2,
                  transform: newColor === hex ? 'scale(1.15)' : 'scale(1)', transition: 'all 0.15s',
                }} />
              ))}
            </div>
            <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, background: colorFromHex(newColor).bg, color: colorFromHex(newColor).color, border: `1px solid ${colorFromHex(newColor).border}` }}>
                {(newName || 'CLS').slice(0, 3).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{newName || 'Class Name'}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>0 students</div>
              </div>
            </div>
            <button style={{ ...S.primaryBtn, marginTop: 20, opacity: saving ? 0.7 : 1 }}
              onClick={editingClass ? saveEdit : addClass} disabled={saving}>
              {saving
                ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                : editingClass ? <><Check size={15} /> Save Changes</> : <><School size={15} /> Create Class</>}
            </button>
            <button style={S.secondaryBtn} onClick={resetForm}>Cancel</button>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading classes…
        </div>
      )}

      {!loading && classes.length === 0 && (
        <div style={S.empty}>
          <School size={52} strokeWidth={1} color="var(--muted)" />
          <div style={S.emptyTitle}>No classes yet</div>
          <div style={S.emptySub}>
            {canManage ? 'Create your first class to start organising students.' : 'No classes have been created yet.'}
          </div>
          {canManage && (
            <button style={{ ...S.primaryBtn, width: 'auto', paddingLeft: 24, paddingRight: 24 }} onClick={() => setShowAdd(true)}>
              <Plus size={15} /> Create First Class
            </button>
          )}
        </div>
      )}

      {!loading && classes.length > 0 && (
        <div style={S.list}>
          {classes.map(cls => (
            <div key={cls.id}>
              <div style={S.classCard}>
                <div style={{ width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, background: cls.color?.bg || '#f0fdf4', color: cls.color?.color || '#00c97a', border: `1px solid ${cls.color?.border || '#bbf7d0'}` }}>
                  {cls.name.slice(0, 3).toUpperCase()}
                </div>
                <div style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => setExpandedClass(expandedClass === cls.id ? null : cls.id)}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{cls.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={10} />{cls.students?.length || 0} student{(cls.students?.length || 0) !== 1 ? 's' : ''}
                    {isAdmin && cls.teacherNpub && (
                      <span style={{ marginLeft: 6, color: 'var(--accent)', fontSize: 10 }}>· {cls.teacherNpub.slice(0, 12)}…</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(cls)} style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(cls)} style={{ width: 34, height: 34, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded student list — both admin and teacher can set lunch type */}
              {expandedClass === cls.id && (
                <div style={{ margin: '0 0 4px', padding: '10px 14px 14px', background: 'var(--bg)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 14px 14px' }}>
                  {!cls.students?.length
                    ? <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>No students enrolled</div>
                    : (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                          Students · tap lunch type to change
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {cls.students.map((stu, i) => (
                            <div key={stu.npub || i}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <div style={{ width: 34, height: 34, borderRadius: '50%', background: stu.grad || 'linear-gradient(135deg,#00c97a,#00a862)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                  {stu.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{stu.name}</div>
                                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{stu.npub?.slice(0,20)}…</div>
                                </div>
                                {lunchSaving === stu.npub && <Loader size={12} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} />}
                              </div>
                              {/* Lunch type pill selector */}
                              <div style={{ display: 'flex', gap: 6, paddingLeft: 44, flexWrap: 'wrap' }}>
                                {LUNCH_TYPES.map(lt => {
                                  const isActive = (stu.lunchType || 'monthly') === lt.id
                                  return (
                                    <button key={lt.id}
                                      onClick={() => setStudentLunchType(cls, stu.npub, lt.id)}
                                      disabled={lunchSaving === stu.npub}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-display)',
                                        background: isActive ? 'rgba(79,255,176,0.12)' : 'var(--surface)',
                                        color: isActive ? 'var(--accent)' : 'var(--muted)',
                                        outline: isActive ? '1.5px solid rgba(79,255,176,0.4)' : '1px solid var(--border)',
                                        outlineOffset: 0,
                                        transition: 'all 0.15s',
                                      }}>
                                      <lt.Icon size={10} />{lt.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S = {
  page:        { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header:      { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:       { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  subtitle:    { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  addBtn:      { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0d1117', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)' },
  list:        { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 },
  classCard:   { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '14px 14px', display: 'flex', alignItems: 'center', gap: 12 },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '80px 32px', color: 'var(--muted)' },
  emptyTitle:  { fontSize: 17, fontWeight: 800, color: 'var(--text)' },
  emptySub:    { fontSize: 13, textAlign: 'center', lineHeight: 1.7, maxWidth: 260 },
  overlay:     { position: 'fixed', top: 0, left: 0, right: 0, bottom: 64, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet:       { width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 44px', position: 'relative', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', maxHeight: '100%', overflowY: 'auto' },
  closeBtn:    { position: 'absolute', top: 18, right: 18, background: 'var(--surface2)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)' },
  sheetTitle:  { fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 18 },
  inputLabel:  { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)', marginBottom: 6 },
  input:       { width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 11, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  primaryBtn:  { width: '100%', padding: 14, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#0d1117', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryBtn:{ width: '100%', padding: 14, marginTop: 8, background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' },
}

