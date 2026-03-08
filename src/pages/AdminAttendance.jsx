/**
 * AdminAttendance.jsx
 * Live Nostr WebSocket subscription — fetches attendance published by ALL teachers.
 * Shows read-only view across all classes.
 */
import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Eye, ChevronRight, Check, X, Loader, School, Calendar } from 'lucide-react'
import { getClasses, getAttendanceByClass, saveAttendance } from '../db'

const RELAYS  = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']
const today   = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export default function AdminAttendance({ dataVersion }) {
  const [view, setView]                   = useState('classes')
  const [classes, setClasses]             = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedDate, setSelectedDate]   = useState(today())
  const [history, setHistory]             = useState([])
  const [dayRecord, setDayRecord]         = useState(null)
  const [loading, setLoading]             = useState(true)
  const [syncing, setSyncing]             = useState(false)

  // track latest event per teacher so we never apply stale events
  const latestByTeacherDate = useRef({})

  // ── Load classes from IndexedDB ───────────────────────────────────
  useEffect(() => {
    getClasses().then(list => {
      setClasses((list || []).sort((a, b) => a.createdAt - b.createdAt))
      setLoading(false)
    })
  }, [dataVersion])

  // ── Live Nostr subscription for ALL teachers' attendance ──────────
  // Runs once on mount. Subscribes to gradebase-attendance events from
  // every teacher in the school, saves to IndexedDB, updates UI live.
  useEffect(() => {
    let closed = false
    const sockets = []

    const startSub = async () => {
      const { getClasses: loadClasses, getTeachers } = await import('../db')
      const [allClasses, teachers] = await Promise.all([loadClasses(), getTeachers()])

      if (!teachers?.length || closed) return

      // Decode all teacher pubkeys
      const teacherPks = []
      try {
        const { nip19 } = await import('nostr-tools')
        for (const t of teachers) {
          try { teacherPks.push({ npub: t.npub, pk: nip19.decode(t.npub).data }) } catch {}
        }
      } catch {}

      if (!teacherPks.length || closed) return

      setSyncing(true)

      RELAYS.forEach(relayUrl => {
        let ws
        let reconnectTimer

        const connect = () => {
          if (closed) return
          try {
            ws = new WebSocket(relayUrl)
            const subId = 'adm-att-' + Math.random().toString(36).slice(2, 8)

            ws.onopen = () => {
              if (closed) { ws.close(); return }
              ws.send(JSON.stringify(['REQ', subId, {
                kinds:   [1],
                authors: teacherPks.map(t => t.pk),
                '#t':    ['gradebase-attendance'],
                limit:   1000,
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
                const key = `${ev.pubkey}:${record.classId}:${record.date}`

                // Skip stale events — only apply newest per teacher+class+date
                if (latestByTeacherDate.current[key] >= ev.created_at) return
                latestByTeacherDate.current[key] = ev.created_at

                // Save to IndexedDB
                await saveAttendance(record)

                // Update history state if this class is currently selected
                setSelectedClass(prev => {
                  if (prev && prev.id === record.classId) {
                    setHistory(h => {
                      const others = h.filter(x => x.date !== record.date)
                      const updated = [...others, record].sort((a, b) => b.date.localeCompare(a.date))
                      return updated
                    })
                  }
                  return prev
                })

              } catch (e) {
                console.warn('[AdminAttendance] parse error:', e)
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

    startSub()
    return () => {
      closed = true
      setSyncing(false)
      sockets.forEach(s => s.close())
    }
  }, [])

  // ── Load cached history when class is selected ────────────────────
  useEffect(() => {
    if (!selectedClass) return
    getAttendanceByClass(selectedClass.id).then(h => {
      const sorted = h.sort((a, b) => b.date.localeCompare(a.date))
      setHistory(sorted)
      if (sorted[0]) { setSelectedDate(sorted[0].date); setDayRecord(sorted[0]) }
    })
  }, [selectedClass?.id])

  // ── Sync dayRecord when selectedDate or history changes ───────────
  useEffect(() => {
    if (!history.length) return
    setDayRecord(history.find(h => h.date === selectedDate) || null)
  }, [selectedDate, history])

  const goBack = () => {
    if (view === 'day')     { setView('history'); return }
    if (view === 'history') { setSelectedClass(null); setHistory([]); setView('classes'); return }
  }

  // ── CLASS LIST ────────────────────────────────────────────────────
  if (view === 'classes') return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div>
          <div style={S.title}>Attendance</div>
          <div style={S.sub}>{fmtDate(today())}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {syncing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
              <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(79,255,176,0.08)', border: '1px solid rgba(79,255,176,0.2)', borderRadius: 20, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
            <Eye size={12} /> View Only
          </div>
        </div>
      </div>
      {loading
        ? <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
        : classes.length === 0
          ? <div style={S.empty}><School size={52} strokeWidth={1} color="var(--muted)" /><div style={S.emptyTitle}>No classes</div></div>
          : (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes.map(cls => (
                <button key={cls.id} style={S.card} onClick={() => { setSelectedClass(cls); setView('history') }}>
                  <div style={{ ...S.badge, background: cls.color?.bg || '#f0fdf4', color: cls.color?.color || '#00c97a', border: `1px solid ${cls.color?.border || '#bbf7d0'}` }}>
                    {cls.name.slice(0, 3).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={S.cardTitle}>{cls.name}</div>
                    <div style={S.cardSub}>{cls.students?.length || 0} students</div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </button>
              ))}
            </div>
          )
      }
    </div>
  )

  // ── HISTORY ───────────────────────────────────────────────────────
  if (view === 'history') return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={goBack} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{selectedClass.name}</span>
        </div>
        {syncing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
            <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Syncing…
          </div>
        )}
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.length === 0
          ? (
            <div style={S.empty}>
              <Calendar size={40} strokeWidth={1} color="var(--muted)" />
              <div style={S.emptyTitle}>No records yet</div>
              <div style={S.emptySub}>Fetching from Nostr…</div>
            </div>
          )
          : history.map(h => {
              const present = h.records?.filter(r => r.status === 'present').length || 0
              const total   = h.records?.length || 0
              const pct     = total > 0 ? Math.round((present / total) * 100) : 0
              return (
                <button key={h.date} style={{ ...S.card, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}
                  onClick={() => { setSelectedDate(h.date); setDayRecord(h); setView('day') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{fmtDate(h.date)}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: pct >= 80 ? '#22c55e' : pct >= 60 ? '#fbbf24' : '#ef4444' }}>{pct}%</div>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>✓ {present} present</span>
                    <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>✗ {total - present} absent</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#22c55e' : pct >= 60 ? '#fbbf24' : '#ef4444', borderRadius: 99 }} />
                  </div>
                </button>
              )
            })
        }
      </div>
    </div>
  )

  // ── DAY DETAIL ────────────────────────────────────────────────────
  if (view === 'day') return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={goBack} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{fmtDate(selectedDate)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
          <Eye size={12} /> Read only
        </div>
      </div>

      {/* Summary bar */}
      {dayRecord && (() => {
        const present = dayRecord.records?.filter(r => r.status === 'present').length || 0
        const total   = dayRecord.records?.length || 0
        const pct     = total > 0 ? Math.round((present / total) * 100) : 0
        return (
          <div style={{ padding: '12px 20px 0', display: 'flex', gap: 10 }}>
            {[
              { label: 'Present', value: present,       color: '#22c55e'      },
              { label: 'Absent',  value: total-present, color: '#ef4444'      },
              { label: 'Total',   value: total,         color: 'var(--muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              </div>
            ))}
          </div>
        )
      })()}

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!dayRecord
          ? <div style={S.empty}><div style={S.emptyTitle}>No record for this date</div></div>
          : dayRecord.records?.map(r => (
              <div key={r.npub} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: r.status === 'present' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1.5px solid ${r.status === 'present' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#00c97a,#00a862)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {r.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{r.npub?.slice(0, 16)}…</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: r.status === 'present' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', border: `1px solid ${r.status === 'present' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.3)'}`, fontSize: 12, fontWeight: 700, color: r.status === 'present' ? '#22c55e' : '#ef4444' }}>
                  {r.status === 'present' ? <Check size={12} /> : <X size={12} />}
                  {r.status === 'present' ? 'Present' : 'Absent'}
                </div>
              </div>
            ))
        }
      </div>
    </div>
  )

  return null
}

const S = {
  page:      { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header:    { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:     { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  sub:       { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  backBtn:   { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', padding: 0 },
  card:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', fontFamily: 'var(--font-display)' },
  badge:     { width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 },
  cardTitle: { fontSize: 14, fontWeight: 800, color: 'var(--text)' },
  cardSub:   { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  center:    { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
  empty:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: 'var(--muted)' },
  emptyTitle:{ fontSize: 16, fontWeight: 800, color: 'var(--text)' },
  emptySub:  { fontSize: 13, color: 'var(--muted)', textAlign: 'center' },
}

