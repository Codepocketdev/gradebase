import { useState, useMemo } from 'react'
import { nip19 } from 'nostr-tools'
import { useNostrProfile } from '../hooks/useNostrProfile'
import {
  X, Copy, CheckCircle, Eye, EyeOff,
  Shield, QrCode, User, Trash2, AlertTriangle
} from 'lucide-react'

function QRCode({ value, size = 200 }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=0d1117&margin=10&qzone=2`}
      alt="QR Code"
      style={{ width: size, height: size, borderRadius: 12, display: 'block', margin: '0 auto', border: '1px solid var(--border)' }}
    />
  )
}

const short = (str, a = 10, b = 6) => str ? `${str.slice(0, a)}…${str.slice(-b)}` : ''

export default function StudentModal({ student, userRole, onClose, onDelete }) {
  // Decode npub → hex pk for the profile hook (same hook StudentProfile uses)
  const studentPk = useMemo(() => {
    try { return nip19.decode(student.npub).data } catch { return null }
  }, [student.npub])

  const { profile: nostrProfile, loading: loadingProfile } = useNostrProfile(studentPk)

  const [tab, setTab]                       = useState('profile')
  const [nsecVisible, setNsecVisible]       = useState(false)
  const [copied, setCopied]                 = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [imgFailed, setImgFailed]           = useState(false)

  const isStudent = userRole === 'student'
  const isAdmin   = userRole === 'admin'
  const isTeacher = userRole === 'teacher'

  const tabs = [
    { id: 'profile', label: 'Profile',                            Icon: User   },
    { id: 'keys',    label: isStudent ? 'My Keys' : 'Access Key', Icon: Shield },
    { id: 'qr',      label: 'QR Code',                            Icon: QrCode },
  ]

  const copy = async (val, key) => {
    try { await navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(''), 2000) } catch {}
  }

  const initials    = student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const displayName = nostrProfile?.name || nostrProfile?.display_name || student.name
  const avatarSrc   = (!imgFailed && nostrProfile?.picture) || null

  // ── Delete confirm screen ───────────────────────────────────────────────────
  if (showDeleteConfirm) return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
      <div style={{ ...S.sheet, padding: '32px 20px 44px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fef2f2', border: '1px solid #fecaca', display: 'grid', placeItems: 'center', margin: '0 auto 14px' }}>
            <AlertTriangle size={26} color="#ef4444" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Remove Student?</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            This will permanently remove <strong>{student.name}</strong> from this class. Their Nostr identity will no longer be linked. This cannot be undone.
          </div>
        </div>
        <button onClick={() => { onDelete(student.id); setShowDeleteConfirm(false) }} style={{ ...S.btn, background: '#ef4444', color: '#fff', marginBottom: 8 }}>
          <Trash2 size={15} /> Yes, Remove Student
        </button>
        <button onClick={() => setShowDeleteConfirm(false)} style={{ ...S.btn, background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--text)' }}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.sheet}>

        {/* Close button */}
        <button onClick={onClose} style={S.closeBtn}><X size={15} /></button>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              flex: 1, padding: '9px 4px', borderRadius: 10,
              border: `1.5px solid ${tab === id ? '#00c97a' : 'var(--border)'}`,
              background: tab === id ? '#f0fdf4' : 'transparent',
              color: tab === id ? '#00c97a' : 'var(--muted)',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <>
            {/* Avatar + name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: avatarSrc ? 'transparent' : (student.grad || 'linear-gradient(135deg,#00c97a,#00a862)'),
                display: 'grid', placeItems: 'center',
                fontSize: 22, fontWeight: 800, color: '#fff',
                flexShrink: 0, overflow: 'hidden',
                border: '2px solid var(--border)',
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setImgFailed(true)} />
                  : initials
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
                  {loadingProfile ? student.name : displayName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{student.className}</div>
                {nostrProfile?.nip05 && (
                  <div style={{ fontSize: 11, color: '#00c97a', display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                    <CheckCircle size={10} /> {nostrProfile.nip05}
                  </div>
                )}
              </div>
            </div>

            {/* Bio if available */}
            {nostrProfile?.about && (
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, padding: '10px 13px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 12 }}>
                {nostrProfile.about}
              </div>
            )}

            {/* npub row */}
            <div style={S.infoRow}>
              <div style={S.infoLabel}>Public Key (npub)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...S.mono, flex: 1, fontSize: 11 }}>{short(student.npub, 16, 8)}</div>
                <button style={S.iconBtn} onClick={() => copy(student.npub, 'npub')}>
                  {copied === 'npub' ? <CheckCircle size={13} color="#00c97a" /> : <Copy size={13} color="#94a3b8" />}
                </button>
              </div>
            </div>


            {/* Remove student — admin and teacher */}
            {onDelete && (
              <button onClick={() => setShowDeleteConfirm(true)}
                style={{ ...S.btn, background: '#fef2f2', color: '#ef4444', border: '1.5px solid #fecaca', marginTop: 8 }}>
                <Trash2 size={14} /> Remove Student
              </button>
            )}
          </>
        )}

        {/* ── QR TAB ── */}
        {tab === 'qr' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6 }}>
              {isStudent
                ? 'Show this QR to your teacher to mark attendance or verify your identity'
                : `Scan to verify ${student.name}'s identity`}
            </div>
            <QRCode value={student.npub} size={200} />
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, lineHeight: 1.7 }}>
              {student.npub}
            </div>
            <button onClick={() => copy(student.npub, 'npub')} style={{ ...S.btn, marginTop: 12, background: '#f0fdf4', color: '#00c97a', border: '1.5px solid #bbf7d0' }}>
              {copied === 'npub' ? <CheckCircle size={14} /> : <Copy size={14} />}
              {copied === 'npub' ? 'Copied!' : 'Copy npub'}
            </button>
          </div>
        )}

        {/* ── KEYS TAB ── */}
        {tab === 'keys' && (
          <div>
            {isStudent ? (
              <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.7, padding: '10px 13px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa', display: 'flex', gap: 8, marginBottom: 16 }}>
                <Shield size={14} color="#f97316" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Back up your keys safely. Losing your private key means losing access forever — there is no recovery.</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#1e40af', lineHeight: 1.7, padding: '10px 13px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', display: 'flex', gap: 8, marginBottom: 16 }}>
                <Shield size={14} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Share the private key with <strong>{student.name}</strong> or their parent so they can log in. Send it via WhatsApp, SMS, or print it out.</span>
              </div>
            )}

            {/* Public key */}
            <div style={{ ...S.keySection, marginBottom: 10 }}>
              <div style={{ ...S.keyLabel, color: '#00c97a' }}>PUBLIC KEY — safe to share</div>
              <div style={{ ...S.mono, fontSize: 11, wordBreak: 'break-all', lineHeight: 1.7 }}>{student.npub}</div>
              <button onClick={() => copy(student.npub, 'npub')} style={S.copyBtn}>
                {copied === 'npub' ? <CheckCircle size={13} color="#00c97a" /> : <Copy size={13} />}
                {copied === 'npub' ? 'Copied!' : 'Copy npub'}
              </button>
            </div>

            {/* Private key */}
            <div style={{ ...S.keySection, border: '1.5px solid #fecaca', background: 'rgba(239,68,68,0.05)', marginBottom: 10 }}>
              <div style={{ ...S.keyLabel, color: '#ef4444' }}>
                {isStudent ? 'PRIVATE KEY — NEVER share with anyone!' : 'PRIVATE KEY — share only with this student'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ ...S.mono, fontSize: 11, wordBreak: 'break-all', lineHeight: 1.7, flex: 1, letterSpacing: nsecVisible ? 0 : 2 }}>
                  {nsecVisible ? student.nsec : '•'.repeat(52)}
                </div>
                <button onClick={() => setNsecVisible(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0 }}>
                  {nsecVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => copy(student.nsec, 'nsec')} style={{ ...S.copyBtn, flex: 1, justifyContent: 'center' }}>
                  {copied === 'nsec' ? <CheckCircle size={13} color="#00c97a" /> : <Copy size={13} />}
                  {copied === 'nsec' ? 'Copied!' : 'Copy nsec'}
                </button>
                {!isStudent && (
                  <button
                    onClick={() => {
                      const msg = `Your GradeBase login key for ${student.name}:\n\n${student.nsec}\n\nOpen GradeBase → "I Have a Key (Login)" → paste this key.`
                      if (navigator.share) {
                        navigator.share({ title: `${student.name} — GradeBase Key`, text: msg })
                      } else {
                        copy(msg, 'share')
                      }
                    }}
                    style={{ ...S.copyBtn, flex: 1, justifyContent: 'center', borderColor: '#bfdbfe', color: '#3b82f6' }}
                  >
                    <Copy size={13} />
                    {copied === 'share' ? 'Copied!' : 'Share'}
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', padding: '10px 13px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', lineHeight: 1.7 }}>
              {isStudent
                ? 'Save your private key in a password manager. If you lose it, you lose access to your identity forever — there is no way to recover it.'
                : `Once ${student.name} logs in with this key, they will see their profile, attendance and payment history.`
              }
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 64,
    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
    zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
  },
  sheet: {
    width: '100%', maxWidth: 480,
    background: 'var(--surface)', borderRadius: '20px 20px 0 0',
    padding: '24px 20px 32px', position: 'relative',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
    maxHeight: '100%', overflowY: 'auto',
  },
  closeBtn: {
    position: 'absolute', top: 18, right: 18,
    background: 'var(--surface2)', border: 'none',
    width: 32, height: 32, borderRadius: '50%',
    display: 'grid', placeItems: 'center',
    cursor: 'pointer', color: 'var(--muted)',
  },
  infoRow: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 11, padding: '11px 13px', marginBottom: 8,
  },
  infoLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.8, color: 'var(--muted)', marginBottom: 5,
  },
  mono: { fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--text)' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' },
  btn: {
    width: '100%', padding: 13, borderRadius: 12, border: 'none',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  keySection: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 },
  keyLabel:   { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  copyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    marginTop: 10, background: 'transparent',
    border: '1.5px solid var(--border)', color: 'var(--muted)',
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-display)',
  },
}

