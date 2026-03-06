import StatCard from '../components/StatCard'
import { TrendingUp, TrendingDown, Scale, Hash } from 'lucide-react'
import styles from './Dashboard.module.css'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

const CustomTooltip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px'
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, fontSize: 12, fontFamily: 'var(--font-mono)' }}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard({ stats, chartData, transactions, fmt }) {
  const { income, expense, net, incomeCount, expenseCount, dateRange } = stats
  const recent = transactions.slice(0, 5)

  return (
    <div className={styles.page}>
      <div className={styles.statsGrid}>
        <StatCard
          label="Total Income" value={fmt(income)}
          sub={`${incomeCount} entries`}
          accent="var(--income)" valueColor="var(--income)"
        />
        <StatCard
          label="Total Expenses" value={fmt(expense)}
          sub={`${expenseCount} entries`}
          accent="var(--expense)" valueColor="var(--expense)"
        />
        <StatCard
          label="Net Balance" value={fmt(Math.abs(net))}
          sub={net > 0 ? 'Surplus' : net < 0 ? 'Deficit' : 'Balanced'}
          accent={net >= 0 ? 'var(--income)' : 'var(--expense)'}
          valueColor={net >= 0 ? 'var(--income)' : 'var(--expense)'}
        />
        <StatCard
          label="Transactions" value={incomeCount + expenseCount}
          sub={dateRange || 'No entries yet'}
          accent="var(--muted)"
        />
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.chartPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>6-Month Overview</span>
          </div>
          <div style={{ padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={<CustomTooltip fmt={fmt} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="income" name="Income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Expense" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.recentPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Recent Activity</span>
          </div>
          {recent.length === 0 ? (
            <div className={styles.empty}>No transactions yet</div>
          ) : (
            recent.map(t => (
              <div key={t.id} className={styles.recentItem}>
                <div>
                  <div className={styles.recentDesc}>{t.desc}</div>
                  <div className={styles.recentMeta}>{t.category} · {t.date}</div>
                </div>
                <div className={t.type === 'income' ? styles.incomeAmt : styles.expenseAmt}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
