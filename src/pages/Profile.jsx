import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Camera, User, School, Zap, Shield, Eye, EyeOff, Copy, Check } from 'lucide-react'
import { getSchool, saveSchool } from '../db'
import { publishSchool } from '../nostrSync'

const syncColor = s => s === 'synced' ? 'var(--income)' : s === 'syncing' ? '#fbbf24' : '#ef4444'
const syncLabel = s => s === 'synced' ? '● Live' : s === 'syncing' ? '◌ Syncing...' : '○ Offline'

export default function Profile({ user, syncState, onBack }) {
  const [school, setSchool]             = useState(null)
  const [displayName, setDisplayName]   = useState(user?.name || '')
  const [about, setAbout]               = useState('')
  const [previewAvatar, setPreviewAvatar] = useState(user?.avatar || '')
  const [showNsec, setShowNsec]         = useState(false)
  const [copiedNpub, setCopiedNpub]     = useState(false)
  const [copiedNsec, setCopiedNsec]     = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    getSchool().then(s => {
      if (!s) return
      setSchool(s)
      setAbout(s.about || '')
    })
  }, [])

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPreviewAvatar(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = {
        ...school,
        adminName: displayName.trim() || school?.adminName,
        about:     about.trim(),
        avatar:    previewAvatar,
      }
      await saveSchool(updated)
      await publishSchool(user.nsec, updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) { console.error(err) }
    setSaving(false)
  }

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text)
      if (which === 'npub') { setCopiedNpub(true); setTimeout(() => setCopiedNpub(false), 2000) }
      if (which === 'nsec') { setCopiedNsec(true); setTimeout(() => setCopiedNsec(false), 2000) }
    } catch {}
  }

  return (
    <div style={{ padding: '16px 20px 40px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 480, margin: '0 auto' }}>

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
          <button
            onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: -4, right: -4, width: 32, height: 32, borderRadius: 10, background: 'var(--accent)', border: '2px solid var(--bg)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
          >
            <Camera size={15} color="#0d0f14" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{displayName || 'Admin'}</div>
          <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginTop: 2 }}>School Admin</div>
        </div>
      </div>

      {/* School info */}
      {school && (
        <div style={C.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <School size={14} color="var(--accent)" />
            <span style={C.label}>School</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{school.schoolName}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Created {new Date(school.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
      )}

      {/* Display name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={C.label}>Display Name</label>
        <input
          style={C.input}
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      {/* About */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <label style={C.label}>About</label>
        <textarea
          style={{ ...C.input, resize: 'none', height: 90, lineHeight: 1.6 }}
          value={about}
          onChange={e => setAbout(e.target.value)}
          placeholder="A short bio for your Nostr profile..."
        />
      </div>

      {/* kind:0 note */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'rgba(79,255,176,0.05)', border: '1px solid rgba(79,255,176,0.15)', borderRadius: 10, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        <Zap size={13} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
        Saving publishes a Nostr <strong style={{ color: 'var(--accent)' }}>kind:0</strong> metadata event to all relays — your profile is visible on the Nostr network.
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

      {/* Sync */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Nostr Sync</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: syncColor(syncState) }}>{syncLabel(syncState)}</span>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{ width: '100%', padding: 16, background: saving ? 'var(--muted)' : saved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: 14, color: '#0d0f14', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, cursor: 'pointer', transition: 'background 0.2s' }}
      >
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

