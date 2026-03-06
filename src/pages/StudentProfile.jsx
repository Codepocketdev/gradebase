import { useState, useEffect } from 'react'
import { SimplePool } from 'nostr-tools/pool'
import {
  Copy, CheckCircle, Eye, EyeOff, Shield, QrCode, User
} from 'lucide-react'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

function QRCode({ value, size = 200 }) {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=0d1117&margin=10&qzone=2`}
      alt="QR"
      style={{ width: size, height: size, borderRadius: 14, display: 'block', margin: '0 auto', border: '1px solid var(--border)' }}
    />
  )
}

export default function StudentProfile({ user }) {
  const [tab, setTab] = useState('profile')
  const [nostrProfile, setNostrProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [nsecVisible, setNsecVisible] = useState(false)
  const [copied, setCopied] = useState('')

  const tabs = [
    { id: 'profile', label: 'Profile', Icon: User   },
    { id: 'keys',    label: 'My Keys', Icon: Shield },
    { id: 'qr',      label: 'QR Code', Icon: QrCode },
  ]

  // Fetch Nostr kind:0 from relay using logged-in user's pk
  useEffect(() => {
    if (!user?.pk) return
    setLoading(true)
    const pool = new SimplePool()
    let sub
    try {
      sub = pool.subscribe(
        RELAYS,
        [{ kinds: [0], authors: [user.pk], limit: 1 }],
        {
          onevent(e) { try { setNostrProfile(JSON.parse(e.content)) } catch {} setLoading(false) },
          oneose()   { setLoading(false) },
        }
      )
    } catch { setLoading(false) }
    const t = setTimeout(() => { try { sub?.close() } catch {} setLoading(false) }, 6000)
    return () => { clearTimeout(t); try { sub?.close() } catch {} }
  }, [user?.pk])

  const copy = async (val, key) => {
    try { await navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(''), 2000) } catch {}
  }

  // Find this student's record from gb_classes to get name, class, grad
  const studentRecord = (() => {
    try {
      const classes = JSON.parse(localStorage.getItem('gb_classes')) || []
      for (const cls of classes) {
        const found = cls.students.find(s => s.npub === user.npub)
        if (found) return found
      }
    } catch {}
    return null
  })()

  const displayName = nostrProfile?.name || nostrProfile?.display_name || studentRecord?.name || 'Student'
  const avatarSrc   = nostrProfile?.picture || null
  const initials    = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const grad        = studentRecord?.grad || 'linear-gradient(135deg,#00c97a,#00a862)'
  const className   = studentRecord?.className || '—'

  return (
    <div style={S.page}>

      {/* Hero */}
      <div style={S.hero}>
        <div style={{ ...S.avatar, background: grad }}>
          {avatarSrc
            ? <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} onError={e => e.target.style.display = 'none'} />
            : initials
          }
        </div>
        <div style={S.heroName}>{loading ? '...' : displayName}</div>
        <div style={S.heroSub}>{className}</div>
        {nostrProfile?.nip05 && (
          <div style={S.verified}>
            <CheckCircle size={11} /> {nostrProfile.nip05}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            ...S.tab,
            borderBottom: `2.5px solid ${tab === id ? 'var(--accent)' : 'transparent'}`,
            color: tab === id ? 'var(--accent)' : 'var(--muted)',
            fontWeight: tab === id ? 800 : 600,
          }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <div style={S.content}>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <>
            {nostrProfile?.about && (
              <div style={S.card}>
                <div style={S.cardLabel}>About</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, marginTop: 4 }}>{nostrProfile.about}</div>
              </div>
            )}
            <div style={S.card}>
              <div style={S.cardLabel}>Class</div>
              <div style={S.cardValue}>{className}</div>
            </div>
            <div style={S.card}>
              <div style={S.cardLabel}>Public Key (npub)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <div style={S.mono}>{user.npub.slice(0, 18)}...{user.npub.slice(-8)}</div>
                <button style={S.iconBtn} onClick={() => copy(user.npub, 'npub')}>
                  {copied === 'npub' ? <CheckCircle size={14} color="var(--accent)" /> : <Copy size={14} color="var(--muted)" />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── KEYS TAB ── */}
        {tab === 'keys' && (
          <>
            <div style={S.warnBox}>
              <Shield size={14} color="#f97316" style={{ flexShrink: 0 }} />
              <span>Back up your keys safely. Losing your private key means losing access forever — there is no recovery.</span>
            </div>

            {/* Public key */}
            <div style={{ ...S.card, borderColor: 'var(--accent)', borderWidth: 1.5 }}>
              <div style={{ ...S.cardLabel, color: 'var(--accent)' }}>PUBLIC KEY — safe to share</div>
              <div style={{ ...S.mono, wordBreak: 'break-all', lineHeight: 1.7, marginTop: 6 }}>{user.npub}</div>
              <button onClick={() => copy(user.npub, 'npub')} style={S.copyBtn}>
                {copied === 'npub' ? <CheckCircle size={13} color="var(--accent)" /> : <Copy size={13} />}
                {copied === 'npub' ? 'Copied!' : 'Copy npub'}
              </button>
            </div>

            {/* Private key */}
            <div style={{ ...S.card, borderColor: '#fecaca', borderWidth: 1.5, background: 'rgba(239,68,68,0.04)' }}>
              <div style={{ ...S.cardLabel, color: '#ef4444' }}>PRIVATE KEY — never share with anyone!</div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
                <div style={{ ...S.mono, wordBreak: 'break-all', lineHeight: 1.7, flex: 1, letterSpacing: nsecVisible ? 0 : 2 }}>
                  {nsecVisible ? user.nsec : '•'.repeat(52)}
                </div>
                <button onClick={() => setNsecVisible(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0 }}>
                  {nsecVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button onClick={() => copy(user.nsec, 'nsec')} style={S.copyBtn}>
                {copied === 'nsec' ? <CheckCircle size={13} color="var(--accent)" /> : <Copy size={13} />}
                {copied === 'nsec' ? 'Copied!' : 'Copy nsec'}
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', padding: '10px 13px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', lineHeight: 1.7 }}>
              Save your private key in a password manager. If you lose it, you lose access to your account forever.
            </div>
          </>
        )}

        {/* ── QR TAB ── */}
        {tab === 'qr' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
              Show this to your teacher to mark attendance or verify your identity
            </div>
            <QRCode value={user.npub} size={220} />
            <div style={{ marginTop: 16, ...S.mono, fontSize: 11, wordBreak: 'break-all', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, lineHeight: 1.7 }}>
              {user.npub}
            </div>
            <button onClick={() => copy(user.npub, 'npub')} style={{ ...S.copyBtn, marginTop: 12, width: '100%', justifyContent: 'center' }}>
              {copied === 'npub' ? <CheckCircle size={14} color="var(--accent)" /> : <Copy size={14} />}
              {copied === 'npub' ? 'Copied!' : 'Copy npub'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },

  hero: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 24px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' },
  avatar: { width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 28, fontWeight: 800, color: '#fff', overflow: 'hidden', border: '3px solid var(--border)' },
  heroName: { fontSize: 24, fontWeight: 800, color: 'var(--text)', marginTop: 14 },
  heroSub: { fontSize: 13, color: 'var(--muted)', marginTop: 4 },
  verified: { fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 },

  tabs: { display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' },
  tab: { flex: 1, padding: '13px 4px', background: 'none', border: 'none', borderBottom: '2.5px solid transparent', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 },

  content: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 },

  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px' },
  cardLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' },
  cardValue: { fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4 },

  mono: { fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: 'var(--text)' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 },

  warnBox: { fontSize: 12, color: '#92400e', lineHeight: 1.7, padding: '10px 13px', background: '#fff7ed', borderRadius: 10, border: '1px solid #fed7aa', display: 'flex', gap: 8 },

  copyBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, background: 'transparent', border: '1.5px solid var(--border)', color: 'var(--muted)', padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)' },

  btn: { width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 },
}

