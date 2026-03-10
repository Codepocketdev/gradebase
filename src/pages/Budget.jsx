import { useState, useEffect } from 'react'
import {
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown,
  Pencil, Check, X, Wallet, RefreshCw, Scale
} from 'lucide-react'
import { getClasses, getPayments, getAllFeeStructures } from '../db'
import { computeStudentBalance } from '../computeBalance'
import { CATEGORY_COLORS, CATEGORY_ICON_NAMES } from '../hooks/useTransactions'
import CategoryIcon from '../components/CategoryIcon'
import styles from './Budget.module.css'

const CURRENT_YEAR = new Date().getFullYear()
const TERMS = [
  { id: 'term1', label: 'Term 1' },
  { id: 'term2', label: 'Term 2' },
  { id: 'term3', label: 'Term 3' },
]


// ── Inline-editable budget row ────────────────────────────────────────
function BudgetRow({ category, spent, budget, fmt, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')

  const pct      = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const remaining = budget - spent
  const status   = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'ok'
  const color    = CATEGORY_COLORS[category] || '#94a3b8'
  const iconName = CATEGORY_ICON_NAMES[category] || 'MoreHorizontal'
  const barColor = status === 'danger' ? 'var(--expense,#ff6b6b)'
                 : status === 'warning' ? '#fbbf24'
                 : 'var(--income,#4fffb0)'

  const handleSave = () => {
    const n = parseFloat(val)
    if (!isNaN(n) && n >= 0) onEdit(category, n)
    setEditing(false); setVal('')
  }

  return (
    <div className={styles.budgetRow}>
      <div className={styles.rowTop}>
        <div className={styles.rowLeft}>
          <div className={styles.catIcon} style={{ background: color + '18', color }}>
            <CategoryIcon name={iconName} size={14} />
          </div>
          <div>
            <div className={styles.catName}>{category}</div>
            <div className={styles.catSpent}>{fmt(spent)} spent</div>
          </div>
        </div>
        <div className={styles.rowRight}>
          {editing ? (
            <div className={styles.editWrap}>
              <input
                autoFocus type="number" min="0" value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') handleSave(); if (e.key==='Escape') setEditing(false) }}
                placeholder={String(budget)}
                className={styles.editInput}
              />
              <button onClick={handleSave} className={styles.editBtn} style={{ color: 'var(--income,#4fffb0)' }}><Check size={13} /></button>
              <button onClick={() => setEditing(false)} className={styles.editBtn} style={{ color: 'var(--muted)' }}><X size={13} /></button>
            </div>
          ) : (
            <div className={styles.budgetAmt}>
              <span className={styles.budgetFmt}>{fmt(budget)}</span>
              <button onClick={() => { setVal(String(budget)); setEditing(true) }} className={styles.pencilBtn}>
                <Pencil size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className={styles.rowBottom}>
        <span className={styles.pctLabel} style={{ color: barColor }}>{pct.toFixed(0)}% used</span>
        <span className={remaining >= 0 ? styles.remaining : styles.over}>
          {remaining >= 0 ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over budget`}
        </span>
      </div>
    </div>
  )
}

// ── Fee collection row per term ───────────────────────────────────────
function FeeTermRow({ term, label, collected, expected, fmt }) {
  const pct       = expected > 0 ? Math.min((collected / expected) * 100, 100) : 0
  const remaining = expected - collected
  const color     = pct >= 90 ? 'var(--income,#4fffb0)' : pct >= 50 ? '#fbbf24' : 'var(--expense,#ff6b6b)'

  return (
    <div className={styles.feeTermRow}>
      <div className={styles.feeTermTop}>
        <span className={styles.feeTermLabel}>{label}</span>
        <span className={styles.feeTermPct} style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className={styles.feeAmounts}>
        <span className={styles.feeCollected}>{fmt(collected)}</span>
        <span className={styles.feeDivider}>/</span>
        <span className={styles.feeExpected}>{fmt(expected)}</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className={styles.rowBottom}>
        <span className={styles.pctLabel} style={{ color }}>{fmt(collected)} collected</span>
        <span className={remaining >= 0 ? styles.over : styles.remaining}>
          {remaining > 0 ? `${fmt(remaining)} outstanding` : 'Fully collected'}
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────
export default function Budget({ spentByCategory, budgets, updateBudget, fmt, categories }) {
  const TRACKED = (categories && categories.length > 0) ? categories : ['Salaries','Tuition','Supplies','Utilities','Events','Maintenance','Fees','Other']
  const [feesData, setFeesData]     = useState(null)
  const [feesLoading, setFeesLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [classes, payments, feeStructures] = await Promise.all([
          getClasses(), getPayments(), getAllFeeStructures()
        ])
        const result = {}
        for (const { id: termId } of TERMS) {
          const fs           = feeStructures.find(f => f.year === CURRENT_YEAR && f.term === termId) || null
          const termPayments = payments.filter(p => p.term === termId && p.year === CURRENT_YEAR)
          const collected    = termPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
          let expected = 0
          if (fs) {
            for (const cls of classes) {
              for (const stu of (cls.students || [])) {
                const bal = computeStudentBalance(stu.npub, stu.lunchType, termPayments, fs, cls.id)
                expected += bal.total
              }
            }
          }
          result[termId] = { collected, expected }
        }
        setFeesData(result)
      } catch (e) {
        console.warn('[Budget] fees load error:', e)
      } finally {
        setFeesLoading(false)
      }
    }
    load()
  }, [])

  // ── Expense budget totals ──
  const totalBudget  = TRACKED.reduce((s, c) => s + (budgets[c] || 0), 0)
  const totalSpent   = TRACKED.reduce((s, c) => s + (spentByCategory[c] || 0), 0)
  const totalLeft    = totalBudget - totalSpent
  const overallPct   = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0

  // ── Fee totals across all terms ──
  const totalCollected = feesData ? Object.values(feesData).reduce((s, t) => s + t.collected, 0) : 0
  const totalExpected  = feesData ? Object.values(feesData).reduce((s, t) => s + t.expected, 0)  : 0
  const totalFeesPct   = totalExpected > 0 ? Math.min((totalCollected / totalExpected) * 100, 100) : 0

  const alerts = TRACKED.filter(c => budgets[c] > 0 && (spentByCategory[c] || 0) / budgets[c] * 100 >= 70)

  return (
    <div className={styles.page}>

      {/* ── Top overview cards ── */}
      <div className={styles.overviewGrid}>
        <div className={styles.overviewCard}>
          <div className={styles.overviewLabel}>Fees Collected</div>
          <div className={styles.overviewValue} style={{ color: 'var(--income,#4fffb0)' }}>{fmt(totalCollected)}</div>
          <div className={styles.overviewSub}>
            {totalExpected > 0 ? `${totalFeesPct.toFixed(0)}% of KSh ${Number(totalExpected).toLocaleString()} expected` : 'No fee structure set'}
          </div>
        </div>
        <div className={styles.overviewCard}>
          <div className={styles.overviewLabel}>Fees Outstanding</div>
          <div className={styles.overviewValue} style={{ color: totalExpected - totalCollected > 0 ? 'var(--expense,#ff6b6b)' : 'var(--income,#4fffb0)' }}>
            {fmt(Math.max(0, totalExpected - totalCollected))}
          </div>
          <div className={styles.overviewSub}>{totalExpected - totalCollected > 0 ? 'Still to collect' : 'All fees collected'}</div>
        </div>
        <div className={styles.overviewCard}>
          <div className={styles.overviewLabel}>Expense Budget Left</div>
          <div className={styles.overviewValue} style={{ color: totalLeft >= 0 ? 'var(--income,#4fffb0)' : 'var(--expense,#ff6b6b)' }}>
            {fmt(Math.abs(totalLeft))}
          </div>
          <div className={styles.overviewSub}>{totalLeft >= 0 ? `${overallPct.toFixed(0)}% used of ${fmt(totalBudget)}` : 'Over total budget'}</div>
        </div>
        <div className={styles.overviewCard}>
          <div className={styles.overviewLabel}>Budget Alerts</div>
          <div className={styles.overviewValue} style={{ color: alerts.length > 0 ? '#fbbf24' : 'var(--income,#4fffb0)' }}>
            {alerts.length > 0 ? `${alerts.length} Alert${alerts.length > 1 ? 's' : ''}` : 'All Clear'}
          </div>
          <div className={styles.overviewSub}>{alerts.length > 0 ? 'Categories near limit' : 'All within budget'}</div>
        </div>
      </div>

      {/* ── Alert banner ── */}
      {alerts.length > 0 && (
        <div className={styles.alertBox}>
          <AlertTriangle size={14} color="#fbbf24" />
          <span><strong>{alerts.join(', ')}</strong> {alerts.length === 1 ? 'is' : 'are'} at or near budget limit</span>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className={styles.grid}>

        {/* Left — Fee Collection */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Fee Collection — {CURRENT_YEAR}</span>
            {feesLoading && <RefreshCw size={12} className={styles.spin} color="var(--muted)" />}
          </div>
          <div className={styles.panelBody}>
            {feesLoading ? (
              <div className={styles.loadingRow}>
                <RefreshCw size={14} className={styles.spin} /> Loading…
              </div>
            ) : (
              <>
                {/* Overall fee bar */}
                <div className={styles.feeOverallWrap}>
                  <div className={styles.feeOverallLabel}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>All Terms Combined</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{totalFeesPct.toFixed(0)}%</span>
                  </div>
                  <div className={styles.barTrack} style={{ height: 8 }}>
                    <div className={styles.barFill} style={{
                      width: `${totalFeesPct}%`,
                      background: totalFeesPct >= 90 ? 'var(--income,#4fffb0)' : totalFeesPct >= 50 ? '#fbbf24' : 'var(--expense,#ff6b6b)'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--income,#4fffb0)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(totalCollected)} collected</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{fmt(totalExpected)} expected</span>
                  </div>
                </div>

                <div className={styles.divider} />

                {TERMS.map(({ id, label }) => (
                  <FeeTermRow
                    key={id}
                    term={id}
                    label={label}
                    collected={feesData?.[id]?.collected || 0}
                    expected={feesData?.[id]?.expected || 0}
                    fmt={fmt}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right — Expense Budgets */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Expense Budgets</span>
            <span className={styles.hint} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Pencil size={11} /> to edit limit
            </span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.overallBarWrap}>
              <div className={styles.overallBarLabel}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Total Expense Budget</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>{overallPct.toFixed(0)}%</span>
              </div>
              <div className={styles.barTrack} style={{ height: 8 }}>
                <div className={styles.barFill} style={{
                  width: `${overallPct}%`,
                  background: overallPct >= 90 ? 'var(--expense,#ff6b6b)' : overallPct >= 70 ? '#fbbf24' : 'var(--income,#4fffb0)'
                }} />
              </div>
            </div>
            <div className={styles.divider} />
            {TRACKED.map(cat => (
              <BudgetRow
                key={cat}
                category={cat}
                spent={spentByCategory[cat] || 0}
                budget={budgets[cat] || 0}
                fmt={fmt}
                onEdit={updateBudget}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

