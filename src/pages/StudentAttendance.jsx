/**
 * StudentAttendance.jsx
 * Live WebSocket subscription to teacher's attendance events on Nostr.
 * Shows personal record + monthly calendar.
 */
import { useState, useEffect } from 'react'
import { Loader } from 'lucide-react'
import { getClasses, getAttendanceByClass, saveAttendance } from '../db'

const RELAYS   = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const fmtMonth = (d) => new Date(d + '-01').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
const today    = () => new Date().toISOString().slice(0, 10)

function daysInMonth(y, m)  { return new Date(y, m + 1, 0).getDate() }
function firstDayOfMonth(y, m) { return new Date(y, m, 1).getDay() }

export default function StudentAttendance({ user }) {
  const [history, setHistory]         = useState([])
  const [monthOffset, setMonthOffset] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [myClass, setMyClass]         = useState(null)   // { id, teacherNpub }
  const [syncing, setSyncing]         = useState(false)

  // ── Step 1: find which class this student is in ─────────────────
  useEffect(() => {
    const findClass = async () => {
      const classes = await getClasses()
      for (const cls of (classes || [])) {
        if (cls.students?.some(s => s.npub === user.npub)) {
          setMyClass({ id: cls.id, teacherNpub: cls.teacherNpub })
          return
        }
      }
      setLoading(false)
    }
    findClass()
  }, [user.npub])

  // ── Step 2: load cached attendance from IndexedDB ───────────────
  useEffect(() => {
    if (!myClass) return
    getAttendanceByClass(myClass.id).then(recs => {
      const mine = (recs || []).filter(r => r.records?.some(s => s.npub === user.npub))
      setHistory(mine.sort((a, b) => a.date.localeCompare(b.date)))
      setLoading(false)
    })
  }, [myClass, user.npub])

  // ── Step 3: live Nostr subscription ─────────────────────────────
  // Opens WebSocket to all relays, watches teacher's attendance events,
  // saves to IndexedDB, and updates state. Auto-reconnects on disconnect.
  useEffect(() => {
    if (!myClass?.teacherNpub) return

    let closed      = false
    let latestByDate = {}  // date -> created_at, so we only apply newest per day
    const sockets   = []

    const getTeacherPk = async () => {
      try {
        const { nip19 } = await import('nostr-tools')
        return nip19.decode(myClass.teacherNpub).data
      } catch { return null }
    }

    const startSubscriptions = async () => {
      const teacherPk = await getTeacherPk()
      if (!teacherPk || closed) return

      setSyncing(true)

      RELAYS.forEach(relayUrl => {
        let ws
        let reconnectTimer

        const connect = () => {
          if (closed) return
          try {
            ws = new WebSocket(relayUrl)
            const subId = 'att-' + Math.random().toString(36).slice(2, 8)

            ws.onopen = () => {
              if (closed) { ws.close(); return }
              // Subscribe to this teacher's attendance events
              ws.send(JSON.stringify(['REQ', subId, {
                kinds:   [1],
                authors: [teacherPk],
                '#t':    ['gradebase-attendance'],
                limit:   500,
              }]))
            }

            ws.onmessage = async ({ data }) => {
              if (closed) return
              let msg
              try { msg = JSON.parse(data) } catch { return }

              if (msg[0] === 'EOSE') { setSyncing(false); return }
              if (msg[0] !== 'EVENT') return

              const ev = msg[2]
              if (!ev?.content?.startsWith('ATTENDANCE:')) return

              try {
                const record = JSON.parse(ev.content.slice('ATTENDANCE:'.length))
                // Must be for this student's class
                if (record.classId !== myClass.id) return
                // Skip if we already have a newer event for this date
                if (latestByDate[record.date] && latestByDate[record.date] >= ev.created_at) return
                latestByDate[record.date] = ev.created_at

                // Check if this student is in the records
                const myRecord = record.records?.find(r => r.npub === user.npub)
                if (!myRecord) return

                // Save to IndexedDB
                await saveAttendance(record)

                // Update state
                if (!closed) {
                  setHistory(prev => {
                    const others = prev.filter(h => h.date !== record.date)
                    return [...others, record].sort((a, b) => a.date.localeCompare(b.date))
                  })
                }
              } catch (e) {
                console.warn('[StudentAttendance] parse error:', e)
              }
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
    }

    startSubscriptions()
    return () => {
      closed = true
      setSyncing(false)
      sockets.forEach(s => s.close())
    }
  }, [myClass?.id, myClass?.teacherNpub, user.npub])

  // ── Calendar math ────────────────────────────────────────────────
  const now         = new Date()
  const displayDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const year        = displayDate.getFullYear()
  const month       = displayDate.getMonth()

  const totalDays   = history.length
  const presentDays = history.filter(h => h.records?.find(r => r.npub === user.npub)?.status === 'present').length
  const absentDays  = totalDays - presentDays
  const pct         = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

  const dateStatus = {}
  history.forEach(h => {
    const r = h.records?.find(r => r.npub === user.npub)
    if (r) dateStatus[h.date] = r.status
  })

  const numDays  = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const cells    = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= numDays; d++) cells.push(d)
  const dateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={S.header}>
        <div>
          <div style={S.title}>My Attendance</div>
          <div style={S.sub}>Your personal record</div>
        </div>
        {syncing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
            <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…
          </div>
        )}
      </div>

      {loading
        ? <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
        : (
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: 'Total Days', value: totalDays,   color: 'var(--text)' },
                { label: 'Present',    value: presentDays, color: '#22c55e'     },
                { label: 'Absent',     value: absentDays,  color: '#ef4444'     },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Rate bar */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Attendance Rate</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: pct >= 80 ? '#22c55e' : pct >= 60 ? '#fbbf24' : '#ef4444' }}>{pct}%</div>
              </div>
              <div style={{ height: 10, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 60 ? '#fbbf24' : '#ef4444', borderRadius: 99, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                {totalDays === 0
                  ? 'No records yet — check back after class'
                  : pct >= 80 ? '✓ Good attendance'
                  : pct >= 60 ? '⚠ Needs improvement'
                  : '✗ Poor attendance — speak to your teacher'}
              </div>
            </div>

            {/* Calendar */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <button onClick={() => setMonthOffset(v => v - 1)}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--text)', fontSize: 18 }}>‹</button>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                  {fmtMonth(`${year}-${String(month + 1).padStart(2, '0')}`)}
                </div>
                <button onClick={() => setMonthOffset(v => Math.min(v + 1, 0))} disabled={monthOffset === 0}
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'grid', placeItems: 'center', cursor: monthOffset === 0 ? 'not-allowed' : 'pointer', color: monthOffset === 0 ? 'var(--muted)' : 'var(--text)', opacity: monthOffset === 0 ? 0.4 : 1, fontSize: 18 }}>›</button>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                {['S','M','T','W','T','F','S'].map((d, i) => (
                  <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textAlign: 'center', padding: '2px 0' }}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />
                  const key    = dateKey(year, month, day)
                  const status = dateStatus[key]
                  const isToday = key === today()
                  return (
                    <div key={key} style={{
                      aspectRatio: '1', borderRadius: 8, display: 'grid', placeItems: 'center',
                      fontSize: 11, fontWeight: status ? 800 : 500,
                      background: status === 'present' ? 'rgba(34,197,94,0.2)' : status === 'absent' ? 'rgba(239,68,68,0.08)' : 'transparent',
                      color:      status === 'present' ? '#22c55e' : status === 'absent' ? '#ef4444' : 'var(--muted)',
                      border:     isToday ? '1.5px solid var(--accent)' : status === 'present' ? '1px solid rgba(34,197,94,0.4)' : status === 'absent' ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
                    }}>
                      {day}
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 14, justifyContent: 'center' }}>
                {[
                  { color: '#22c55e', bg: 'rgba(34,197,94,0.2)',  label: 'Present'   },
                  { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'Absent'    },
                  { color: 'var(--muted)', bg: 'transparent',     label: 'No record' },
                ].map(({ color, bg, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1px solid ${color}60` }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )
      }
    </div>
  )
}

const S = {
  page:   { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header: { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:  { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  sub:    { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
}

