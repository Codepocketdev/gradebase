import { useState, useEffect, useRef } from 'react'
import { finalizeEvent } from 'nostr-tools'
import { ArrowLeft, Camera, User, School, Zap, Shield, Eye, EyeOff, Copy, Check, Loader, Users } from 'lucide-react'
import { getSchool, getTeachers, getClasses } from '../db'
import { uploadImage, skFromNsec } from '../nostrSync'
import { useNostrProfile } from '../hooks/useNostrProfile'
import { updateCachedProfile } from '../utils/profileCache'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

export default function AdminProfile({ user, syncState, onBack, onUpdateUser }) {
  const { profile, loading: profileLoading } = useNostrProfile(user?.pk)

  const [displayName, setDisplayName]     = useState(user?.name    || '')
  const [about, setAbout]                 = useState('')
  const [previewAvatar, setPreviewAvatar] = useState(user?.avatar  || '')
  const [schoolName, setSchoolName]       = useState('')
  const [teacherCount, setTeacherCount]   = useState(0)
  const [studentCount, setStudentCount]   = useState(0)
  const [showNsec, setShowNsec]           = useState(false)
  const [copiedNpub, setCopiedNpub]       = useState(false)
  const [copiedNsec, setCopiedNsec]       = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const fileRef = useRef(null)

  // Hydrate edit fields from hook — only if user hasn't started editing
  useEffect(() => {
    if (!profile) return
    setDisplayName(v => v || profile.name || profile.display_name || user?.name || '')
    setAbout(v       => v || profile.about || '')
    setPreviewAvatar(v => v || profile.picture || '')
  }, [profile])

  useEffect(() => {
    getSchool().then(s => {
      setSchoolName(s?.schoolName || '')
      if (!s?.schoolName) {
        try { const c = localStorage.getItem('gb_school_cache'); if (c) setSchoolName(JSON.parse(c).schoolName || '') } catch {}
      }
    })
    getTeachers().then(t => setTeacherCount(t?.length || 0))
    getClasses().then(cls => setStudentCount((cls||[]).reduce((s,c) => s+(c.students?.length||0), 0)))
  }, [])

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
      const content = { name: displayName.trim()||user.name||'Admin', display_name: displayName.trim()||user.name||'Admin', about: about.trim(), picture: previewAvatar||'' }
      const event = finalizeEvent({ kind:0, created_at: Math.floor(Date.now()/1000), tags:[], content: JSON.stringify(content) }, sk)
      await Promise.any(RELAYS.map(r => new Promise((res, rej) => {
        const ws = new WebSocket(r)
        ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]))
        ws.onmessage = ({ data }) => { try { if (JSON.parse(data)[0]==='OK') { ws.close(); res() } } catch {} }
        ws.onerror = rej; setTimeout(rej, 8000)
      })))
      // Update cache immediately — no stale flash next time
      updateCachedProfile(user.pk, content)
      if (onUpdateUser) onUpdateUser({ ...user, name: displayName.trim(), avatar: previewAvatar })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch {}
    setSaving(false)
  }

  const copy = async (text, w) => {
    try { await navigator.clipboard.writeText(text); if(w==='npub'){setCopiedNpub(true);setTimeout(()=>setCopiedNpub(false),2000)} else {setCopiedNsec(true);setTimeout(()=>setCopiedNsec(false),2000)} } catch {}
  }

  const syncColor = s => s==='synced'?'#22c55e':s==='syncing'?'#fbbf24':'#ef4444'
  const syncLabel = s => s==='synced'?'● Live':s==='syncing'?'◌ Syncing…':'○ Offline'

  return (
    <div style={{ padding:'16px 20px 100px', display:'flex', flexDirection:'column', gap:16, maxWidth:480, margin:'0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      {onBack && <button onClick={onBack} style={C.back}><ArrowLeft size={16}/> Back</button>}

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'24px 0 8px' }}>
        <div style={{ position:'relative' }}>
          {previewAvatar
            ? <img src={previewAvatar} alt="avatar" style={{ width:96, height:96, borderRadius:26, objectFit:'cover', border:'3px solid var(--accent)' }} onError={e=>e.target.style.display='none'}/>
            : <div style={{ width:96, height:96, borderRadius:26, background:'rgba(79,255,176,0.1)', border:'2px solid rgba(79,255,176,0.3)', display:'grid', placeItems:'center' }}><User size={42} color="var(--accent)" strokeWidth={1.5}/></div>
          }
          <button onClick={() => !uploading && fileRef.current?.click()} style={{ position:'absolute', bottom:-4, right:-4, width:32, height:32, borderRadius:10, background:uploading?'var(--muted)':'var(--accent)', border:'2px solid var(--bg)', display:'grid', placeItems:'center', cursor:uploading?'not-allowed':'pointer' }}>
            {uploading ? <Loader size={14} color="#0d0f14" style={{animation:'spin 1s linear infinite'}}/> : <Camera size={15} color="#0d0f14"/>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarFile}/>
        </div>
        {uploadError && <div style={{fontSize:11,color:'#ef4444',fontWeight:600}}>{uploadError}</div>}
        {profileLoading
          ? <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--muted)',fontSize:13}}><Loader size={14} style={{animation:'spin 1s linear infinite'}}/> Loading profile…</div>
          : <>
              <div style={{fontSize:20,fontWeight:800,color:'var(--text)',textAlign:'center'}}>{displayName||user?.name||'Admin'}</div>
              <div style={{fontSize:12,color:'var(--accent)',fontWeight:600}}>Admin · {schoolName||'—'}</div>
            </>
        }
      </div>

      <div style={C.card}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}><School size={14} color="var(--accent)"/><span style={C.label}>School</span></div>
        <div style={{fontSize:18,fontWeight:800,color:'var(--text)',marginBottom:10}}>{schoolName||'—'}</div>
        <div style={{display:'flex',gap:24}}>
          <div><div style={{fontSize:20,fontWeight:800,color:'var(--accent)'}}>{teacherCount}</div><div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>Teachers</div></div>
          <div><div style={{fontSize:20,fontWeight:800,color:'var(--accent)'}}>{studentCount}</div><div style={{fontSize:11,color:'var(--muted)',fontWeight:700}}>Students</div></div>
        </div>
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:6}}><label style={C.label}>Display Name</label><input style={C.input} value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your name"/></div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}><label style={C.label}>About</label><textarea style={{...C.input,resize:'none',height:90,lineHeight:1.6}} value={about} onChange={e=>setAbout(e.target.value)} placeholder="About your school…"/></div>

      <div style={{display:'flex',gap:8,padding:'10px 12px',background:'rgba(79,255,176,0.05)',border:'1px solid rgba(79,255,176,0.15)',borderRadius:10,fontSize:11,color:'var(--muted)',lineHeight:1.6}}>
        <Zap size={13} color="var(--accent)" style={{flexShrink:0,marginTop:1}}/> Saving publishes a Nostr <strong style={{color:'var(--accent)'}}>kind:0</strong> — visible on the Nostr network.
      </div>

      <div style={C.card}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><Shield size={13} color="var(--accent)"/><span style={C.label}>Public Key (npub)</span></div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text)',wordBreak:'break-all',lineHeight:1.8}}>{user?.npub}</div>
        <button style={C.keyBtn} onClick={()=>copy(user?.npub,'npub')}>{copiedNpub?<Check size={12} color="var(--accent)"/>:<Copy size={12}/>} {copiedNpub?'Copied!':'Copy npub'}</button>
      </div>

      <div style={{...C.card,border:'1px solid rgba(251,191,36,0.3)'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}><Shield size={13} color="#fbbf24"/><span style={{...C.label,color:'#fbbf24'}}>Private Key (nsec) — Keep Secret</span></div>
        <div style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text)',wordBreak:'break-all',lineHeight:1.8}}>{showNsec?user?.nsec:(user?.nsec?.slice(0,14)+'•'.repeat(44))}</div>
        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button style={C.keyBtn} onClick={()=>setShowNsec(v=>!v)}>{showNsec?<EyeOff size={12}/>:<Eye size={12}/>} {showNsec?'Hide':'Reveal'}</button>
          <button style={C.keyBtn} onClick={()=>copy(user?.nsec,'nsec')}>{copiedNsec?<Check size={12} color="var(--accent)"/>:<Copy size={12}/>} {copiedNsec?'Copied!':'Copy nsec'}</button>
        </div>
      </div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12}}>
        <span style={{fontSize:13,color:'var(--muted)'}}>Nostr Sync</span>
        <span style={{fontSize:13,fontWeight:700,color:syncColor(syncState)}}>{syncLabel(syncState)}</span>
      </div>

      <button onClick={handleSave} disabled={saving} style={{width:'100%',padding:16,background:saving?'var(--muted)':saved?'#22c55e':'var(--accent)',border:'none',borderRadius:14,color:'#0d0f14',fontFamily:'var(--font-display)',fontSize:15,fontWeight:800,cursor:'pointer',transition:'background 0.2s'}}>
        {saving?'Publishing to Nostr…':saved?'✓ Saved & Published':'Save Profile'}
      </button>
    </div>
  )
}

const C = {
  back:   { display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontFamily:'var(--font-display)', fontSize:13, fontWeight:600, alignSelf:'flex-start', padding:0 },
  card:   { padding:'14px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14 },
  label:  { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:0.8, color:'var(--muted)' },
  input:  { width:'100%', padding:'12px 14px', background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:12, color:'var(--text)', fontFamily:'var(--font-display)', fontSize:14, outline:'none', boxSizing:'border-box' },
  keyBtn: { display:'inline-flex', alignItems:'center', gap:6, marginTop:8, padding:'7px 14px', borderRadius:9, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-display)' },
}

