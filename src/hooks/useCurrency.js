import { useState, useEffect } from 'react'

const FALLBACK_RATE = 129.50

export function useCurrency() {
  const [rate, setRate] = useState(() => {
    const saved = localStorage.getItem('sl_usd_kes_rate')
    return saved ? parseFloat(saved) : FALLBACK_RATE
  })
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(() => localStorage.getItem('sl_rate_updated') || null)

  useEffect(() => {
    const last = localStorage.getItem('sl_rate_updated')
    const now = Date.now()
    if (last && now - parseInt(last) < 1000 * 60 * 60) return
    setLoading(true)
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data?.rates?.KES) {
          const r = data.rates.KES
          setRate(r)
          setLastUpdated(now.toString())
          localStorage.setItem('sl_usd_kes_rate', r.toString())
          localStorage.setItem('sl_rate_updated', now.toString())
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n) => {
    return 'KSh ' + Number(n).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  return { rate, fmt, loading, lastUpdated }
}
