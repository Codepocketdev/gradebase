import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Scale, Activity, ArrowRight, RefreshCw, Wallet } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getPayments } from '../db'
import styles from './Dashboard.module.css'

const CustomTooltip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-display)'
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{p.name}:</span>
          <span style={{ color: p.color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, accent, icon: Icon, onClick }) {
  return (
    <div className={styles.statCard} style={{ '--accent': accent, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className={styles.statTop}>
        <span className={styles.statLabel}>{label}</span>
        <div className={styles.statIcon} style={{ background: accent + '22', color: accent }}>
          <Icon size={14} />
        </div>
      </div>
      <div className={styles.statValue} style={{ color: accent }}>{value}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

export default function Dashboard({ stats, chartData, transactions, fmt, syncing, onNavigate }) {
  const { income, expense, net, incomeCount, expenseCount, dateRange } = stats
  const recent = transactions.slice(0, 6)

  const [feesCollected, setFeesCollected] = useState(0)
  const [feesCount, setFeesCount]         = useState(0)

  useEffect(() => {
    getPayments()
      .then(payments => {
        setFeesCollected(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0))
        setFeesCount(payments.length)
      })
      .catch(console.warn)
  }, [])

  // Total income = student fees + manual ledger income
  const totalIncome = feesCollected + income
  // Net = total income - ledger expenses
  const totalNet    = totalIncome - expense
  const netPositive = totalNet >= 0

  return (
    <div className={styles.page}>

      {syncing && (
        <div className={styles.syncBanner}>
          <RefreshCw size={12} className={styles.spin} />
          Syncing ledger from Nostr…
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Total Income"
          value={fmt(totalIncome)}
          sub={`Fees ${fmt(feesCollected)} + Ledger ${fmt(income)}`}
          accent="var(--income, #4fffb0)"
          icon={TrendingUp}
        />
        <StatCard
          label="Fees Collected"
          value={fmt(feesCollected)}
          sub={`${feesCount} payment${feesCount === 1 ? '' : 's'} recorded`}
          accent="var(--income, #4fffb0)"
          icon={Wallet}
          onClick={() => onNavigate?.('payments')}
        />
        <StatCard
          label="Total Expenses"
          value={fmt(expense)}
          sub={`${expenseCount} ledger entr${expenseCount === 1 ? 'y' : 'ies'}`}
          accent="var(--expense, #ff6b6b)"
          icon={TrendingDown}
          onClick={() => onNavigate?.('school-ledger')}
        />
        <StatCard
          label="Net Balance"
          value={fmt(Math.abs(totalNet))}
          sub={netPositive ? '↑ Surplus' : '↓ Deficit'}
          accent={netPositive ? 'var(--income, #4fffb0)' : 'var(--expense, #ff6b6b)'}
          icon={Scale}
        />
      </div>

      {/* ── Main grid ── */}
      <div className={styles.mainGrid}>

        {/* Chart */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>6-Month Ledger Overview</span>
          </div>
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={6} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-display)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  width={48}
                />
                <Tooltip content={<CustomTooltip fmt={fmt} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="income"  name="income"  fill="var(--income, #4fffb0)"  radius={[4,4,0,0]} />
                <Bar dataKey="expense" name="expense" fill="var(--expense, #ff6b6b)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.chartLegend}>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: 'var(--income, #4fffb0)' }} />
              <span>Income</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendDot} style={{ background: 'var(--expense, #ff6b6b)' }} />
              <span>Expense</span>
            </div>
          </div>
        </div>

        {/* Recent */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Recent Ledger Entries</span>
            <button className={styles.viewAll} onClick={() => onNavigate?.('school-ledger')}>
              View all <ArrowRight size={11} />
            </button>
          </div>

          {recent.length === 0 ? (
            <div className={styles.empty}>
              <Activity size={28} strokeWidth={1.5} />
              <div>No transactions yet</div>
              <div className={styles.emptySub}>Add entries in School Ledger</div>
            </div>
          ) : (
            <div className={styles.recentList}>
              {recent.map(t => (
                <div key={t.id} className={styles.recentItem}>
                  <div className={styles.recentDot} style={{
                    background: t.type === 'income' ? 'rgba(79,255,176,0.12)' : 'rgba(255,107,107,0.12)'
                  }}>
                    {t.type === 'income'
                      ? <TrendingUp  size={12} color="var(--income, #4fffb0)" />
                      : <TrendingDown size={12} color="var(--expense, #ff6b6b)" />
                    }
                  </div>
                  <div className={styles.recentInfo}>
                    <div className={styles.recentDesc}>{t.desc}</div>
                    <div className={styles.recentMeta}>{t.category} · {t.date}</div>
                  </div>
                  <div className={t.type === 'income' ? styles.incomeAmt : styles.expenseAmt}>
                    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

