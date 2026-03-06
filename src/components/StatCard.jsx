import styles from './StatCard.module.css'

export default function StatCard({ label, value, sub, accent, valueColor }) {
  return (
    <div className={styles.card} style={{ '--card-accent': accent }}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value} style={{ color: valueColor }}>{value}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  )
}
