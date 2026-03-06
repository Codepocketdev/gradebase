import { useState, useEffect } from 'react'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import {
  UserPlus, Trash2, Copy, Check, Search, X,
  BookOpen, Users, Eye, EyeOff, AlertTriangle,
  ChevronRight, Key, GraduationCap
} from 'lucide-react'
import { getTeachers, getClasses } from '../db'
import { syncAddTeacher, syncRemoveTeacher } from '../nostrSync'

// ── Deterministic avatar color from npub ─────────────────────────────
const COLORS = ['#4fffb0', '#a78bfa', '#38bdf8', '#fbbf24', '#f472b6', '#34d399']
const avatarColor = (npub) => COLORS[(npub?.charCodeAt(5) || 0) % COLORS.length]
const initials    = (name) => name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

export default function Teachers({ user, dataVersion }) {
  const [teachers, setTeachers]   = useState([])
  const [classes, setClasses]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [sheet, setSheet]         = useState(null) // null | 'create' | teacher object

  // Create form
  const [name, setName]         = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated]   = useState(null)  // { nsec, npub, name } shown after creation
  const [showNsec, setShowNsec] = useState(false)
  const [copiedNsec, setCopiedNsec] = useState(false)
  const [copiedNpub, setCopiedNpub] = useState(false)
  const [error, setError]       = useState('')

  // ── Load ──────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    const [t, c] = await Promise.all([getTeachers(), getClasses()])
    setTeachers(t.sort((a, b) => a.name.localeCompare(b.name)))
    setClasses(c)
    setLoading(false)
  }

  useEffect(() => { load() }, [dataVersion])

  // ── Create teacher account ────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim()) { setError('Enter teacher name'); return }
    setCreating(true); setError('')
    try {
      const sk   = generateSecretKey()
      const pk   = getPublicKey(sk)
      const nsec = nip19.nsecEncode(sk)
      const npub = nip19.npubEncode(pk)

      const teacher = { npub, name: name.trim(), createdAt: Date.now() }
      await syncAddTeacher(user.nsec, teacher)
      await load()

      // Show the generated credentials
      setCreated({ nsec, npub, name: name.trim() })
      setName('')
    } catch (err) {
      setError('Failed to create — check your connection')
      console.error(err)
    }
    setCreating(false)
  }

  // ── Remove teacher ────────────────────────────────────────────────
  const handleRemove = async (npub) => {
    try {
      await syncRemoveTeacher(user.nsec, npub)
      setSheet(null)
      await load()
    } catch (err) { console.error(err) }
  }

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text)
      if (which === 'nsec') { setCopiedNsec(true); setTimeout(() => setCopiedNsec(false), 2000) }
      if (which === 'npub') { setCopiedNpub(true); setTimeout(() => setCopiedNpub(false), 2000) }
    } catch {}
  }

  const closeCreate = () => {
    setSheet(null); setName(''); setCreated(null)
    setShowNsec(false); setCopiedNsec(false); setCopiedNpub(false); setError('')
  }

  const getTeacherClass = (npub) => {
    const cls = classes.find(c => c.students?.some(s => s.npub === npub) || c.teacherNpub === npub)
    return cls?.name || null
  }

  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  // ══════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>Teachers</div>
          <div style={S.headerSub}>{teachers.length} staff member{teachers.length !== 1 ? 's' : ''}</div>
        </div>
        <button style={S.addBtn} onClick={() => { setSheet('create'); setCreated(null); setName(''); setError('') }}>
          <UserPlus size={16} /> Add Teacher
        </button>
      </div>

      {/* Search */}
      <div style={S.searchWrap}>
        <Search size={15} color="var(--muted)" style={{ flexShrink: 0 }} />
        <input style={S.searchInput} placeholder="Search teachers..." value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch('')} style={S.clearBtn}><X size={14} /></button>}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
        {loading && <div style={S.empty}><div style={S.emptyText}>Loading...</div></div>}

        {!loading && filtered.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}><Users size={32} color="var(--muted)" strokeWidth={1} /></div>
            <div style={S.emptyText}>{search ? 'No teachers match your search' : 'No teachers yet'}</div>
            {!search && <div style={S.emptySub}>Tap "Add Teacher" to create a staff account</div>}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
            {filtered.map(teacher => {
              const color = avatarColor(teacher.npub)
              const cls   = getTeacherClass(teacher.npub)
              return (
                <button key={teacher.npub} style={S.teacherCard} onClick={() => setSheet(teacher)}>
                  {teacher.avatar
                    ? <img src={teacher.avatar} alt={teacher.name} style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover', border: `1.5px solid ${color}40`, flexShrink: 0 }} />
                    : <div style={{ ...S.avatar, background: `${color}18`, color, border: `1.5px solid ${color}30` }}>{initials(teacher.name)}</div>
                  }
                  <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={S.teacherName}>{teacher.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      {cls && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: `${color}15`, color }}>
                          {cls}
                        </span>
                      )}
                      <span style={S.teacherNpub}>{teacher.npub.slice(0, 10)}...{teacher.npub.slice(-6)}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════
          CREATE TEACHER SHEET
      ════════════════════════════════════════════════════════════ */}
      {sheet === 'create' && (
        <div style={S.overlay} onClick={closeCreate}>
          <div style={S.sheet} onClick={e => e.stopPropagation()}>
            <div style={S.handle} />

            <div style={S.sheetHeader}>
              <div>
                <div style={S.sheetTitle}>{created ? 'Teacher Account Created' : 'Create Teacher Account'}</div>
                <div style={S.sheetSub}>{created ? 'Share these credentials with the teacher' : 'App generates a Nostr keypair for the teacher'}</div>
              </div>
              <button style={S.closeBtn} onClick={closeCreate}><X size={16} /></button>
            </div>

            {/* ── STEP 1: Enter name ── */}
            {!created && (
              <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <label style={S.label}>Teacher Full Name</label>
                  <input
                    style={S.input} placeholder="e.g. Jane Wanjiku"
                    value={name} onChange={e => { setName(e.target.value); setError('') }}
                    onKeyDown={e => e.key === 'Enter' && !creating && handleCreate()}
                    autoFocus
                  />
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(79,255,176,0.06)', border: '1px solid rgba(79,255,176,0.15)', borderRadius: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                  <Key size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} color="var(--accent)" />
                  A private key will be generated for this teacher. Share it with them so they can log in.
                </div>

                {error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                    <AlertTriangle size={13} color="#ef4444" /> {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={S.cancelBtn} onClick={closeCreate}>Cancel</button>
                  <button
                    style={{ ...S.confirmBtn, opacity: creating ? 0.7 : 1 }}
                    onClick={handleCreate} disabled={creating}
                  >
                    {creating ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Show generated credentials ── */}
            {created && (
              <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Teacher name badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: `${avatarColor(created.npub)}18`, color: avatarColor(created.npub), border: `1.5px solid ${avatarColor(created.npub)}30`, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 }}>
                    {initials(created.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{created.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Teacher account created</div>
                  </div>
                </div>

                {/* Private key — nsec */}
                <div style={{ background: 'var(--bg)', border: '1.5px solid rgba(251,191,36,0.3)', borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#fbbf24' }}>
                      Private Key (nsec) — Share this
                    </div>
                    <AlertTriangle size={13} color="#fbbf24" />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.8 }}>
                    {showNsec ? created.nsec : created.nsec.slice(0, 12) + '•'.repeat(40)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button style={S.keyBtn} onClick={() => setShowNsec(v => !v)}>
                      {showNsec ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showNsec ? 'Hide' : 'Reveal'}
                    </button>
                    <button style={S.keyBtn} onClick={() => copy(created.nsec, 'nsec')}>
                      {copiedNsec ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
                      {copiedNsec ? 'Copied!' : 'Copy nsec'}
                    </button>
                  </div>
                </div>

                {/* Public key — npub */}
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)', marginBottom: 8 }}>
                    Public Key (npub)
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.8 }}>
                    {created.npub}
                  </div>
                  <button style={{ ...S.keyBtn, marginTop: 10 }} onClick={() => copy(created.npub, 'npub')}>
                    {copiedNpub ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
                    {copiedNpub ? 'Copied!' : 'Copy npub'}
                  </button>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
                  Send the nsec to {created.name} via WhatsApp or SMS. They use it to log in as Teacher.
                </div>

                <button style={S.confirmBtn} onClick={closeCreate}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TEACHER PROFILE SHEET
      ════════════════════════════════════════════════════════════ */}
      {sheet && sheet !== 'create' && (
        <div style={S.overlay} onClick={() => setSheet(null)}>
          <div style={S.sheet} onClick={e => e.stopPropagation()}>
            <div style={S.handle} />

            <div style={S.sheetHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {sheet.avatar
                  ? <img src={sheet.avatar} alt={sheet.name} style={{ width: 52, height: 52, borderRadius: 16, objectFit: 'cover', border: `1.5px solid ${avatarColor(sheet.npub)}40`, flexShrink: 0 }} />
                  : <div style={{ width: 52, height: 52, borderRadius: 16, background: `${avatarColor(sheet.npub)}18`, color: avatarColor(sheet.npub), border: `1.5px solid ${avatarColor(sheet.npub)}30`, display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{initials(sheet.name)}</div>
                }
                <div>
                  <div style={S.sheetTitle}>{sheet.name}</div>
                  <div style={S.sheetSub}>Teacher</div>
                </div>
              </div>
              <button style={S.closeBtn} onClick={() => setSheet(null)}><X size={16} /></button>
            </div>

            <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Class assignment */}
              {getTeacherClass(sheet.npub) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <GraduationCap size={16} color="var(--accent)" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    Class: <span style={{ color: 'var(--accent)' }}>{getTeacherClass(sheet.npub)}</span>
                  </div>
                </div>
              )}

              {/* npub */}
              <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)', marginBottom: 8 }}>Public Key (npub)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.7 }}>
                  {sheet.npub}
                </div>
                <button style={{ ...S.keyBtn, marginTop: 10 }} onClick={() => copy(sheet.npub, 'npub')}>
                  {copiedNpub ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
                  {copiedNpub ? 'Copied!' : 'Copy npub'}
                </button>
              </div>

              {/* Added date */}
              <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
                Added {new Date(sheet.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>

            <div style={{ padding: '16px 20px 8px', display: 'flex', gap: 10 }}>
              <button style={S.cancelBtn} onClick={() => setSheet(null)}>Close</button>
              <button style={S.deleteBtn} onClick={() => handleRemove(sheet.npub)}>
                <Trash2 size={15} /> Remove Teacher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────
const S = {
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 12px' },
  headerTitle: { fontSize: 20, fontWeight: 800, color: 'var(--text)' },
  headerSub:   { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  addBtn:      { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#0d0f14', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)' },
  searchWrap:  { display: 'flex', alignItems: 'center', gap: 10, margin: '0 16px 12px', padding: '11px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 14 },
  clearBtn:    { background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, color: 'var(--muted)' },
  teacherCard: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, cursor: 'pointer', fontFamily: 'var(--font-display)', width: '100%' },
  avatar:      { width: 46, height: 46, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0 },
  teacherName: { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  teacherNpub: { fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' },
  empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyIcon:   { width: 64, height: 64, borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center' },
  emptyText:   { fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  emptySub:    { fontSize: 13, color: 'var(--muted)' },
  overlay:     { position: 'fixed', top: 0, left: 0, right: 0, bottom: 64, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end' },
  sheet:       { width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', paddingBottom: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90%', overflowY: 'auto' },
  handle:      { width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 0' },
  sheetHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px' },
  sheetTitle:  { fontSize: 17, fontWeight: 800, color: 'var(--text)' },
  sheetSub:    { fontSize: 12, color: 'var(--muted)', marginTop: 2 },
  closeBtn:    { width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 },
  label:       { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' },
  input:       { width: '100%', padding: '13px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  keyBtn:      { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)' },
  cancelBtn:   { flex: 1, padding: 13, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  confirmBtn:  { flex: 2, padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#0d0f14', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteBtn:   { flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#ef4444', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}

