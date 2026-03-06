import { useState, useEffect, useRef } from 'react'
import { finalizeEvent } from 'nostr-tools'
import { SimplePool } from 'nostr-tools/pool'
import { ArrowLeft, Camera, User, School, Zap, Shield, Eye, EyeOff, Copy, Check, Loader, Users } from 'lucide-react'
import { getClasses, getSchool } from '../db'
import { uploadImage, skFromNsec } from '../nostrSync'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const syncColor = s => s === 'synced' ? 'var(--income)' : s === 'syncing' ? '#fbbf24' : '#ef4444'
const syncLabel = s => s === 'synced' ? '● Live' : s === 'syncing' ? '◌ Syncing...' : '○ Offline'

export default function TeacherProfile({ user, syncState, onBack, onUpdateUser }) {
  const [displayName, setDisplayName]   = useState(user?.name || '')
  const [about, setAbout]               = useState('')
  const [previewAvatar, setPreviewAvatar] = useState(user?.avatar || '')
  const [schoolName, setSchoolName]     = useState('')
  const [classes, setClasses]           = useState([])
  const [showNsec, setShowNsec]         = useState(false)
  const [copiedNpub, setCopiedNpub]     = useState(false)
  const [copiedNsec, setCopiedNsec]     = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState('')
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const fileRef = useRef(null)

  // ── Load school name + teacher's classes ─────────────────────────
  useEffect(() => {
    getSchool().then(s => { if (s?.schoolName) setSchoolName(s.schoolName) })
    getClasses().then(all => {
      const mine = (all || []).filter(c => c.teacherNpub === user?.npub)
      setClasses(mine)
    })
  }, [user?.npub])

  // ── Fetch existing kind:0 from Nostr ─────────────────────────────
  useEffect(() => {
    if (!user?.pk) return
    const pool = new SimplePool()
    let sub
    try {
      sub = pool.subscribe(RELAYS, [{ kinds: [0], authors: [user.pk], limit: 1 }], {
        onevent(e) {
          try {
            const p = JSON.parse(e.content)
            if (!displayName) setDisplayName(p.name || p.display_name || user?.name || '')
            if (!about)       setAbout(p.about || '')
            if (!previewAvatar) setPreviewAvatar(p.picture || '')
          } catch {}
        },
      })
    } catch {}
    const t = setTimeout(() => { try { sub?.close() } catch {} }, 6000)
    return () => { clearTimeout(t); try { sub?.close() } catch {} }
  }, [user?.pk])

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setUploadError('Max 10MB'); return }
    setUploading(true); setUploadError('')
    try {
      const url = await uploadImage(user.nsec, file)
      setPreviewAvatar(url)
    } catch { setUploadError('Upload failed — check connection') }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!user?.nsec) return
    setSaving(true)
    try {
      const pool = new SimplePool()
      const sk   = skFromNsec(user.nsec)
      const event = finalizeEvent({
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: JSON.stringify({
          name:         displayName.trim() || user.name || 'Teacher',
          display_name: displayName.trim() || user.name || 'Teacher',
          about:        about.trim(),
          picture:      previewAvatar || '',
        }),
      }, sk)
      await Promise.any(pool.publish(RELAYS, event))
      if (onUpdateUser) onUpdateUser({ ...user, name: displayName.trim(), avatar: previewAvatar })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text)
      if (which === 'npub') { setCopiedNpub(true); setTimeout(() => setCopiedNpub(false), 2000) }
      if (which === 'nsec') { setCopiedNsec(true); setTimeout(() => setCopiedNsec(false), 2000) }
    } catch {}
  }

  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0)

  return (
    <div style={{ padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480, margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Back */}
      <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, alignSelf: 'flex-start', padding: 0 }}>
        <ArrowLeft size={16} /> Back to Settings
      </button>

      {/* Avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          {previewAvatar
            ? <img src={previewAvatar} alt="avatar" style={{ width: 96, height: 96, borderRadius: 26, objectFit: 'cover', border: '3px solid var(--accent)' }} />
            : (
              <div style={{ width: 96, height: 96, borderRadius: 26, background: 'rgba(79,255,176,0.1)', border: '2px solid rgba(79,255,176,0.3)', display: 'grid', placeItems: 'center' }}>
                <User size={42} color="var(--accent)" strokeWidth={1.5} />
              </div>
            )
          }
          <button onClick={() => !uploading && fileRef.current?.click()}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, borderRadius: 10, background: uploading ? 'var(--muted)' : 'var(--accent)', border: '2px solid var(--bg)', display: 'grid', placeItems: 'center', cursor: uploading ? 'not-allowed' : 'pointer' }}>
            {uploading
              ? <Loader size={14} color="#0d0f14" style={{ animation: 'spin 1s linear infinite' }} />
              : <Camera size={15} color="#0d0f14" />
            }
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
        </div>
        {uploadError && <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{uploadError}</div>}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{displayName || user?.name || 'Teacher'}</div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>Teacher</div>
        </div>
      </div>

      {/* School info */}
      <div style={C.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <School size={14} color="var(--accent)" />
          <span style={C.label}>School</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{schoolName || '—'}</div>
      </div>

      {/* Classes summary */}
      <div style={C.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Users size={14} color="var(--accent)" />
          <span style={C.label}>My Classes</span>
        </div>
        {classes.length === 0
          ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>No classes yet</div>
          : classes.map(cls => (
            <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{cls.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{cls.students?.length || 0} students</div>
            </div>
          ))
        }
        {classes.length > 0 && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            {classes.length} class{classes.length !== 1 ? 'es' : ''} · {totalStudents} student{totalStudents !== 1 ? 's' : ''} total
          </div>
        )}
      </div>

      {/* Display name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={C.label}>Display Name</label>
        <input style={C.input} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
      </div>

      {/* About */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={C.label}>About</label>
        <textarea style={{ ...C.input, resize: 'none', height: 90, lineHeight: 1.6 }}
          value={about} onChange={e => setAbout(e.target.value)} placeholder="A short bio for your Nostr profile..." />
      </div>

      {/* Nostr hint */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'rgba(79,255,176,0.05)', border: '1px solid rgba(79,255,176,0.15)', borderRadius: 10, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        <Zap size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
        Saving publishes a Nostr <strong style={{ color: 'var(--accent)' }}>kind:0</strong> metadata event — your profile is visible on the Nostr network.
      </div>

      {/* npub */}
      <div style={C.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Shield size={13} color="var(--accent)" />
          <span style={C.label}>Public Key (npub)</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.8 }}>
          {user?.npub}
        </div>
        <button style={C.keyBtn} onClick={() => copy(user?.npub, 'npub')}>
          {copiedNpub ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
          {copiedNpub ? 'Copied!' : 'Copy npub'}
        </button>
      </div>

      {/* nsec */}
      <div style={{ ...C.card, border: '1px solid rgba(251,191,36,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Shield size={13} color="#fbbf24" />
          <span style={{ ...C.label, color: '#fbbf24' }}>Private Key (nsec) — Keep Secret</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.8 }}>
          {showNsec ? user?.nsec : (user?.nsec?.slice(0, 14) + '•'.repeat(44))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button style={C.keyBtn} onClick={() => setShowNsec(v => !v)}>
            {showNsec ? <EyeOff size={12} /> : <Eye size={12} />}
            {showNsec ? 'Hide' : 'Reveal'}
          </button>
          <button style={C.keyBtn} onClick={() => copy(user?.nsec, 'nsec')}>
            {copiedNsec ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
            {copiedNsec ? 'Copied!' : 'Copy nsec'}
          </button>
        </div>
      </div>

      {/* Sync status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Nostr Sync</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: syncColor(syncState) }}>{syncLabel(syncState)}</span>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        style={{ width: '100%', padding: 16, background: saving ? 'var(--muted)' : saved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: 14, color: '#0d0f14', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, cursor: 'pointer', transition: 'background 0.2s' }}>
        {saving ? 'Publishing to Nostr...' : saved ? '✓ Saved & Published' : 'Save Profile'}
      </button>

    </div>
  )
}

const C = {
  card:   { padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 },
  label:  { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' },
  input:  { width: '100%', padding: '12px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  keyBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '7px 14px', borderRadius: 9, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)' },
}

