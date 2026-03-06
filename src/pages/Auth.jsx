import { useState } from 'react'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import {
  Eye, EyeOff, ChevronRight, Copy, Check, AlertTriangle,
  Crown, BookOpen, GraduationCap, Wallet, ShieldCheck, School, Clock
} from 'lucide-react'
import { detectRole, getNameForNpub, saveSchool } from '../db'
import { fetchAndSeed, publishSchool } from '../nostrSync'

const ROLES = [
  { id: 'admin',   label: 'Admin',   sub: 'School owner', Icon: Crown,         color: '#fbbf24', hint: 'Enter your admin private key' },
  { id: 'teacher', label: 'Teacher', sub: 'Staff member', Icon: BookOpen,      color: '#4fffb0', hint: 'Enter your teacher private key' },
  { id: 'student', label: 'Student', sub: 'Learner',      Icon: GraduationCap, color: '#a78bfa', hint: 'Enter the key your teacher gave you' },
]

export default function Auth({ onAuth }) {
  const [mode, setMode]         = useState('welcome')
  const [setupStep, setSetupStep] = useState(1)

  // Login
  const [selectedRole, setSelectedRole]   = useState(null)
  const [pressedRole, setPressedRole]     = useState(null)
  const [nsecInput, setNsecInput]         = useState('')
  const [showNsec, setShowNsec]           = useState(false)
  const [schoolNpub, setSchoolNpub]       = useState('')  // for teacher: admin npub
  const [teacherNpub, setTeacherNpub]     = useState('')  // for student: teacher npub
  const [loading, setLoading]             = useState(false)
  const [fetching, setFetching]           = useState(false)
  const [error, setError]                 = useState('')

  // Setup
  const [schoolName, setSchoolName] = useState('')
  const [adminName, setAdminName]   = useState('')
  const [generated, setGenerated]   = useState(null)
  const [showKey, setShowKey]       = useState(false)
  const [copied, setCopied]         = useState(false)
  const [confirmed, setConfirmed]   = useState(false)

  const reset = () => {
    setMode('welcome'); setSetupStep(1); setSelectedRole(null); setPressedRole(null)
    setNsecInput(''); setShowNsec(false); setLoading(false); setFetching(false); setError('')
    setSchoolNpub(''); setTeacherNpub('')
    setSchoolName(''); setAdminName(''); setGenerated(null)
    setShowKey(false); setCopied(false); setConfirmed(false)
  }

  // ── LOGIN ────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!nsecInput.trim())                    { setError('Please enter your private key'); return }
    if (!nsecInput.trim().startsWith('nsec1')) { setError('Key must start with nsec1'); return }

    setLoading(true); setError('')

    try {
      const { data: sk } = nip19.decode(nsecInput.trim())
      const pk   = getPublicKey(sk)
      const npub = nip19.npubEncode(pk)

      // ── ADMIN LOGIN ──────────────────────────────────────────────
      if (selectedRole === 'admin') {
        setFetching(true)
        // Fetch admin's own school event from Nostr to verify they are a real admin
        const result = await fetchAndSeed({ role: 'admin', userNsec: nsecInput.trim(), userPk: pk })
        setFetching(false)

        const detectedRole = await detectRole(npub)

        if (!detectedRole) {
          // No school event found — could be a brand new admin or wrong key
          // Allow through but with 'admin' role — setup will publish school event
          onAuth({ nsec: nsecInput.trim(), npub, pk, role: 'admin', name: 'Admin' })
          return
        }
        if (detectedRole !== 'admin') {
          setError(`This key belongs to a ${detectedRole}, not an admin.`)
          setLoading(false); return
        }
        const name = await getNameForNpub(npub, 'admin')
        onAuth({ nsec: nsecInput.trim(), npub, pk, role: 'admin', name })
        return
      }

      // ── TEACHER LOGIN ────────────────────────────────────────────
      if (selectedRole === 'teacher') {
        // First check local DB
        let detectedRole = await detectRole(npub)

        if (!detectedRole) {
          // Not in local DB — need admin npub to fetch from Nostr
          if (!schoolNpub.trim()) {
            setError('Not found locally — enter your School ID (npub) to sync from Nostr')
            setLoading(false); return
          }
          if (!schoolNpub.trim().startsWith('npub1')) {
            setError('School ID must start with npub1')
            setLoading(false); return
          }
          setFetching(true)
          const result = await fetchAndSeed({
            role:      'teacher',
            userNsec:  nsecInput.trim(),
            userPk:    pk,
            adminNpub: schoolNpub.trim(),
          })
          setFetching(false)
          if (!result.found) {
            setError(result.error || 'School not found on Nostr. Check School ID.')
            setLoading(false); return
          }
          detectedRole = await detectRole(npub)
        }

        if (!detectedRole) {
          setError('Teacher not found. Ask your admin to add you first.')
          setLoading(false); return
        }
        if (detectedRole !== 'teacher') {
          setError(`This key belongs to a ${detectedRole}, not a teacher.`)
          setLoading(false); return
        }
        const name = await getNameForNpub(npub, 'teacher')
        onAuth({ nsec: nsecInput.trim(), npub, pk, role: 'teacher', name })
        return
      }

      // ── STUDENT LOGIN ────────────────────────────────────────────
      if (selectedRole === 'student') {
        let detectedRole = await detectRole(npub)

        if (!detectedRole) {
          // Need teacher's npub to fetch class list from Nostr
          if (!teacherNpub.trim()) {
            setError('Not found locally — enter your Teacher ID (npub) to sync from Nostr')
            setLoading(false); return
          }
          if (!teacherNpub.trim().startsWith('npub1')) {
            setError('Teacher ID must start with npub1')
            setLoading(false); return
          }
          setFetching(true)
          const result = await fetchAndSeed({
            role:        'student',
            userNsec:    nsecInput.trim(),
            userPk:      pk,
            teacherNpub: teacherNpub.trim(),
          })
          setFetching(false)
          if (!result.found) {
            setError(result.error || 'Class data not found. Check Teacher ID.')
            setLoading(false); return
          }
          detectedRole = await detectRole(npub)
        }

        if (!detectedRole) {
          setError('Student not found. Ask your teacher to add you to a class first.')
          setLoading(false); return
        }
        if (detectedRole !== 'student') {
          setError(`This key belongs to a ${detectedRole}, not a student.`)
          setLoading(false); return
        }
        const name = await getNameForNpub(npub, 'student')
        onAuth({ nsec: nsecInput.trim(), npub, pk, role: 'student', name })
      }

    } catch (e) {
      console.error(e)
      setError('Invalid key — please check and try again')
      setLoading(false)
      setFetching(false)
    }
  }

  // ── SETUP ────────────────────────────────────────────────────────
  const handleSetupGenerate = () => {
    if (!schoolName.trim()) { setError('Enter your school name'); return }
    if (!adminName.trim())  { setError('Enter your name'); return }
    const sk = generateSecretKey()
    const pk = getPublicKey(sk)
    setGenerated({ nsec: nip19.nsecEncode(sk), npub: nip19.npubEncode(pk), pk })
    setError(''); setSetupStep(2)
  }

  const handleSetupConfirm = async () => {
    if (!confirmed) { setError('Please confirm you have backed up your key'); return }
    setLoading(true)
    const schoolData = {
      adminNpub:  generated.npub,
      adminName:  adminName.trim(),
      schoolName: schoolName.trim(),
      createdAt:  Date.now(),
    }
    await saveSchool(schoolData)
    publishSchool(generated.nsec, schoolData).catch(console.warn)
    onAuth({ nsec: generated.nsec, npub: generated.npub, pk: generated.pk, role: 'admin', name: adminName.trim() })
  }

  const copyKey = async () => {
    try { await navigator.clipboard.writeText(generated.nsec); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const btnLabel = fetching ? 'Fetching from Nostr...' : loading ? 'Verifying...' : `Login as ${ROLES.find(r => r.id === selectedRole)?.label}`

  // ════════════════════════════════════════════════════════════════
  // WELCOME
  // ════════════════════════════════════════════════════════════════
  if (mode === 'welcome') return (
    <div style={S.page}>
      <div style={S.brand}>
        <div style={S.logoWrap}>
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L6 16V32L24 42L42 32V16L24 6Z" stroke="#4fffb0" strokeWidth="2" fill="none"/>
            <path d="M24 6L24 42M6 16L42 32M42 16L6 32" stroke="#4fffb0" strokeWidth="1" opacity="0.4"/>
            <circle cx="24" cy="24" r="5" fill="#4fffb0"/>
          </svg>
        </div>
        <div style={S.brandName}>Grade<span style={{ color: 'var(--accent)' }}>Base</span></div>
        <div style={S.brandSub}>The smartest way to run your school</div>
      </div>

      <div style={S.featureGrid}>
        {[
          { color: '#4fffb0', Icon: Wallet,      title: 'Track Every Payment',   sub: 'Know exactly who paid and what is outstanding.' },
          { color: '#a78bfa', Icon: ShieldCheck, title: 'Never Lose a Record',   sub: 'Every fee and student stored safely.' },
          { color: '#38bdf8', Icon: School,      title: 'Built for Your School', sub: 'From 50 to 5,000 students, GradeBase adapts.' },
          { color: '#fbbf24', Icon: Clock,       title: 'Save Hours Weekly',     sub: 'Attendance and payments in minutes.' },
        ].map(({ color, Icon, title, sub }) => (
          <div key={title} style={S.featureCard}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, display: 'grid', placeItems: 'center' }}>
              <Icon size={16} color={color} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginTop: 2 }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={S.ctaGroup}>
        <button style={S.primaryBtn} onClick={() => setMode('login')}>
          Login to GradeBase <ChevronRight size={16} />
        </button>
        <button style={S.secondaryBtn} onClick={() => setMode('setup')}>
          Set Up New School
        </button>
        <div style={S.footNote}>Secured by Nostr Protocol</div>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════
  // LOGIN — Step 1: pick role (65px gaps, glow + fill on press)
  // ════════════════════════════════════════════════════════════════
  if (mode === 'login' && !selectedRole) return (
    <div style={S.page}>
      <style>{`
        @keyframes glowPulse {
          0%,100% { opacity:1 }
          50%      { opacity:0.6 }
        }
        .gb-role-btn { transition: transform 0.1s ease, box-shadow 0.1s ease; }
        .gb-role-btn:active { transform: scale(0.97); }
      `}</style>

      <button style={S.backBtn} onClick={reset}>← Back</button>

      <div style={S.section}>
        <div style={S.pageTitle}>Who are you?</div>
        <div style={S.pageSub}>Select your role to continue</div>
      </div>

      <div style={S.roleStack}>
        {ROLES.map(({ id, label, sub, Icon, color }, index) => {
          const pressed = pressedRole === id
          return (
            <button
              key={id}
              className="gb-role-btn"
              style={{
                ...S.roleRow,
                marginTop:  index === 0 ? 0 : 65,
                border:     `1.5px solid ${pressed ? color : `${color}55`}`,
                boxShadow:  pressed
                  ? `0 0 0 3px ${color}30, 0 0 28px ${color}40`
                  : `0 0 16px ${color}18`,
                background: pressed ? color : `${color}08`,
                animation:  pressed ? 'none' : `glowPulse 3s ease-in-out infinite`,
              }}
              onPointerDown={() => setPressedRole(id)}
              onPointerUp={() => { setPressedRole(null); setSelectedRole(id); setError('') }}
              onPointerLeave={() => setPressedRole(null)}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                background: pressed ? 'rgba(0,0,0,0.15)' : `${color}18`,
                display: 'grid', placeItems: 'center',
              }}>
                <Icon size={24} color={pressed ? '#0d0f14' : color} />
              </div>

              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: pressed ? '#0d0f14' : 'var(--text)' }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, color: pressed ? 'rgba(0,0,0,0.55)' : 'var(--muted)', marginTop: 2 }}>
                  {sub}
                </div>
              </div>

              <ChevronRight size={18} color={pressed ? '#0d0f14' : 'var(--muted)'} />
            </button>
          )
        })}
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════
  // LOGIN — Step 2: enter keys
  // ════════════════════════════════════════════════════════════════
  if (mode === 'login' && selectedRole) {
    const roleObj = ROLES.find(r => r.id === selectedRole)
    return (
      <div style={S.page}>
        <button style={S.backBtn} onClick={() => { setSelectedRole(null); setError(''); setNsecInput(''); setSchoolNpub(''); setTeacherNpub('') }}>← Back</button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Role badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: 16,
            background: `${roleObj.color}10`,
            border: `1.5px solid ${roleObj.color}40`,
            borderRadius: 18,
            boxShadow: `0 0 20px ${roleObj.color}18`,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: `${roleObj.color}18`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <roleObj.Icon size={26} color={roleObj.color} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{roleObj.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{roleObj.sub}</div>
            </div>
          </div>

          <div style={S.section}>
            <div style={S.pageTitle}>Welcome back</div>
            <div style={S.pageSub}>{roleObj.hint}</div>
          </div>
        </div>

        {/* nsec */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={S.label}>Private Key (nsec)</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...S.input, paddingRight: 48, fontFamily: 'var(--font-mono)', letterSpacing: showNsec ? 0 : 2 }}
              type={showNsec ? 'text' : 'password'}
              value={nsecInput}
              placeholder="nsec1..."
              onChange={e => { setNsecInput(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleLogin()}
              autoFocus
            />
            <button onClick={() => setShowNsec(v => !v)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'grid', placeItems: 'center', padding: 0 }}>
              {showNsec ? <EyeOff size={17}/> : <Eye size={17}/>}
            </button>
          </div>
        </div>

        {/* Teacher: needs School ID (admin npub) on fresh device */}
        {selectedRole === 'teacher' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={S.label}>School ID — first time on this device</label>
            <input
              style={{ ...S.input, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              placeholder="npub1... (get from your admin)"
              value={schoolNpub}
              onChange={e => { setSchoolNpub(e.target.value); setError('') }}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
              Only needed the first time. Admin shares their npub with you.
            </div>
          </div>
        )}

        {/* Student: needs Teacher ID (teacher npub) on fresh device */}
        {selectedRole === 'student' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={S.label}>Teacher ID — first time on this device</label>
            <input
              style={{ ...S.input, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              placeholder="npub1... (get from your teacher)"
              value={teacherNpub}
              onChange={e => { setTeacherNpub(e.target.value); setError('') }}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
              Only needed the first time. Your teacher shares their npub with you.
            </div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 12, color: '#ef4444', fontWeight: 600, lineHeight: 1.5 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} color="#ef4444" />
            {error}
          </div>
        )}

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            style={{ ...S.primaryBtn, background: (loading || fetching) ? 'var(--muted)' : roleObj.color, color: '#0d0f14', opacity: (loading || fetching) ? 0.8 : 1 }}
            onClick={handleLogin}
            disabled={loading || fetching}
          >
            {btnLabel} {!loading && !fetching && <ChevronRight size={16}/>}
          </button>
          <div style={S.footNote}>Your key never leaves this device</div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // SETUP — Step 1
  // ════════════════════════════════════════════════════════════════
  if (mode === 'setup' && setupStep === 1) return (
    <div style={S.page}>
      <button style={S.backBtn} onClick={reset}>← Back</button>

      <div style={S.section}>
        <div style={S.pill}>Step 1 of 2</div>
        <div style={S.pageTitle}>Set Up Your School</div>
        <div style={S.pageSub}>You'll be the admin. Add teachers after setup.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={S.label}>School Name</label>
          <input style={S.input} placeholder="e.g. Nairobi Academy" value={schoolName}
            onChange={e => { setSchoolName(e.target.value); setError('') }} autoFocus />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <label style={S.label}>Your Name</label>
          <input style={S.input} placeholder="e.g. John Kamau" value={adminName}
            onChange={e => { setAdminName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSetupGenerate()} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</div>}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <button style={S.primaryBtn} onClick={handleSetupGenerate}>
          Generate Admin Key <ChevronRight size={16}/>
        </button>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════
  // SETUP — Step 2: backup key
  // ════════════════════════════════════════════════════════════════
  if (mode === 'setup' && setupStep === 2) return (
    <div style={S.page}>
      <button style={S.backBtn} onClick={() => setSetupStep(1)}>← Back</button>

      <div style={S.section}>
        <div style={S.pill}>Step 2 of 2</div>
        <div style={S.pageTitle}>Back Up Your Key</div>
        <div style={S.pageSub}>This is your only way back in. <strong>No recovery if lost.</strong></div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }}>
        <div style={S.label}>Your Private Key (nsec)</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all', lineHeight: 1.9, marginTop: 10, marginBottom: 12 }}>
          {showKey ? generated.nsec : generated.nsec.slice(0, 14) + '•'.repeat(46)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.keyBtn} onClick={() => setShowKey(v => !v)}>
            {showKey ? <EyeOff size={13}/> : <Eye size={13}/>} {showKey ? 'Hide' : 'Reveal'}
          </button>
          <button style={S.keyBtn} onClick={copyKey}>
            {copied ? <Check size={13} color="var(--accent)"/> : <Copy size={13}/>}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* School ID — share with teachers */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px' }}>
        <div style={{ ...S.label, marginBottom: 6 }}>School ID (npub) — Share with teachers</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.7 }}>
          {generated.npub}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 12, fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>
        <AlertTriangle size={15} color="#f97316" style={{ flexShrink: 0, marginTop: 1 }}/>
        <span>This key controls your entire school. Save it in a password manager. Never share it.</span>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
        <input type="checkbox" checked={confirmed}
          onChange={e => { setConfirmed(e.target.checked); setError('') }}
          style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}/>
        I have safely backed up my private key
      </label>
      {error && <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>{error}</div>}

      <div style={{ marginTop: 'auto' }}>
        <button style={{ ...S.primaryBtn, opacity: loading ? 0.7 : 1 }} onClick={handleSetupConfirm} disabled={loading}>
          {loading ? 'Setting up...' : 'Enter GradeBase'} {!loading && <ChevronRight size={16}/>}
        </button>
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────
const S = {
  page:        { minHeight: '100vh', padding: '24px 22px 44px', display: 'flex', flexDirection: 'column', gap: 22, background: 'var(--bg)', maxWidth: 480, margin: '0 auto', fontFamily: 'var(--font-display)', boxSizing: 'border-box' },
  backBtn:     { background: 'none', border: 'none', color: 'var(--muted)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', padding: 0 },
  brand:       { display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 },
  logoWrap:    { width: 60, height: 60, background: 'rgba(79,255,176,0.07)', border: '1px solid rgba(79,255,176,0.15)', borderRadius: 17, display: 'grid', placeItems: 'center' },
  brandName:   { fontSize: 34, fontWeight: 800, color: 'var(--text)', letterSpacing: -1, lineHeight: 1 },
  brandSub:    { fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 },
  featureGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  featureCard: { padding: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 7 },
  section:     { display: 'flex', flexDirection: 'column', gap: 6 },
  pill:        { display: 'inline-flex', alignSelf: 'flex-start', padding: '4px 10px', borderRadius: 20, background: 'rgba(79,255,176,0.1)', color: 'var(--accent)', fontSize: 11, fontWeight: 700 },
  pageTitle:   { fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5, lineHeight: 1.2 },
  pageSub:     { fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 },
  roleStack:   { display: 'flex', flexDirection: 'column' },
  roleRow:     { display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'var(--font-display)', width: '100%' },
  label:       { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' },
  input:       { width: '100%', padding: '13px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  keyBtn:      { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)' },
  ctaGroup:    { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' },
  primaryBtn:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 15, background: 'var(--accent)', border: 'none', borderRadius: 14, color: '#0d0f14', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, cursor: 'pointer' },
  secondaryBtn:{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 15, background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  footNote:    { textAlign: 'center', fontSize: 11, color: 'var(--muted)' },
}

