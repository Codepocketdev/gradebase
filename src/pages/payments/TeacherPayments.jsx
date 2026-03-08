/**
 * GradeBase — Teacher Payments (View Only)
 * Teacher sees their class students' payment status per category.
 */
import { useState, useEffect } from 'react'
import { ArrowLeft, ChevronRight, Search, Loader, Award, Check } from 'lucide-react'
import { getClasses, getPayments, getAllFeeStructures } from '../../db'

const CURRENT_YEAR = new Date().getFullYear()
const TERMS = [
  { id: 'term1', label: 'Term 1' },
  { id: 'term2', label: 'Term 2' },
  { id: 'term3', label: 'Term 3' },
]
const fmt = (n) => `KSh ${Number(n||0).toLocaleString()}`

function computeBalance(studentNpub, payments, feeStructure, classId) {
  if (!feeStructure) return { categories: [], total: 0, paid: 0, balance: 0, fullyPaid: false }
  const tier = feeStructure.tiers?.find(t => t.classIds?.includes(classId))
  if (!tier) return { categories: [], total: 0, paid: 0, balance: 0, fullyPaid: false }
  const mine = payments.filter(p => p.studentNpub === studentNpub)
  let total = 0, paid = 0
  const categories = tier.categories.map(cat => {
    const catPaid = mine.filter(p => p.categoryId === cat.id).reduce((s,p) => s+(Number(p.amount)||0), 0)
    total += Number(cat.amount)||0; paid += catPaid
    return { ...cat, paid: catPaid, balance: Math.max(0,(Number(cat.amount)||0)-catPaid), done: catPaid >= (Number(cat.amount)||0) }
  })
  return { categories, total, paid, balance: Math.max(0,total-paid), fullyPaid: paid >= total && total > 0 }
}

export default function TeacherPayments({ user, dataVersion }) {
  const [view, setView]           = useState('class')
  const [myClass, setMyClass]     = useState(null)
  const [payments, setPayments]   = useState([])
  const [feeStructures, setFeeStructures] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [term, setTerm]           = useState('term1')
  const [year, setYear]           = useState(CURRENT_YEAR)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [classes, pmts, fees] = await Promise.all([
        getClasses(), getPayments(), getAllFeeStructures()
      ])
      const mine = (classes||[]).find(c => c.teacherNpub === user.npub)
      setMyClass(mine || null)
      setPayments(pmts||[])
      setFeeStructures(fees||[])
      setLoading(false)
    }
    load()
  }, [dataVersion, user.npub])

  const activeFees    = feeStructures.find(f => f.year === year && f.term === term) || null
  const termPayments  = payments.filter(p => p.term === term && p.year === year)
  const students      = (myClass?.students || []).filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  if (loading) return (
    <div style={S.page}>
      <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!myClass) return (
    <div style={S.page}>
      <div style={S.header}><div style={S.title}>Payments</div></div>
      <div style={S.empty}>No class assigned to you yet.</div>
    </div>
  )

  // ── STUDENT DETAIL ────────────────────────────────────────────────
  if (view === 'student' && selectedStudent) {
    const bal = computeBalance(selectedStudent.npub, termPayments, activeFees, myClass.id)
    const history = termPayments.filter(p => p.studentNpub === selectedStudent.npub).sort((a,b) => b.createdAt-a.createdAt)

    return (
      <div style={S.page}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setView('class')} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span style={S.title}>{selectedStudent.name}</span>
          </div>
          <div style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(79,255,176,0.08)', border: '1px solid rgba(79,255,176,0.2)', borderRadius: 20, color: 'var(--accent)', fontWeight: 700 }}>View Only</div>
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
        </div>
      </div>
    )
  }

  // ── CLASS LIST ────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div style={S.title}>{myClass.name} — Payments</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={term} onChange={e => setTerm(e.target.value)} style={S.miniSelect}>
            {TERMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={S.miniSelect}>
            {[CURRENT_YEAR-1,CURRENT_YEAR,CURRENT_YEAR+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '12px 20px 0', position: 'relative' }}>
        <Search size={14} style={{ position:'absolute',left:34,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none',marginTop:6 }} />
        <input style={{ ...S.searchInput, paddingLeft: 36 }} placeholder="Search students..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100 }}>
        {students.map(stu => {
          const bal = computeBalance(stu.npub, termPayments, activeFees, myClass.id)
          return (
            <button key={stu.npub} style={S.card} onClick={() => { setSelectedStudent(stu); setView('student') }}>
              <div style={{ width: 42,height:42,borderRadius:'50%',background:stu.grad||'linear-gradient(135deg,#00c97a,#00a862)',display:'grid',placeItems:'center',fontSize:13,fontWeight:800,color:'#fff',flexShrink:0 }}>
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

