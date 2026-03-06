import { School } from 'lucide-react'

export default function Home({ user, schoolName, stats, fmt }) {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center' }}>
        <School size={32} color="var(--accent)" strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
        {user?.name ? `Welcome, ${user.name}` : 'Welcome to GradeBase'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
        {schoolName || 'Your school dashboard'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', maxWidth: 400, marginTop: 8 }}>
        {[
          { label: 'Total Income',   value: fmt(stats.income),            color: 'var(--income)'  },
          { label: 'Total Expenses', value: fmt(stats.expense),           color: 'var(--expense)' },
          { label: 'Net Balance',    value: fmt(Math.abs(stats.net)),     color: stats.net >= 0 ? 'var(--income)' : 'var(--expense)' },
          { label: 'Transactions',   value: stats.incomeCount + stats.expenseCount, color: 'var(--muted)' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

