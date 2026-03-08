/**
 * hooks/useNostrProfile.js
 * Drop this in src/hooks/useNostrProfile.js
 */
import { useState, useEffect, useRef } from 'react'
import { getCachedProfile, setCachedProfile } from '../utils/profileCache'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

export function useNostrProfile(pk) {
  const cached = pk ? getCachedProfile(pk) : null
  const [profile, setProfile] = useState(cached || null)
  const [loading, setLoading] = useState(!cached)
  const latestAt = useRef(cached?._createdAt || 0)

  useEffect(() => {
    if (!pk) return
    // Always re-read cache on mount — instant on tab switch
    const fresh = getCachedProfile(pk)
    if (fresh) {
      setProfile(fresh)
      setLoading(false)
      latestAt.current = fresh._createdAt || 0
    }
    let closed = false
    const sockets = []
    RELAYS.forEach(relayUrl => {
      let ws, timer
      const connect = () => {
        if (closed) return
        try {
          ws = new WebSocket(relayUrl)
          const sub = 'p-' + Math.random().toString(36).slice(2, 7)
          ws.onopen = () => {
            if (closed) { ws.close(); return }
            ws.send(JSON.stringify(['REQ', sub, { kinds: [0], authors: [pk], limit: 1 }]))
          }
          ws.onmessage = ({ data }) => {
            if (closed) return
            let m; try { m = JSON.parse(data) } catch { return }
            if (m[0] === 'EOSE') { setLoading(false); return }
            if (m[0] !== 'EVENT') return
            const ev = m[2]
            if (!ev || ev.kind !== 0 || ev.created_at <= latestAt.current) return
            latestAt.current = ev.created_at
            try {
              const p = JSON.parse(ev.content)
              setCachedProfile(pk, p, ev.created_at)
              setProfile(p)
              setLoading(false)
            } catch {}
          }
          ws.onerror = () => {}
          ws.onclose = () => { if (!closed) timer = setTimeout(connect, 4000) }
        } catch {}
      }
      connect()
      sockets.push({ close: () => { closed = true; clearTimeout(timer); try { ws?.close() } catch {} } })
    })
    const t = setTimeout(() => setLoading(false), 8000)
    return () => { closed = true; clearTimeout(t); sockets.forEach(s => s.close()) }
  }, [pk])

  return { profile, loading }
}

