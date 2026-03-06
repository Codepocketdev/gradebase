import { useEffect, useState } from 'react'
import styles from './Splash.module.css'

export default function Splash({ onDone }) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 300)
    const t2 = setTimeout(() => setPhase(2), 900)
    const t3 = setTimeout(() => setPhase(3), 1600)
    const t4 = setTimeout(() => onDone(), 5000)
    return () => [t1,t2,t3,t4].forEach(clearTimeout)
  }, [])

  return (
    <div className={styles.splash}>
      <div className={styles.grid} />

      <div className={`${styles.logoWrap} ${phase >= 1 ? styles.visible : ''}`}>
        <div className={`${styles.iconRing} ${phase >= 2 ? styles.ringVisible : ''}`}>
          <div className={styles.iconInner}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 6L6 16V32L24 42L42 32V16L24 6Z" stroke="#4fffb0" strokeWidth="2" fill="none"/>
              <path d="M24 6L24 42M6 16L42 32M42 16L6 32" stroke="#4fffb0" strokeWidth="1" opacity="0.3"/>
              <circle cx="24" cy="24" r="6" fill="#4fffb0" opacity="0.9"/>
            </svg>
          </div>
        </div>

        <div className={`${styles.wordmark} ${phase >= 2 ? styles.wordmarkVisible : ''}`}>
          <span className={styles.grade}>Grade</span>
          <span className={styles.base}>Base</span>
        </div>

        <div className={`${styles.tagline} ${phase >= 3 ? styles.taglineVisible : ''}`}>
          School Management, Reimagined
        </div>
      </div>

      <div className={`${styles.bottom} ${phase >= 3 ? styles.bottomVisible : ''}`}>
        <div className={styles.poweredBy}>
          Secured by <span>Nostr Protocol</span>
        </div>
        {/* Sweeping light bar */}
        <div className={styles.sweepTrack}>
          <div className={styles.sweepLight} />
        </div>
      </div>
    </div>
  )
}
