/**
 * GradeBase — Admin Payments
 * Full control: record payments, view per class/student, delete entries.
 * Views: overview → class → student → record payment
 */
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Plus, Trash2, Check, Loader,
  ChevronRight, Search, Award, AlertCircle
} from 'lucide-react'
import {
  getClasses, getPayments, savePayment, deletePayment,
  getAllFeeStructures
} from '../../db'
import { publishPaymentEntry, publishPaymentDelete } from '../../nostrSync'

const CURRENT_YEAR = new Date().getFullYear()
const TERMS = [
  { id: 'term1', label: 'Term 1' },
  { id: 'term2', label: 'Term 2' },
  { id: 'term3', label: 'Term 3' },
]

import { computeStudentBalance } from '../../computeBalance'

const fmt = (n) => `KSh ${Number(n || 0).toLocaleString()}`

export default function AdminPayments({ user, dataVersion }) {
  const [view, setView]         = useState('overview')
  const [classes, setClasses]   = useState([])
  const [payments, setPayments] = useState([])
  const [feeStructures, setFeeStructures] = useState([])
  const [selectedClass, setSelectedClass]     = useState(null)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [search, setSearch]     = useState('')
  const [deleting, setDeleting] = useState(null)
  const [term, setTerm] = useState('term1')
  const [year, setYear] = useState(CURRENT_YEAR)
  const [form, setForm] = useState({ categoryId: '', amount: '', note: '' })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [cls, pmts, fees] = await Promise.all([getClasses(), getPayments(), getAllFeeStructures()])
      setClasses(cls || [])
      setPayments(pmts || [])
      setFeeStructures(fees || [])
      setLoading(false)
    }
    load()
  }, [dataVersion])

  const activeFees      = feeStructures.find(f => f.year === year && f.term === term) || null
  const termPayments    = payments.filter(p => p.term === term && p.year === year)
  const schoolCollected = termPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)

  // schoolTotal = sum of every student's individual expected total
  // Lunch is variable (home/daily/weekly/monthly) so we compute per student
  const schoolTotal = (() => {
    if (!activeFees) return 0
    let total = 0
    for (const cls of classes) {
      for (const stu of (cls.students || [])) {
        const bal = computeStudentBalance(stu.npub, stu.lunchType, termPayments, activeFees, cls.id)
        total += bal.total
      }
    }
    return total
  })()

  const reloadPayments = async () => { const pmts = await getPayments(); setPayments(pmts || []) }

  const handleRecordPayment = async () => {
    if (!form.categoryId || !form.amount || !selectedStudent) return
    setSaving(true)
    const cat = activeFees?.tiers?.flatMap(t => t.categories)?.find(c => c.id === form.categoryId)
    const payment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      studentNpub: selectedStudent.npub, studentName: selectedStudent.name,
      classId: selectedClass.id, className: selectedClass.name,
      categoryId: form.categoryId, categoryName: cat?.name || form.categoryId,
      amount: Number(form.amount), term, year,
      note: form.note.trim(), recordedBy: user.npub, createdAt: Date.now(),
    }
    await savePayment(payment)
    publishPaymentEntry(user.nsec, payment).catch(console.warn)
    await reloadPayments()
    setForm({ categoryId: '', amount: '', note: '' })
    setSaving(false); setSaved(true)
    setTimeout(() => { setSaved(false); setView('student') }, 1500)
  }

  const handleDelete = async (paymentId) => {
    setDeleting(paymentId)
    await deletePayment(paymentId)
    publishPaymentDelete(user.nsec, paymentId).catch(console.warn)
    await reloadPayments()
    setDeleting(null)
  }

  const goBack = () => {
    if (view === 'record')  { setView('student'); return }
    if (view === 'student') { setView('class');   return }
    if (view === 'class')   { setView('overview'); setSelectedClass(null); return }
    setView('overview')
  }

  // ── OVERVIEW ──────────────────────────────────────────────────────────
  if (view === 'overview') return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div style={S.title}>Payments</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={term} onChange={e => setTerm(e.target.value)} style={S.miniSelect}>
            {TERMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={S.miniSelect}>
            {[CURRENT_YEAR-1, CURRENT_YEAR, CURRENT_YEAR+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading
        ? <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
        : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 100 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                School Total — {TERMS.find(t=>t.id===term)?.label} {year}
              </div>
              <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Collected</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{fmt(schoolCollected)}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Expected</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{fmt(schoolTotal)}</div>
                </div>
              </div>
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${schoolTotal > 0 ? Math.min(100,(schoolCollected/schoolTotal)*100) : 0}%`, background: 'var(--accent)', borderRadius: 99, transition: 'width 0.5s ease' }} />
              </div>
              {!activeFees && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={13} /> No fee structure for {TERMS.find(t=>t.id===term)?.label} {year}. Go to More → Fee Structure.
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {classes.length} Classes
            </div>
            {classes.map(cls => {
              const students    = cls.students || []
              const clsPayments = termPayments.filter(p => p.classId === cls.id)
              const clsCollected = clsPayments.reduce((s,p) => s+(Number(p.amount)||0), 0)
              const fullyPaid   = students.filter(s => computeStudentBalance(s.npub, s.lunchType, termPayments, activeFees, cls.id).fullyPaid).length
              return (
                <button key={cls.id} style={S.card} onClick={() => { setSelectedClass(cls); setView('class') }}>
                  <div style={{ ...S.badge, background: cls.color?.bg||'#f0fdf4', color: cls.color?.color||'#00c97a', border: `1px solid ${cls.color?.border||'#bbf7d0'}` }}>
                    {cls.name.slice(0,3).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{cls.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {fmt(clsCollected)} collected · {fullyPaid}/{students.length} fully paid
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </button>
              )
            })}
          </div>
        )
      }
    </div>
  )

  // ── CLASS VIEW ────────────────────────────────────────────────────────
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
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{TERMS.find(t=>t.id===term)?.label} {year}</div>
        </div>
        <div style={{ padding: '12px 20px 0', position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 34, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none', marginTop: 6 }} />
          <input style={{ ...S.searchInput, paddingLeft: 36 }} placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100 }}>
          {students.map(stu => {
            const bal = computeStudentBalance(stu.npub, stu.lunchType, termPayments, activeFees, selectedClass.id)
            return (
              <button key={stu.npub} style={S.card} onClick={() => { setSelectedStudent(stu); setView('student') }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: stu.grad||'linear-gradient(135deg,#00c97a,#00a862)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {stu.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{stu.name}</span>
                    {bal.fullyPaid && <Award size={14} color="#fbbf24" />}
                  </div>
                  <div style={{ fontSize: 11, color: bal.balance > 0 ? '#ef4444' : '#22c55e', marginTop: 2, fontWeight: 700 }}>
                    {bal.total > 0 ? (bal.fullyPaid ? '✓ Fully Paid' : `Balance: ${fmt(bal.balance)}`) : 'No fee structure'}
                  </div>
                  {bal.total > 0 && (
                    <div style={{ marginTop: 5, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', width: '100%' }}>
                      <div style={{ height: '100%', width: `${Math.min(100,(bal.paid/bal.total)*100)}%`, background: bal.fullyPaid ? '#22c55e' : 'var(--accent)', borderRadius: 99 }} />
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

  // ── STUDENT VIEW ──────────────────────────────────────────────────────
  if (view === 'student' && selectedStudent && selectedClass) {
    const bal = computeStudentBalance(selectedStudent.npub, selectedStudent.lunchType, termPayments, activeFees, selectedClass.id)
    const studentPayments = termPayments.filter(p => p.studentNpub === selectedStudent.npub).sort((a,b) => b.createdAt-a.createdAt)
    return (
      <div style={S.page}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goBack} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span style={S.title}>{selectedStudent.name}</span>
          </div>
          <button onClick={() => { setForm({ categoryId: '', amount: '', note: '' }); setView('record') }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0d0f14', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>
            <Plus size={14} /> Record
          </button>
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
              <Award size={16} /> Fully Paid — All fees cleared!
            </div>
          )}

          {bal.categories.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Fee Categories</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bal.categories.map(cat => (
                  <div key={cat.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {cat.done && <Check size={12} color="#22c55e" />}{cat.name}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: cat.done ? '#22c55e' : 'var(--muted)' }}>
                        {fmt(cat.paid)} / {fmt(cat.amount)}
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${cat.amount > 0 ? Math.min(100,(cat.paid/cat.amount)*100) : 0}%`, background: cat.done ? '#22c55e' : 'var(--accent)', borderRadius: 99, transition: 'width 0.4s ease' }} />
                    </div>
                    {cat.balance > 0 && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 3, fontWeight: 600 }}>Balance: {fmt(cat.balance)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {studentPayments.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Payment History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {studentPayments.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.categoryName}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                        {new Date(p.createdAt).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' })}
                        {p.note ? ` · ${p.note}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{fmt(p.amount)}</div>
                    <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'grid', placeItems: 'center' }}>
                      {deleting === p.id ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── RECORD PAYMENT ────────────────────────────────────────────────────
  if (view === 'record' && selectedStudent && selectedClass) {
    const tier = activeFees?.tiers?.find(t => t.classIds?.includes(selectedClass.id))
    const categories = tier?.categories || activeFees?.tiers?.flatMap(t => t.categories) || []
    const bal = computeStudentBalance(selectedStudent.npub, selectedStudent.lunchType, termPayments, activeFees, selectedClass.id)
    const selectedCat  = categories.find(c => c.id === form.categoryId)
    const catPaidSoFar = selectedCat ? (bal.categories.find(c => c.id === selectedCat.id)?.paid || 0) : 0
    const catBalance   = selectedCat ? Math.max(0, (Number(selectedCat.amount)||0) - catPaidSoFar) : 0
    const remaining    = catBalance - (Number(form.amount) || 0)

    return (
      <div style={S.page}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={goBack} style={S.backBtn}><ArrowLeft size={15} /> Cancel</button>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span style={S.title}>Record Payment</span>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: selectedStudent.grad||'linear-gradient(135deg,#00c97a,#00a862)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, color: '#fff' }}>
              {selectedStudent.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{selectedStudent.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selectedClass.name} · {TERMS.find(t=>t.id===term)?.label} {year}</div>
            </div>
          </div>

          {!activeFees && (
            <div style={{ padding: '12px 14px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 12, fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>
              ⚠ No fee structure for this term. Go to More → Fee Structure first.
            </div>
          )}

          {!tier && activeFees && (
            <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>
              ⚠ Class not assigned to a tier — showing all categories. Go to More → Fee Structure to assign.
            </div>
          )}

          <div>
            <div style={S.label}>Select Category</div>
            {categories.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--muted)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
                No categories found. Set up Fee Structure first.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {categories.map(cat => {
                  const isSelected = form.categoryId === cat.id
                  const catPaid    = bal.categories.find(c => c.id === cat.id)?.paid || 0
                  const catDone    = Number(cat.amount) > 0 && catPaid >= Number(cat.amount)
                  return (
                    <button key={cat.id}
                      onClick={() => setForm(f => ({ ...f, categoryId: cat.id, amount: '' }))}
                      style={{
                        padding: '12px 8px',
                        background: isSelected ? 'rgba(79,255,176,0.12)' : catDone ? 'rgba(34,197,94,0.08)' : 'var(--surface)',
                        border: `2px solid ${isSelected ? 'var(--accent)' : catDone ? '#22c55e' : 'var(--border)'}`,
                        borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--font-display)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        position: 'relative',
                      }}>
                      {(isSelected || catDone) && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: catDone ? '#22c55e' : 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                          <Check size={10} color={catDone ? '#fff' : '#0d0f14'} />
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 800, color: isSelected ? 'var(--accent)' : catDone ? '#22c55e' : 'var(--text)', textAlign: 'center', lineHeight: 1.3 }}>
                        {cat.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{fmt(cat.amount)}</div>
                      {catPaid > 0 && (
                        <div style={{ fontSize: 9, color: catDone ? '#22c55e' : '#fbbf24', fontWeight: 700 }}>
                          {catDone ? 'Cleared' : `${fmt(catPaid)} paid`}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {selectedCat && (
            <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Balance before this payment</span>
                <span style={{ fontWeight: 800, color: catBalance > 0 ? '#ef4444' : '#22c55e' }}>{fmt(catBalance)}</span>
              </div>
              {form.amount && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Remaining after</span>
                  <span style={{ fontWeight: 800, color: remaining <= 0 ? '#22c55e' : '#ef4444' }}>
                    {remaining <= 0 ? '✓ Cleared' : fmt(remaining)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <div style={S.label}>Amount (KSh)</div>
            <input type="number" min="0" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder={catBalance > 0 ? String(catBalance) : '0'}
              style={{ ...S.input, fontSize: 20, fontWeight: 800, color: 'var(--accent)', textAlign: 'center' }} />
          </div>

          <div>
            <div style={S.label}>Note (optional)</div>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="e.g. M-Pesa ref, cash receipt..."
              style={S.input} />
          </div>
        </div>

        <div style={{ position: 'fixed', bottom: 72, left: 0, right: 0, padding: '12px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto' }}>
            <button onClick={goBack}
              style={{ padding: '14px 20px', background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Cancel
            </button>
            <button onClick={handleRecordPayment} disabled={saving || !form.categoryId || !form.amount}
              style={{ flex: 1, padding: 14, background: saving ? 'var(--muted)' : saved ? '#22c55e' : (!form.categoryId || !form.amount) ? 'var(--border)' : 'var(--accent)', border: 'none', borderRadius: 14, color: '#0d0f14', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {saving ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : saved ? <><Check size={16} /> Saved</> : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

const S = {
  page:        { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header:      { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:       { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  backBtn:     { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', padding: 0 },
  card:        { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', fontFamily: 'var(--font-display)', textAlign: 'left' },
  badge:       { width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 },
  searchInput: { width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  miniSelect:  { padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer' },
  label:       { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input:       { width: '100%', padding: '12px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 11, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  center:      { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
}

