/**
 * GradeBase — Fee Structure
 * Admin only. Sets fee categories + amounts per term per tier.
 * Two tiers: Pre-School and Upper Grades.
 * Admin assigns classes to tiers.
 * Lunch rates set globally.
 */
import { useState, useEffect } from 'react'
import {
  ArrowLeft, Plus, Trash2, Save, ChevronDown,
  Loader, Check, School, Pencil, X
} from 'lucide-react'
import { getClasses, getFeeStructure, saveFeeStructure } from '../db'
import { publishFeeStructure } from '../nostrSync'

const CURRENT_YEAR = new Date().getFullYear()
const TERMS = [
  { id: 'term1', label: 'Term 1' },
  { id: 'term2', label: 'Term 2' },
  { id: 'term3', label: 'Term 3' },
]

const DEFAULT_CATEGORIES = [
  { id: 'tuition',    name: 'Tuition',         amount: 0 },
  { id: 'schoolfees', name: 'School Fees',      amount: 0 },
  { id: 'lunch',      name: 'Lunch',            amount: 0, isLunch: true },
  { id: 'cocurr',     name: 'Co-curricular',    amount: 0 },
  { id: 'computer',   name: 'Computer / ICT',   amount: 0 },
  { id: 'uniform',    name: 'Uniform',          amount: 0 },
  { id: 'transport',  name: 'Transport',        amount: 0 },
  { id: 'exam',       name: 'Exam Fees',        amount: 0 },
]

const LUNCH_RATES_DEFAULT = { monthly: 0, weekly: 0, daily: 0 }

function newTier(id, name) {
  return {
    id,
    name,
    classIds: [],
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c, amount: 0 })),
  }
}

