/**
 * hooks/useTeacherClasses.js
 *
 * Shared hook for Students, TeacherAttendance, TeacherPayments.
 * Same strategy as Classes.jsx — the only thing that actually works:
 *  1. Read IndexedDB instantly → render immediately
 *  2. Open live WebSocket to all 3 relays (same as Classes.jsx)
 *  3. On newer gradebase-classes event → write to IndexedDB → update state
 *  4. Auto-reconnect every 4s if relay drops
 */
import { useState, useEffect, useRef } from 'react'
import { getClasses, replaceAllClasses } from '../db'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

export function useTeacherClasses(user) {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const latestAt = useRef(0)

  useEffect(() => {
    if (!user?.pk || !user?.npub) return
    let closed = false

    // ── Step 1: IndexedDB instantly ──────────────────────────────────
    getClasses().then(list => {
      if (closed) return
      const mine = (list || []).filter(c => c.teacherNpub === user.npub).sort((a, b) => a.createdAt - b.createdAt)
      setClasses(mine)
      setLoading(false)
    }).catch(() => setLoading(false))

    // ── Step 2: Live WebSocket — exact same as Classes.jsx ───────────
    const sockets = []
    const seen = new Set()

    const subscribe = (relayUrl) => {
      let ws, reconnectTimer

      const connect = () => {
        if (closed) return
        try {
          ws = new WebSocket(relayUrl)
          const subId = 'cls-' + Math.random().toString(36).slice(2, 8)

          ws.onopen = () => {
            if (closed) { ws.close(); return }
            ws.send(JSON.stringify(['REQ', subId, {
              kinds: [1], authors: [user.pk], '#t': ['gradebase-classes'], limit: 20,
            }]))
          }

          ws.onmessage = async ({ data }) => {
            if (closed) return
            let msg
            try { msg = JSON.parse(data) } catch { return }
            if (msg[0] !== 'EVENT') return
            const ev = msg[2]
            if (!ev || seen.has(ev.id)) return
            seen.add(ev.id)
            if (ev.created_at <= latestAt.current) return
            latestAt.current = ev.created_at

            const raw = ev.content.startsWith('CLASSES:') ? ev.content.slice('CLASSES:'.length) : null
            if (!raw) return

            try {
              const incoming = JSON.parse(raw)
              if (!Array.isArray(incoming)) return

              let teacherNpub = user.npub
              try { const { nip19 } = await import('nostr-tools'); teacherNpub = nip19.npubEncode(ev.pubkey) } catch {}

              const existing = await getClasses()
              const others   = existing.filter(c => c.teacherNpub !== teacherNpub)
              await replaceAllClasses([...others, ...incoming])

              if (!closed) {
                setClasses(incoming.sort((a, b) => a.createdAt - b.createdAt))
                setLoading(false)
              }
            } catch (e) { console.warn('[useTeacherClasses] parse error:', e) }
          }

          ws.onerror = () => {}
          ws.onclose = () => { if (!closed) reconnectTimer = setTimeout(connect, 4000) }
        } catch {}
      }

      connect()
      sockets.push({ close: () => { closed = true; clearTimeout(reconnectTimer); try { ws?.close() } catch {} } })
    }

    RELAYS.forEach(subscribe)

    return () => {
      closed = true
      sockets.forEach(s => s.close())
    }
  }, [user?.pk, user?.npub])

  return { classes, loading }
}

