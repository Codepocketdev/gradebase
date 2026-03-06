import styles from './ProgressBar.module.css'

export default function ProgressBar({ spent, budget, category, color, fmt }) {
  const pct = Math.min((spent / budget) * 100, 100)
  const status = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'ok'

  return (
    <div className={styles.group}>
      <div className={styles.header}>
        <span className={styles.cat}>{category}</span>
        <span className={styles.amt}>{fmt(spent)} / {fmt(budget)}</span>
      </div>
      <div className={styles.bar}>
        <span
          className={`${styles.fill} ${styles[status]}`}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className={styles.pct}>{pct.toFixed(0)}% used</div>
    </div>
  )
}