export default function FeeStructure({ user, onBack }) {
  const [term, setTerm]           = useState('term1')
  const [year, setYear]           = useState(CURRENT_YEAR)
  const [classes, setClasses]     = useState([])
  const [tiers, setTiers]         = useState([
    newTier('preschool', 'Pre-School'),
    newTier('upper',     'Upper Grades'),
  ])
  const [lunchRates, setLunchRates] = useState(LUNCH_RATES_DEFAULT)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [activeTier, setActiveTier] = useState('preschool')
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)

  // Load classes + existing fee structure
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [cls, existing] = await Promise.all([
        getClasses(),
        getFeeStructure(year, term),
      ])
      setClasses(cls || [])
      if (existing) {
        setTiers(existing.tiers || [newTier('preschool','Pre-School'), newTier('upper','Upper Grades')])
        setLunchRates(existing.lunchRates || LUNCH_RATES_DEFAULT)
      } else {
        setTiers([newTier('preschool','Pre-School'), newTier('upper','Upper Grades')])
        setLunchRates(LUNCH_RATES_DEFAULT)
      }
      setLoading(false)
    }
    load()
  }, [term, year])

  const currentTier = tiers.find(t => t.id === activeTier)

  const updateTierName = (tierId, name) => {
    setTiers(prev => prev.map(t => t.id === tierId ? { ...t, name } : t))
  }

  const toggleClassInTier = (tierId, classId) => {
    setTiers(prev => prev.map(t => {
      if (t.id !== tierId) {
        // Remove from other tiers
        return { ...t, classIds: t.classIds.filter(id => id !== classId) }
      }
      const has = t.classIds.includes(classId)
      return { ...t, classIds: has ? t.classIds.filter(id => id !== classId) : [...t.classIds, classId] }
    }))
  }

  const updateCategoryAmount = (tierId, catId, amount) => {
    setTiers(prev => prev.map(t => {
      if (t.id !== tierId) return t
      return { ...t, categories: t.categories.map(c => c.id === catId ? { ...c, amount: Number(amount) || 0 } : c) }
    }))
  }

  const updateCategoryName = (tierId, catId, name) => {
    setTiers(prev => prev.map(t => {
      if (t.id !== tierId) return t
      return { ...t, categories: t.categories.map(c => c.id === catId ? { ...c, name } : c) }
    }))
  }

  const removeCategory = (tierId, catId) => {
    setTiers(prev => prev.map(t => {
      if (t.id !== tierId) return t
      return { ...t, categories: t.categories.filter(c => c.id !== catId) }
    }))
  }

  const addCategory = () => {
    if (!newCatName.trim()) return
    const cat = { id: `cat_${Date.now()}`, name: newCatName.trim(), amount: 0 }
    setTiers(prev => prev.map(t => {
      if (t.id !== activeTier) return t
      return { ...t, categories: [...t.categories, cat] }
    }))
    setNewCatName('')
    setShowNewCat(false)
  }

  const totalForTier = (tier) => tier.categories.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  const handleSave = async () => {
    setSaving(true)
    const structure = {
      year, term, tiers, lunchRates, updatedAt: Date.now(),
    }
    await saveFeeStructure(structure)
    publishFeeStructure(user.nsec, structure).catch(console.warn)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const fmt = (n) => `KSh ${Number(n || 0).toLocaleString()}`

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onBack} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span style={S.title}>Fee Structure</span>
        </div>
        <button onClick={handleSave} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: saving ? 'var(--muted)' : saved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: 10, color: '#0d0f14', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>
          {saving ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <Check size={13} /> : <Save size={13} />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Term + Year picker */}
      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={S.label}>Academic Year</div>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={S.select}>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={S.label}>Term</div>
          <select value={term} onChange={e => setTerm(e.target.value)} style={S.select}>
            {TERMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {loading
        ? <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
        : (
          <div style={{ paddingBottom: 100 }}>

            {/* Tier tabs */}
            <div style={{ padding: '16px 20px 0', display: 'flex', gap: 8 }}>
              {tiers.map(t => (
                <button key={t.id} onClick={() => setActiveTier(t.id)}
                  style={{ flex: 1, padding: '10px 8px', background: activeTier === t.id ? 'var(--accent)' : 'var(--surface)', border: `1.5px solid ${activeTier === t.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, color: activeTier === t.id ? '#0d0f14' : 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                  {t.name}
                </button>
              ))}
            </div>

            {currentTier && (
              <div style={{ padding: '16px 20px 0' }}>

                {/* Assign classes to tier */}
                <div style={S.card}>
                  <div style={S.cardTitle}><School size={14} /> Classes in {currentTier.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {classes.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No classes created yet</div>}
                    {classes.map(cls => {
                      const inTier = currentTier.classIds.includes(cls.id)
                      return (
                        <button key={cls.id} onClick={() => toggleClassInTier(currentTier.id, cls.id)}
                          style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', background: inTier ? 'rgba(79,255,176,0.15)' : 'var(--bg)', border: `1.5px solid ${inTier ? 'var(--accent)' : 'var(--border)'}`, color: inTier ? 'var(--accent)' : 'var(--muted)' }}>
                          {inTier && '✓ '}{cls.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Fee categories */}
                <div style={{ ...S.card, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={S.cardTitle}>Fee Categories</div>
                    <button onClick={() => setShowNewCat(true)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'rgba(79,255,176,0.1)', border: '1px solid rgba(79,255,176,0.2)', borderRadius: 8, color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      <Plus size={12} /> Add
                    </button>
                  </div>

                  {showNewCat && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCategory()}
                        placeholder="Category name..." autoFocus
                        style={{ ...S.input, flex: 1, marginBottom: 0 }} />
                      <button onClick={addCategory} style={{ padding: '0 14px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0d0f14', fontWeight: 800, cursor: 'pointer' }}>Add</button>
                      <button onClick={() => { setShowNewCat(false); setNewCatName('') }} style={{ padding: '0 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {currentTier.categories.map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
                        <div style={{ flex: 1 }}>
                          <input value={cat.name} onChange={e => updateCategoryName(currentTier.id, cat.id, e.target.value)}
                            style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-display)', width: '100%' }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>KSh</span>
                          <input type="number" min="0" value={cat.amount || ''}
                            onChange={e => updateCategoryAmount(currentTier.id, cat.id, e.target.value)}
                            placeholder="0"
                            style={{ width: 90, padding: '6px 8px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)', outline: 'none', textAlign: 'right' }} />
                        </div>
                        <button onClick={() => removeCategory(currentTier.id, cat.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'grid', placeItems: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Tier total */}
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(79,255,176,0.06)', border: '1px solid rgba(79,255,176,0.15)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total — {currentTier.name}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{fmt(totalForTier(currentTier))}</div>
                  </div>
                </div>

                {/* Lunch rates (global) */}
                <div style={{ ...S.card, marginTop: 12 }}>
                  <div style={S.cardTitle}>Lunch Rates (per student)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                    {[
                      { key: 'monthly', label: 'Monthly' },
                      { key: 'weekly',  label: 'Weekly'  },
                      { key: 'daily',   label: 'Daily'   },
                    ].map(({ key, label }) => (
                      <div key={key} style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '6px 8px', minWidth: 0 }}>
                          <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>KSh</span>
                          <input type="number" min="0" value={lunchRates[key] || ''}
                            onChange={e => setLunchRates(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                            placeholder="0"
                            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-display)', textAlign: 'right', minWidth: 0, width: '100%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                    Students tagged "Home Lunch" are excluded from lunch billing.
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      }
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S = {
  page:     { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header:   { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:    { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  backBtn:  { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', padding: 0 },
  label:    { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  select:   { width: '100%', padding: '10px 12px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer' },
  card:     { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 14px' },
  cardTitle:{ fontSize: 12, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 },
  input:    { width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box', marginBottom: 8 },
  center:   { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
}

