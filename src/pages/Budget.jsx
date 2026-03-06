import ProgressBar from '../components/ProgressBar'
import { BUDGETS, CATEGORY_COLORS } from '../hooks/useTransactions'
import { AlertTriangle, CheckCircle, PieChart } from 'lucide-react'
import styles from './Budget.module.css'

const TRACKED = ['Salaries', 'Tuition', 'Supplies', 'Utilities', 'Events', 'Maintenance', 'Fees', 'Other']

export default function Budget({ spentByCategory, fmt }) {
  const hasAnySpend = TRACKED.some(cat => (spentByCategory[cat] || 0) > 0)

  const alerts = TRACKED.filter(cat => {
    const pct = ((spentByCategory[cat] || 0) / BUDGETS[cat]) * 100
    return pct >= 70
  })

  const activeCategories = TRACKED.filter(cat => (spentByCategory[cat] || 0) > 0)

  return (
    <div className={styles.page}>
      {alerts.length > 0 && (
        <div className={styles.alertBox}>
          <AlertTriangle size={16} color="var(--accent3)" />
          <span>
            <strong>{alerts.length} categor{alerts.length === 1 ? 'y' : 'ies'}</strong> at or near budget limit: {alerts.join(', ')}
          </span>
        </div>
      )}

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Expense Budgets</span>
            <span className={styles.hint}>vs allocated limits</span>
          </div>
          <div className={styles.body}>
            {!hasAnySpend ? (
              <div className={styles.empty}>
                <PieChart size={32} strokeWidth={1.5} />
                <div>No expenses recorded yet</div>
                <div className={styles.emptySub}>Add expense transactions to track budget usage</div>
              </div>
            ) : (
              activeCategories.map(cat => (
                <ProgressBar
                  key={cat}
                  category={cat}
                  spent={spentByCategory[cat] || 0}
                  budget={BUDGETS[cat]}
                  color={CATEGORY_COLORS[cat]}
                  fmt={fmt}
                />
              ))
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Budget Summary</span>
          </div>
          <div className={styles.body}>
            {!hasAnySpend ? (
              <div className={styles.empty}>
                <CheckCircle size={32} strokeWidth={1.5} />
                <div>All budgets intact</div>
                <div className={styles.emptySub}>Summary will appear once you add expenses</div>
              </div>
            ) : (
              activeCategories.map(cat => {
                const spent = spentByCategory[cat] || 0
                const budget = BUDGETS[cat]
                const remaining = budget - spent
                const pct = Math.min((spent / budget) * 100, 100)
                const ok = remaining >= 0
                return (
                  <div key={cat} className={styles.summaryRow}>
                    <div className={styles.summaryLeft}>
                      {ok
                        ? <CheckCircle size={14} color="var(--income)" />
                        : <AlertTriangle size={14} color="var(--expense)" />
                      }
                      <span className={styles.summaryName}>{cat}</span>
                    </div>
                    <div className={styles.summaryRight}>
                      <span className={ok ? styles.ok : styles.over}>
                        {ok ? `${fmt(remaining)} left` : `${fmt(Math.abs(remaining))} over`}
                      </span>
                      <span className={styles.summaryPct}>{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
