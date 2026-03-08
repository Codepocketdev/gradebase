import { useState, useEffect, useRef } from 'react'
import { finalizeEvent } from 'nostr-tools'
import { Copy, Check, Eye, EyeOff, Shield, QrCode, User, Camera, Loader, Zap, School } from 'lucide-react'
import { getClasses, getSchool } from '../db'
import { uploadImage, skFromNsec } from '../nostrSync'
import { useNostrProfile } from '../hooks/useNostrProfile'
import { updateCachedProfile } from '../utils/profileCache'

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

export default function StudentProfile({ user, syncState }) {
  const { profile, loading: profileLoading } = useNostrProfile(user?.pk)

  const [tab, setTab]                     = useState('profile')
  const [displayName, setDisplayName]     = useState(user?.name   || '')
  const [about, setAbout]                 = useState('')
  const [previewAvatar, setPreviewAvatar] = useState(user?.avatar || '')
  const [schoolName, setSchoolName]       = useState('')
  const [studentRecord, setStudentRecord] = useState(null)
  const [nsecVisible, setNsecVisible]     = useState(false)
  const [copied, setCopied]               = useState('')
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const fileRef = useRef(null)

  const tabs = [
    { id: 'profile', label: 'Profile', Icon: User   },
    { id: 'keys',    label: 'My Keys', Icon: Shield },
    { id: 'qr',      label: 'QR Code', Icon: QrCode },
  ]

  // Hydrate edit fields from hook — only fills empty so user edits aren't clobbered
  useEffect(() => {
    if (!profile) return
    setDisplayName(v => v || profile.name || profile.display_name || user?.name || '')
    setAbout(v       => v || profile.about || '')
    setPreviewAvatar(v => v || profile.picture || '')
  }, [profile])

  // School name + student record from IndexedDB
  useEffect(() => {
    getSchool().then(s => {
      setSchoolName(s?.schoolName || '')
      if (!s?.schoolName) {
        try { const c = localStorage.getItem('gb_school_cache'); if (c) setSchoolName(JSON.parse(c).schoolName||'') } catch {}
      }
    })
    getClasses().then(classes => {
      for (const cls of (classes||[])) {
        const found = cls.students?.find(s => s.npub === user.npub)
        if (found) { setStudentRecord({ ...found, className: cls.name }); break }
      }
    })
  }, [user.npub])

  // Fallback name from student record if kind:0 has no name yet
  useEffect(() => {
    if (!displayName && studentRecord?.name) setDisplayName(studentRecord.name)
  }, [studentRecord])

  const copy = async (val, key) => {
    try { await navigator.clipboard.writeText(val); setCopied(key); setTimeout(() => setCopied(''), 2000) } catch {}
  }

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10*1024*1024) { setUploadError('Max 10MB'); return }
    setUploading(true); setUploadError('')
    try { setPreviewAvatar(await uploadImage(user.nsec, file)) }
    catch { setUploadError('Upload failed') }
    setUploading(false)
  }

  const handleSave = async () => {
    if (!user?.nsec) return
    setSaving(true)
    try {
      const sk = skFromNsec(user.nsec)
      const content = {
        name:         displayName.trim() || studentRecord?.name || 'Student',
        display_name: displayName.trim() || studentRecord?.name || 'Student',
        about:        about.trim(),
        picture:      previewAvatar || '',
      }
      const event = finalizeEvent({ kind:0, created_at: Math.floor(Date.now()/1000), tags:[], content: JSON.stringify(content) }, sk)
      await Promise.any(RELAYS.map(r => new Promise((res, rej) => {
        const ws = new WebSocket(r)
        ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]))
        ws.onmessage = ({ data }) => { try { if (JSON.parse(data)[0]==='OK') { ws.close(); res() } } catch {} }
        ws.onerror = rej; setTimeout(rej, 8000)
      })))
      // Update cache immediately — no stale flash on next visit
      updateCachedProfile(user.pk, content)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const name      = displayName || studentRecord?.name || 'Student'
  const initials  = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const grad      = studentRecord?.grad || 'linear-gradient(135deg,#00c97a,#00a862)'
  const className = studentRecord?.className || '—'

  const syncColor = s => s==='synced'?'#22c55e':s==='syncing'?'#fbbf24':'#ef4444'
  const syncLabel = s => s==='synced'?'● Live':s==='syncing'?'◌ Syncing…':'○ Offline'

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero */}
      <div style={S.hero}>
        <div style={{ position:'relative' }}>
          <div style={{ ...S.avatar, background: previewAvatar ? 'transparent' : grad }}>
            {previewAvatar
              ? <img src={previewAvatar} alt="" style={{ width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%' }} onError={e=>e.target.style.display='none'}/>
              : initials
            }
          </div>
          <button onClick={() => !uploading && fileRef.current?.click()}
            style={{ position:'absolute',bottom:-4,right:-4,width:30,height:30,borderRadius:9,background:uploading?'var(--muted)':'var(--accent)',border:'2px solid var(--bg)',display:'grid',placeItems:'center',cursor:uploading?'not-allowed':'pointer' }}>
            {uploading?<Loader size={13} color="#0d0f14" style={{animation:'spin 1s linear infinite'}}/>:<Camera size={13} color="#0d0f14"/>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarFile}/>
        </div>
        {uploadError && <div style={{fontSize:11,color:'#ef4444',marginTop:6}}>{uploadError}</div>}
        {profileLoading
          ? <div style={{marginTop:14,display:'flex',alignItems:'center',gap:6,color:'var(--muted)',fontSize:13}}>
              <Loader size={14} style={{animation:'spin 1s linear infinite'}}/> Loading profile…
            </div>
          : <>
              <div style={S.heroName}>{name}</div>
              <div style={S.heroSub}>{className}{schoolName ? ` · ${schoolName}` : ''}</div>
            </>
        }
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            ...S.tab,
            borderBottom: `2.5px solid ${tab===id ? 'var(--accent)' : 'transparent'}`,
            color: tab===id ? 'var(--accent)' : 'var(--muted)',
            fontWeight: tab===id ? 800 : 600,
          }}>
            <Icon size={14}/> {label}
          </button>
        ))}
      </div>

      <div style={S.content}>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (<>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <label style={S.label}>Display Name</label>
            <input style={S.input} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name"/>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <label style={S.label}>About</label>
            <textarea style={{...S.input,resize:'none',height:80,lineHeight:1.6}} value={about} onChange={e=>setAbout(e.target.value)} placeholder="A short bio…"/>
          </div>

          <div style={S.card}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}><School size={13} color="var(--accent)"/><span style={S.label}>School</span></div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{schoolName||'—'}</div>
          </div>
          <div style={S.card}>
            <div style={S.label}>Class</div>
            <div style={{fontSize:14,fontWeight:700,color:'var(--text)',marginTop:4}}>{className}</div>
          </div>

          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12}}>
            <span style={{fontSize:13,color:'var(--muted)'}}>Nostr Sync</span>
            <span style={{fontSize:13,fontWeight:700,color:syncColor(syncState)}}>{syncLabel(syncState)}</span>
          </div>

          <div style={{display:'flex',gap:8,padding:'10px 12px',background:'rgba(79,255,176,0.05)',border:'1px solid rgba(79,255,176,0.15)',borderRadius:10,fontSize:11,color:'var(--muted)',lineHeight:1.6}}>
            <Zap size={13} color="var(--accent)" style={{flexShrink:0,marginTop:1}}/> Saving publishes a Nostr <strong style={{color:'var(--accent)'}}>kind:0</strong> — visible on the Nostr network.
          </div>

          <button onClick={handleSave} disabled={saving}
            style={{width:'100%',padding:14,background:saving?'var(--muted)':saved?'#22c55e':'var(--accent)',border:'none',borderRadius:12,color:'#0d0f14',fontFamily:'var(--font-display)',fontSize:15,fontWeight:800,cursor:'pointer',transition:'background 0.2s'}}>
            {saving?'Publishing…':saved?'✓ Saved & Published':'Save Profile'}
          </button>
        </>)}

        {/* ── KEYS TAB ── */}
        {tab === 'keys' && (<>
          <div style={S.warnBox}>
            <Shield size={14} color="#f97316" style={{flexShrink:0}}/>
            <span>Back up your keys safely. Losing your private key means losing access forever.</span>
          </div>
          <div style={{...S.card,borderColor:'var(--accent)',borderWidth:1.5}}>
            <div style={{...S.label,color:'var(--accent)'}}>Public Key — safe to share</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text)',wordBreak:'break-all',lineHeight:1.7,marginTop:6}}>{user.npub}</div>
            <button onClick={()=>copy(user.npub,'npub')} style={S.copyBtn}>
              {copied==='npub'?<Check size={13} color="var(--accent)"/>:<Copy size={13}/>} {copied==='npub'?'Copied!':'Copy npub'}
            </button>
          </div>
          <div style={{...S.card,borderColor:'#fecaca',borderWidth:1.5,background:'rgba(239,68,68,0.04)'}}>
            <div style={{...S.label,color:'#ef4444'}}>Private Key — never share!</div>
            <div style={{display:'flex',alignItems:'flex-start',gap:8,marginTop:6}}>
              <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text)',wordBreak:'break-all',lineHeight:1.7,flex:1}}>
                {nsecVisible ? user.nsec : '•'.repeat(52)}
              </div>
              <button onClick={()=>setNsecVisible(v=>!v)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:4,flexShrink:0}}>
                {nsecVisible?<EyeOff size={16}/>:<Eye size={16}/>}
              </button>
            </div>
            <button onClick={()=>copy(user.nsec,'nsec')} style={S.copyBtn}>
              {copied==='nsec'?<Check size={13} color="var(--accent)"/>:<Copy size={13}/>} {copied==='nsec'?'Copied!':'Copy nsec'}
            </button>
          </div>
        </>)}

        {/* ── QR TAB ── */}
        {tab === 'qr' && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:13,color:'var(--muted)',marginBottom:20,lineHeight:1.6}}>
              Show this to your teacher to mark attendance or verify your identity
            </div>
            <QRCode value={user.npub} size={220}/>
            <div style={{marginTop:16,fontFamily:'var(--font-mono)',fontSize:11,wordBreak:'break-all',padding:'10px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,lineHeight:1.7}}>
              {user.npub}
            </div>
            <button onClick={()=>copy(user.npub,'npub')} style={{...S.copyBtn,marginTop:12,width:'100%',justifyContent:'center'}}>
              {copied==='npub'?<Check size={14} color="var(--accent)"/>:<Copy size={14}/>} {copied==='npub'?'Copied!':'Copy npub'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  page:     { minHeight:'100vh', background:'var(--bg)', fontFamily:'var(--font-display)', paddingBottom:100 },
  hero:     { display:'flex', flexDirection:'column', alignItems:'center', padding:'36px 24px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)' },
  avatar:   { width:88, height:88, borderRadius:'50%', display:'grid', placeItems:'center', fontSize:28, fontWeight:800, color:'#fff', overflow:'hidden', border:'3px solid var(--border)' },
  heroName: { fontSize:24, fontWeight:800, color:'var(--text)', marginTop:14 },
  heroSub:  { fontSize:13, color:'var(--muted)', marginTop:4 },
  tabs:     { display:'flex', background:'var(--surface)', borderBottom:'1px solid var(--border)' },
  tab:      { flex:1, padding:'13px 4px', background:'none', border:'none', borderBottom:'2.5px solid transparent', cursor:'pointer', fontFamily:'var(--font-display)', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:5 },
  content:  { padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 },
  card:     { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'13px 14px' },
  label:    { fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:'var(--muted)' },
  input:    { width:'100%', padding:'12px 14px', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, color:'var(--text)', fontFamily:'var(--font-display)', fontSize:14, outline:'none', boxSizing:'border-box' },
  warnBox:  { fontSize:12, color:'#92400e', lineHeight:1.7, padding:'10px 13px', background:'#fff7ed', borderRadius:10, border:'1px solid #fed7aa', display:'flex', gap:8 },
  copyBtn:  { display:'inline-flex', alignItems:'center', gap:6, marginTop:10, background:'transparent', border:'1.5px solid var(--border)', color:'var(--muted)', padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-display)' },
}

