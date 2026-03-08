/**
 * hooks/useNostrProfile.js
 *
 * Strategy:
 *  1. Read from IndexedDB instantly on mount → zero flash on tab switch
 *  2. Open persistent WebSocket to all 3 relays
 *  3. On newer kind:0 → write to IndexedDB → update state
 *  4. Auto-reconnect every 4s if relay drops
 *  5. After user saves their own profile → call saveProfile() directly
 *     so next mount reads the new data before relay echoes back
 */
import { useState, useEffect, useRef } from 'react'
import { getProfile, saveProfile } from '../db'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

export function useNostrProfile(pk) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const latestAt = useRef(0)

  useEffect(() => {
    if (!pk) return
    let closed = false

    // ── Step 1: Read IndexedDB immediately ──────────────────────────
    getProfile(pk).then(cached => {
      if (closed) return
      if (cached) {
        setProfile(cached)
        setLoading(false)
        latestAt.current = cached.createdAt || 0
      }
    }).catch(() => {})

    // ── Step 2: Open live WebSocket to every relay ──────────────────
    const sockets = []

    RELAYS.forEach(relayUrl => {
      let ws, reconnectTimer

      const connect = () => {
        if (closed) return
        try {
          ws = new WebSocket(relayUrl)
          const sub = 'prof-' + Math.random().toString(36).slice(2, 8)

          ws.onopen = () => {
            if (closed) { ws.close(); return }
            ws.send(JSON.stringify(['REQ', sub, { kinds: [0], authors: [pk], limit: 1 }]))
          }

          ws.onmessage = ({ data }) => {
            if (closed) return
            let msg
            try { msg = JSON.parse(data) } catch { return }

            if (msg[0] === 'EOSE') {
              // End of stored events — we're live now
              setLoading(false)
              return
            }
            if (msg[0] !== 'EVENT') return

            const ev = msg[2]
            if (!ev || ev.kind !== 0) return
            if (ev.created_at <= latestAt.current) return  // already have newer

            try {
              const content = JSON.parse(ev.content)
              latestAt.current = ev.created_at

              // ── Write to IndexedDB then update UI ─────────────────
              saveProfile(pk, content, ev.created_at).then(saved => {
                if (!closed && saved) setProfile(saved)
              }).catch(() => {})

              setLoading(false)
            } catch {}
          }

          ws.onerror = () => {}
          ws.onclose = () => {
            if (!closed) reconnectTimer = setTimeout(connect, 4000)
          }
        } catch {}
      }

      connect()
      sockets.push({
        close: () => {
          closed = true
          clearTimeout(reconnectTimer)
          try { ws?.close() } catch {}
        }
      })
    })

    // Fallback — stop spinner after 8s even if all relays are silent
    const timeout = setTimeout(() => setLoading(false), 8000)

    return () => {
      closed = true
      clearTimeout(timeout)
      sockets.forEach(s => s.close())
    }
  }, [pk])

  return { profile, loading }
}

