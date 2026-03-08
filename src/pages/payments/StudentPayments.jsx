/**
 * GradeBase — Student Payments (View Only)
 * Step 1: render instantly from IndexedDB
 * Step 2: fetch fresh fee structures + payments from Nostr in BG
 * Step 3: update UI + save to DB when Nostr data arrives
 */
import { useState, useEffect, useRef } from 'react'
import { Loader, Award, Check, AlertCircle } from 'lucide-react'
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

export default function StudentPayments({ user, dataVersion }) {
  const [loading, setLoading]         = useState(true)
  const [syncing, setSyncing]         = useState(false)
  const [myClass, setMyClass]         = useState(null)
  const [payments, setPayments]       = useState([])
  const [feeStructures, setFeeStructures] = useState([])
  const [term, setTerm]               = useState('term1')
  const [year, setYear]               = useState(CURRENT_YEAR)
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
      const cls = (classes||[]).find(c => c.students?.some(s => s.npub === user.npub))
      if (mountedRef.current) {
        setMyClass(cls || null)
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
        console.warn('[StudentPayments] BG sync error:', e)
      }
      if (mountedRef.current) setSyncing(false)
    }
    load()
  }, [dataVersion, user.npub])

  const activeFees   = feeStructures.find(f => f.year === year && f.term === term) || null
  const termPayments = payments.filter(p => p.studentNpub === user.npub && p.term === term && p.year === year)
  const tier         = activeFees?.tiers?.find(t => t.classIds?.includes(myClass?.id))

  // Use shared lunch-aware balance calculator
  // myClass.students contains student lunchType set from the Classes page
  const myStudentData = myClass?.students?.find(s => s.npub === user.npub)
  const bal       = computeStudentBalance(user.npub, myStudentData?.lunchType, termPayments, activeFees, myClass?.id)
  const { categories, total, paid, fullyPaid } = bal
  const balance   = bal.balance
  const pct       = total > 0 ? Math.min(100, Math.round((paid/total)*100)) : 0

  if (loading) return (
    <div style={S.page}>
      <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div>
          <div style={S.title}>My Fees</div>
          <div style={S.sub}>{myClass?.name || 'No class assigned'}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {syncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
              <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Syncing
            </div>
          )}
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

      <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 100 }}>

        {!activeFees && !syncing && (
          <div style={{ padding: '12px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
            <AlertCircle size={14} /> Fee structure not yet set for this term.
          </div>
        )}

        {activeFees && !tier && (
          <div style={{ padding: '12px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>
            <AlertCircle size={14} /> Your class hasn't been assigned to a fee tier yet.
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Total Fees', value: total,   color: 'var(--text)' },
            { label: 'Paid',       value: paid,    color: '#22c55e' },
            { label: 'Balance',    value: balance, color: balance > 0 ? '#ef4444' : '#22c55e' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color }}>{fmt(value)}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Payment Progress</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: pct >= 100 ? '#22c55e' : pct >= 60 ? '#fbbf24' : '#ef4444' }}>{pct}%</div>
          </div>
          <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? '#22c55e' : pct >= 60 ? '#fbbf24' : '#ef4444', borderRadius: 99, transition: 'width 0.5s ease' }} />
          </div>
        </div>

        {fullyPaid && (
          <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 800, color: '#fbbf24' }}>
            <Award size={20} /> All fees cleared for {TERMS.find(t=>t.id===term)?.label} {year}!
          </div>
        )}

        {/* Per category breakdown */}
        {categories.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Fee Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {categories.map(cat => (
                <div key={cat.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cat.done
                        ? <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Check size={10} color="#fff" /></span>
                        : <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border)', flexShrink: 0 }} />
                      }
                      {cat.name}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: cat.done ? '#22c55e' : 'var(--muted)', textAlign: 'right' }}>
                      <div>{fmt(cat.paid)} paid</div>
                      {!cat.done && <div style={{ color: '#ef4444', fontSize: 10 }}>Balance: {fmt(cat.balance)}</div>}
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cat.amount > 0 ? Math.min(100,(cat.paid/cat.amount)*100) : 0}%`, background: cat.done ? '#22c55e' : 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment history */}
        {termPayments.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Payment History</div>
            {[...termPayments].sort((a,b)=>b.createdAt-a.createdAt).map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.categoryName}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                    {new Date(p.createdAt).toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric'})}
                    {p.note ? ` · ${p.note}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{fmt(p.amount)}</div>
              </div>
            ))}
          </div>
        )}

        {termPayments.length === 0 && activeFees && tier && !syncing && (
          <div style={{ textAlign: 'center', padding: '30px 0', fontSize: 13, color: 'var(--muted)' }}>
            No payments recorded yet for this term.
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  page:       { minHeight:'100vh',background:'var(--bg)',fontFamily:'var(--font-display)',paddingBottom:100 },
  header:     { background:'var(--surface)',borderBottom:'1px solid var(--border)',padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between' },
  title:      { fontSize:18,fontWeight:800,color:'var(--text)' },
  sub:        { fontSize:11,color:'var(--muted)',marginTop:2 },
  miniSelect: { padding:'6px 10px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)',fontFamily:'var(--font-display)',fontSize:12,fontWeight:700,outline:'none',cursor:'pointer' },
  center:     { display:'flex',alignItems:'center',justifyContent:'center',padding:60 },
}

