/**
 * GradeBase — Teacher Payments (View Only)
 * Step 1: render instantly from IndexedDB
 * Step 2: fetch fresh fee structures + payments from Nostr in BG
 * Step 3: update UI + save to DB when Nostr data arrives
 */
import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, ChevronRight, Search, Loader, Award, Check } from 'lucide-react'
import { getClasses, getPayments, getAllFeeStructures, getSchool, savePayment, saveFeeStructure } from '../../db'
import { computeStudentBalance } from '../../computeBalance'
import { fetchAllFeeStructures, fetchPaymentEntries } from '../../nostrSync'

const CURRENT_YEAR = new Date().getFullYear()
const TERMS = [
  { id: 'term1', label: 'Term 1' },
  { id: 'term2', label: 'Term 2' },
  { id: 'term3', label: 'Term 3' },
]
const fmt = (n) => `KSh ${Number(n||0).toLocaleString()}`



export default function TeacherPayments({ user, dataVersion }) {
  const [view, setView]             = useState('overview')
  const [myClasses, setMyClasses]   = useState([])
  const [selectedClass, setSelectedClass]     = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [payments, setPayments]     = useState([])
  const [feeStructures, setFeeStructures] = useState([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)   // BG Nostr fetch in progress
  const [search, setSearch]         = useState('')
  const [term, setTerm]             = useState('term1')
  const [year, setYear]             = useState(CURRENT_YEAR)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const load = async () => {
      // ── Step 1: render from IndexedDB immediately ─────────────────
      setLoading(true)
      const [classes, localPmts, localFees] = await Promise.all([
        getClasses(), getPayments(), getAllFeeStructures()
      ])
      const mine = (classes||[]).filter(c => c.teacherNpub === user.npub)
      if (mountedRef.current) {
        setMyClasses(mine)
        setPayments(localPmts||[])
        setFeeStructures(localFees||[])
        setLoading(false)
      }

      // ── Step 2: fetch fresh from Nostr in background ──────────────
      const school = await getSchool()
      if (!school?.adminNpub || !mountedRef.current) return

      setSyncing(true)
      try {
        const [nostrFees, nostrPmts] = await Promise.all([
          fetchAllFeeStructures(school.adminNpub),
          fetchPaymentEntries(school.adminNpub),
        ])

        if (!mountedRef.current) return

        if (nostrFees?.length) {
          for (const f of nostrFees) await saveFeeStructure(f).catch(() => {})
          setFeeStructures(nostrFees)
        }
        if (nostrPmts?.length) {
          for (const p of nostrPmts) await savePayment(p).catch(() => {})
          setPayments(nostrPmts)
        }
      } catch (e) {
        console.warn('[TeacherPayments] BG sync error:', e)
      }
      if (mountedRef.current) setSyncing(false)
    }
    load()
  }, [dataVersion, user.npub])

  const activeFees   = feeStructures.find(f => f.year === year && f.term === term) || null
  const termPayments = payments.filter(p => p.term === term && p.year === year)

  const goBack = () => {
    if (view === 'student') { setView('class'); return }
    if (view === 'class')   { setView('overview'); setSelectedClass(null); return }
    setView('overview')
  }

  // ── Sync badge shown in all headers ──────────────────────────────
  const SyncBadge = () => syncing ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
      <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Syncing
    </div>
  ) : null

  if (loading) return (
    <div style={S.page}>
      <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!myClasses.length) return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>Payments</div>
        <SyncBadge />
      </div>
      <div style={S.empty}>No classes assigned to you yet.</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── STUDENT DETAIL ────────────────────────────────────────────────
  if (view === 'student' && selectedStudent && selectedClass) {
    const bal     = computeStudentBalance(selectedStudent.npub, selectedStudent.lunchType, termPayments, activeFees, selectedClass.id)
    const history = termPayments.filter(p => p.studentNpub === selectedStudent.npub).sort((a,b) => b.createdAt-a.createdAt)
    return (
      <div style={S.page}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goBack} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span style={S.title}>{selectedStudent.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SyncBadge />
            <div style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(79,255,176,0.08)', border: '1px solid rgba(79,255,176,0.2)', borderRadius: 20, color: 'var(--accent)', fontWeight: 700 }}>View Only</div>
          </div>
        </div>
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 100 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Expected', value: bal.total,   color: 'var(--text)' },
              { label: 'Paid',     value: bal.paid,    color: '#22c55e' },
              { label: 'Balance',  value: bal.balance, color: bal.balance > 0 ? '#ef4444' : '#22c55e' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{fmt(value)}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
          {bal.fullyPaid && (
            <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>
              <Award size={16} /> Fully Paid
            </div>
          )}
          {bal.categories.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Categories</div>
              {bal.categories.map(cat => (
                <div key={cat.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {cat.done && <Check size={12} color="#22c55e" />}{cat.name}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cat.done ? '#22c55e' : 'var(--muted)' }}>
                      {fmt(cat.paid)} / {fmt(cat.amount)}
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cat.amount > 0 ? Math.min(100,(cat.paid/cat.amount)*100) : 0}%`, background: cat.done ? '#22c55e' : 'var(--accent)', borderRadius: 99 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {history.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Payment History</div>
              {history.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.categoryName}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(p.createdAt).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{fmt(p.amount)}</div>
                </div>
              ))}
            </div>
          )}
          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: 'var(--muted)' }}>No payments recorded yet for this term.</div>
          )}
        </div>
      </div>
    )
  }

  // ── CLASS STUDENT LIST ────────────────────────────────────────────
  if (view === 'class' && selectedClass) {
    const students = (selectedClass.students || []).filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    return (
      <div style={S.page}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goBack} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span style={S.title}>{selectedClass.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SyncBadge />
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={term} onChange={e => setTerm(e.target.value)} style={S.miniSelect}>
                {TERMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={S.miniSelect}>
                {[CURRENT_YEAR-1,CURRENT_YEAR,CURRENT_YEAR+1].map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px 0', position: 'relative' }}>
          <Search size={14} style={{ position:'absolute',left:34,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none',marginTop:6 }} />
          <input style={{ ...S.searchInput, paddingLeft: 36 }} placeholder="Search students..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100 }}>
          {students.map(stu => {
            const bal = computeStudentBalance(stu.npub, stu.lunchType, termPayments, activeFees, selectedClass.id)
            return (
              <button key={stu.npub} style={S.card} onClick={() => { setSelectedStudent(stu); setView('student') }}>
                <div style={{ width:42,height:42,borderRadius:'50%',background:stu.grad||'linear-gradient(135deg,#00c97a,#00a862)',display:'grid',placeItems:'center',fontSize:13,fontWeight:800,color:'#fff',flexShrink:0 }}>
                  {stu.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <span style={{ fontSize:14,fontWeight:800,color:'var(--text)' }}>{stu.name}</span>
                    {bal.fullyPaid && <Award size={13} color="#fbbf24" />}
                  </div>
                  <div style={{ fontSize:11,color:bal.balance>0?'#ef4444':'#22c55e',marginTop:2,fontWeight:700 }}>
                    {bal.total > 0 ? (bal.fullyPaid ? '✓ Fully Paid' : `Balance: ${fmt(bal.balance)}`) : 'No fee structure'}
                  </div>
                  {bal.total > 0 && (
                    <div style={{ marginTop:4,height:3,background:'var(--border)',borderRadius:99,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${Math.min(100,(bal.paid/bal.total)*100)}%`,background:bal.fullyPaid?'#22c55e':'var(--accent)',borderRadius:99 }} />
                    </div>
                  )}
                </div>
                <ChevronRight size={16} color="var(--muted)" />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── OVERVIEW — all teacher's classes ─────────────────────────────
  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={S.title}>Payments</div>
          <SyncBadge />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={term} onChange={e => setTerm(e.target.value)} style={S.miniSelect}>
            {TERMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={S.miniSelect}>
            {[CURRENT_YEAR-1,CURRENT_YEAR,CURRENT_YEAR+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100 }}>
        {myClasses.map(cls => {
          const students   = cls.students || []
          const clsPmts    = termPayments.filter(p => p.classId === cls.id)
          const collected  = clsPmts.reduce((s,p) => s+(Number(p.amount)||0), 0)
          const fullyPaid  = students.filter(s => computeStudentBalance(s.npub, s.lunchType, termPayments, activeFees, cls.id).fullyPaid).length
          return (
            <button key={cls.id} style={S.card} onClick={() => { setSelectedClass(cls); setSearch(''); setView('class') }}>
              <div style={{ width:44,height:44,borderRadius:12,background:cls.color?.bg||'#f0fdf4',border:`1px solid ${cls.color?.border||'#bbf7d0'}`,display:'grid',placeItems:'center',fontSize:11,fontWeight:800,color:cls.color?.color||'#00c97a',flexShrink:0 }}>
                {cls.name.slice(0,3).toUpperCase()}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize:14,fontWeight:800,color:'var(--text)' }}>{cls.name}</div>
                <div style={{ fontSize:11,color:'var(--muted)',marginTop:2 }}>
                  {fmt(collected)} collected · {fullyPaid}/{students.length} fully paid
                </div>
              </div>
              <ChevronRight size={16} color="var(--muted)" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

const S = {
  page:       { minHeight:'100vh',background:'var(--bg)',fontFamily:'var(--font-display)',paddingBottom:100 },
  header:     { background:'var(--surface)',borderBottom:'1px solid var(--border)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' },
  title:      { fontSize:18,fontWeight:800,color:'var(--text)' },
  backBtn:    { display:'flex',alignItems:'center',gap:5,background:'none',border:'none',color:'var(--muted)',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-display)',padding:0 },
  card:       { background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'13px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',width:'100%',fontFamily:'var(--font-display)' },
  searchInput:{ width:'100%',padding:'10px 14px',background:'var(--surface)',border:'1.5px solid var(--border)',borderRadius:12,fontSize:13,color:'var(--text)',fontFamily:'var(--font-display)',outline:'none',boxSizing:'border-box' },
  miniSelect: { padding:'6px 10px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontFamily:'var(--font-display)',fontSize:12,fontWeight:700,outline:'none',cursor:'pointer' },
  center:     { display:'flex',alignItems:'center',justifyContent:'center',padding:60 },
  empty:      { padding:40,textAlign:'center',fontSize:13,color:'var(--muted)' },
}

