/**
 * TeacherAttendance.jsx
 * Mark present/absent, QR scan, save to Nostr + IndexedDB, history + Excel export.
 * Self-sufficient: if classes not in DB, fetches from Nostr in BG automatically.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, Calendar, QrCode, Download,
  ChevronRight, Users, Search, X,
  Check, Loader, BarChart2, School
} from 'lucide-react'
import { getAttendance, saveAttendance, getAttendanceByClass } from '../db'
import { publishAttendance } from '../nostrSync'
import { useTeacherClasses } from '../hooks/useTeacherClasses'
import QRScanner from './QRScanner'

const today   = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

const STATUS = {
  present: { label: 'Present', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)'  },
  absent:  { label: 'Absent',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)'  },
}

async function exportToExcel(cls, history) {
  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      s.onload = res; s.onerror = rej; document.head.appendChild(s)
    })
  }
  const dates    = history.map(h => h.date).sort()
  const students = cls.students || []
  const header   = ['Student', ...dates.map(fmtDate)]
  const rows     = students.map(stu => {
    const cols = [stu.name]
    for (const date of dates) {
      const rec = history.find(h => h.date === date)
      const r   = rec?.records?.find(r => r.npub === stu.npub)
      cols.push(r ? (r.status === 'present' ? 'P' : 'A') : '-')
    }
    return cols
  })
  const summaryRow = ['TOTAL PRESENT', ...dates.map(date => {
    const rec = history.find(h => h.date === date)
    const n   = rec?.records?.filter(r => r.status === 'present').length || 0
    return `${n}/${students.length}`
  })]
  const ws = window.XLSX.utils.aoa_to_sheet([header, ...rows, [], summaryRow])
  ws['!cols'] = [{ wch: 24 }, ...dates.map(() => ({ wch: 14 }))]
  const wb = window.XLSX.utils.book_new()
  window.XLSX.utils.book_append_sheet(wb, ws, cls.name.slice(0, 31))
  window.XLSX.writeFile(wb, `Attendance_${cls.name}_${today()}.xlsx`)
}

export default function TeacherAttendance({ user, dataVersion }) {
  const { classes, loading } = useTeacherClasses(user)

  const [view, setView]                   = useState('classes')
  const [selectedClass, setSelectedClass] = useState(null)
  const [selectedDate, setSelectedDate]   = useState(today())
  const [records, setRecords]             = useState({})
  const [history, setHistory]             = useState([])
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [showScanner, setShowScanner]     = useState(false)
  const [scanResult, setScanResult]       = useState(null)
  const [search, setSearch]               = useState('')
  const [exporting, setExporting]         = useState(false)
  const [confirmAbsent, setConfirmAbsent] = useState(null)

  useEffect(() => {
    if (!selectedClass) return
    getAttendance(selectedClass.id, selectedDate).then(rec => {
      const map = {}
      if (rec?.records) {
        rec.records.forEach(r => { map[r.npub] = r.status })
      } else {
        selectedClass.students?.forEach(s => { map[s.npub] = 'absent' })
      }
      setRecords(map)
    })
  }, [selectedClass, selectedDate])

  useEffect(() => {
    if (!selectedClass || view !== 'history') return
    getAttendanceByClass(selectedClass.id).then(h => {
      setHistory(h.sort((a, b) => b.date.localeCompare(a.date)))
    })
  }, [selectedClass, view])

  const toggle = (npub) => {
    const current = records[npub] || 'absent'
    if (current === 'present') {
      const stu = selectedClass?.students?.find(s => s.npub === npub)
      setConfirmAbsent(stu || { npub, name: npub.slice(0, 12) + '…' })
      return
    }
    setRecords(prev => ({ ...prev, [npub]: 'present' }))
    setSaved(false)
  }

  const markAllPresent = () => {
    const map = {}
    selectedClass.students?.forEach(s => { map[s.npub] = 'present' })
    setRecords(map); setSaved(false)
  }

  const saveRecord = async () => {
    if (!selectedClass) return
    setSaving(true)
    const attendanceRecord = {
      classId:     selectedClass.id,
      className:   selectedClass.name,
      date:        selectedDate,
      teacherNpub: user.npub,
      records:     selectedClass.students?.map(s => ({
        npub: s.npub, name: s.name, status: records[s.npub] || 'absent',
      })) || [],
    }
    await saveAttendance(attendanceRecord)
    publishAttendance(user.nsec, attendanceRecord).catch(console.warn)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const handleScan = useCallback(async (npub) => {
    const student = selectedClass?.students?.find(s => s.npub === npub)
    if (!student) {
      setShowScanner(false)
      setScanResult({ unknown: true, npub })
      return
    }
    const updatedRecords = { ...records, [npub]: 'present' }
    setRecords(updatedRecords)
    setShowScanner(false)
    setScanResult({ student, profile: null, className: selectedClass.name })

    const attendanceRecord = {
      classId:     selectedClass.id,
      className:   selectedClass.name,
      date:        selectedDate,
      teacherNpub: user.npub,
      records:     selectedClass.students?.map(s => ({
        npub: s.npub, name: s.name, status: updatedRecords[s.npub] || 'absent',
      })) || [],
    }
    saveAttendance(attendanceRecord).catch(console.warn)
    publishAttendance(user.nsec, attendanceRecord).catch(console.warn)

    try {
      const { SimplePool } = await import('nostr-tools/pool')
      const { nip19 }      = await import('nostr-tools')
      const pool   = new SimplePool()
      const pk     = nip19.decode(npub).data
      const RELAYS = ['wss://relay.damus.io','wss://nos.lol','wss://relay.nostr.band']
      const profile = await new Promise(resolve => {
        const sub = pool.subscribe(RELAYS, [{ kinds:[0], authors:[pk], limit:1 }], {
          onevent(e) { try { resolve(JSON.parse(e.content)) } catch { resolve(null) }; try { sub.close() } catch {} },
          oneose()   { resolve(null) },
        })
        setTimeout(() => resolve(null), 5000)
      })
      if (profile) setScanResult(prev => prev ? { ...prev, profile } : prev)
    } catch {}
  }, [selectedClass, selectedDate, records, user])

  const goBack = () => {
    if (view === 'history') { setView('mark'); return }
    setSelectedClass(null); setView('classes'); setSearch('')
  }

  const stats = (() => {
    if (!selectedClass) return { total: 0, present: 0, absent: 0, pct: 0 }
    const total   = selectedClass.students?.length || 0
    const present = Object.values(records).filter(s => s === 'present').length
    return { total, present, absent: total - present, pct: total > 0 ? Math.round((present / total) * 100) : 0 }
  })()

  const filteredStudents = selectedClass?.students?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  // ── CLASS LIST ────────────────────────────────────────────────────
  if (view === 'classes') return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div>
          <div style={S.title}>Attendance</div>
          <div style={S.sub}>{fmtDate(today())}</div>
        </div>
      </div>
      {loading
        ? <div style={S.center}><Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} /></div>
        : classes.length === 0
          ? (
            <div style={S.empty}>
              <School size={52} strokeWidth={1} color="var(--muted)" />
              <div style={S.emptyTitle}>No classes yet</div>
              <div style={S.emptySub}>Create a class first to take attendance.</div>
            </div>
          ) : (
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {classes.map(cls => (
                <button key={cls.id} style={S.classCard} onClick={() => { setSelectedClass(cls); setView('mark') }}>
                  <div style={{ ...S.classBadge, background: cls.color?.bg || '#f0fdf4', color: cls.color?.color || '#00c97a', border: `1px solid ${cls.color?.border || '#bbf7d0'}` }}>
                    {cls.name.slice(0, 3).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={S.className}>{cls.name}</div>
                    <div style={S.classSub}>{cls.students?.length || 0} students</div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </button>
              ))}
            </div>
          )
      }
    </div>
  )

  // ── MARK ATTENDANCE ───────────────────────────────────────────────
  if (view === 'mark') return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={goBack} style={S.backBtn}><ArrowLeft size={15} /> Back</button>
          <span style={{ color: 'var(--muted)' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{selectedClass.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setView('history')} style={S.iconBtn}><BarChart2 size={16} /></button>
          <button onClick={() => setShowScanner(true)}
            style={{ ...S.iconBtn, background: 'rgba(79,255,176,0.1)', color: 'var(--accent)', border: '1px solid rgba(79,255,176,0.2)' }}>
            <QrCode size={16} />
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Calendar size={14} color="var(--muted)" />
        <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSaved(false) }} max={today()}
          style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 12px', color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 13, outline: 'none', cursor: 'pointer' }} />
        <div style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>{fmtDate(selectedDate)}</div>
      </div>

      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 10 }}>
        {[
          { label: 'Present', value: stats.present, color: '#22c55e'      },
          { label: 'Absent',  value: stats.absent,  color: '#ef4444'      },
          { label: 'Total',   value: stats.total,   color: 'var(--muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 20px 0' }}>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${stats.pct}%`, background: stats.pct >= 80 ? '#22c55e' : stats.pct >= 60 ? '#fbbf24' : '#ef4444', borderRadius: 99, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>{stats.pct}% attendance</div>
      </div>

      <div style={{ padding: '10px 20px 0' }}>
        <button onClick={markAllPresent} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, color: '#22c55e', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' }}>
          ✓ Mark All Present
        </button>
      </div>

      <div style={{ padding: '10px 20px 0', position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 34, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none', marginTop: 5 }} />
        <input style={{ ...S.searchInput, paddingLeft: 36 }} placeholder="Search students…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 140 }}>
        {filteredStudents.length === 0 && (
          <div style={S.empty}><Users size={40} strokeWidth={1} color="var(--muted)" /><div style={S.emptyTitle}>No students</div></div>
        )}
        {filteredStudents.map(stu => {
          const status = records[stu.npub] || 'absent'
          const cfg    = STATUS[status]
          return (
            <button key={stu.npub} onClick={() => toggle(stu.npub)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--font-display)', transition: 'all 0.15s' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: stu.grad || 'linear-gradient(135deg,#00c97a,#00a862)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {stu.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{stu.name}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{stu.npub?.slice(0, 16)}…</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 12, fontWeight: 700, color: cfg.color, flexShrink: 0 }}>
                {status === 'present' ? <Check size={12} /> : <X size={12} />}
                {cfg.label}
              </div>
            </button>
          )
        })}
      </div>

      {/* Save bar */}
      <div style={{ position: 'fixed', bottom: 72, left: 0, right: 0, padding: '12px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 10, maxWidth: 480, margin: '0 auto' }}>
          <button onClick={goBack} style={{ padding: '14px 20px', background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 14, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Cancel</button>
          <button onClick={saveRecord} disabled={saving}
            style={{ flex: 1, padding: 14, background: saving ? 'var(--muted)' : saved ? '#22c55e' : 'var(--accent)', border: 'none', borderRadius: 14, color: '#0d0f14', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, cursor: 'pointer', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : saved ? <><Check size={16} /> Saved</> : <><Check size={15} /> Save & Sync</>}
          </button>
        </div>
      </div>

      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* Confirm absent */}
      {confirmAbsent && (
        <div onClick={() => setConfirmAbsent(null)} style={S.modalOverlay}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.modal, border: '1.5px solid rgba(239,68,68,0.35)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <X size={28} color="#ef4444" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Mark as Absent?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{confirmAbsent.name}</span> is currently <span style={{ color: '#22c55e', fontWeight: 700 }}>Present</span>. Mark absent?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmAbsent(null)} style={S.modalSecBtn}>Keep Present</button>
              <button onClick={async () => {
                const updatedRecords = { ...records, [confirmAbsent.npub]: 'absent' }
                setRecords(updatedRecords)
                setConfirmAbsent(null)
                setSaving(true)
                const attendanceRecord = {
                  classId:     selectedClass.id,
                  className:   selectedClass.name,
                  date:        selectedDate,
                  teacherNpub: user.npub,
                  records:     selectedClass.students?.map(s => ({
                    npub: s.npub, name: s.name, status: updatedRecords[s.npub] || 'absent',
                  })) || [],
                }
                await saveAttendance(attendanceRecord)
                publishAttendance(user.nsec, attendanceRecord).catch(console.warn)
                setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
              }} style={S.modalDangerBtn}>Mark Absent</button>
            </div>
          </div>
        </div>
      )}

      {/* Scan result popup */}
      {scanResult && (
        <div onClick={() => setScanResult(null)} style={S.modalOverlay}>
          <div onClick={e => e.stopPropagation()} style={{ ...S.modal, border: `1.5px solid ${scanResult.unknown ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}` }}>
            {scanResult.unknown ? (<>
              <div style={{ width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(239,68,68,0.1)', border: '3px solid rgba(239,68,68,0.4)', display: 'grid', placeItems: 'center' }}>
                <X size={36} color="#ef4444" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>Not In This Class</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 8 }}>
                This student is not enrolled in <span style={{ color: 'var(--text)', fontWeight: 700 }}>{selectedClass?.name}</span>.
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: 24, padding: '6px 12px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                {scanResult.npub?.slice(0, 24)}…
              </div>
              <button onClick={() => setScanResult(null)} style={{ width: '100%', padding: 14, background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.3)', borderRadius: 14, color: '#ef4444', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                Scan Again
              </button>
            </>) : (<>
              <div style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto 6px', border: '3px solid #22c55e', overflow: 'hidden', background: scanResult.student?.grad || 'linear-gradient(135deg,#00c97a,#00a862)', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, color: '#fff' }}>
                {scanResult.profile?.picture
                  ? <img src={scanResult.profile.picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                  : scanResult.student?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', fontSize: 12, fontWeight: 800, color: '#22c55e', marginBottom: 14, marginTop: 12 }}>
                <Check size={13} /> Present
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{scanResult.profile?.name || scanResult.student?.name}</div>
              {scanResult.profile?.about && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>{scanResult.profile.about.slice(0, 80)}</div>}
              <div style={{ display: 'inline-flex', fontSize: 12, color: 'var(--muted)', marginBottom: 24, padding: '4px 12px', background: 'var(--bg)', borderRadius: 20, border: '1px solid var(--border)' }}>{scanResult.className}</div>
              <button onClick={() => setScanResult(null)} style={{ width: '100%', padding: 14, background: 'var(--accent)', border: 'none', borderRadius: 14, color: '#0d1117', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>Scan Next</button>
            </>)}
          </div>
        </div>
      )}
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
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>History</span>
        </div>
        <button
          onClick={async () => { setExporting(true); await exportToExcel(selectedClass, history).catch(console.warn); setExporting(false) }}
          disabled={exporting || history.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(79,255,176,0.1)', border: '1px solid rgba(79,255,176,0.2)', borderRadius: 10, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', opacity: history.length === 0 ? 0.5 : 1 }}>
          {exporting ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />}
          Export Excel
        </button>
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 4 }}>
          {selectedClass.name} · {history.length} day{history.length !== 1 ? 's' : ''} recorded
        </div>
        {history.length === 0 && (
          <div style={S.empty}>
            <Calendar size={40} strokeWidth={1} color="var(--muted)" />
            <div style={S.emptyTitle}>No records yet</div>
            <div style={S.emptySub}>Mark attendance to start building history.</div>
          </div>
        )}
        {history.map(h => {
          const present = h.records?.filter(r => r.status === 'present').length || 0
          const total   = h.records?.length || 0
          const pct     = total > 0 ? Math.round((present / total) * 100) : 0
          return (
            <button key={h.date} onClick={() => { setSelectedDate(h.date); setView('mark') }}
              style={{ ...S.classCard, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        })}
      </div>
    </div>
  )

  return null
}

const S = {
  page:           { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header:         { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:          { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  sub:            { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  backBtn:        { display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)', padding: 0 },
  iconBtn:        { width: 36, height: 36, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)' },
  classCard:      { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', width: '100%', fontFamily: 'var(--font-display)' },
  classBadge:     { width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 },
  className:      { fontSize: 14, fontWeight: 800, color: 'var(--text)' },
  classSub:       { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  searchInput:    { width: '100%', padding: '10px 14px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  center:         { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
  empty:          { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 20px', color: 'var(--muted)' },
  emptyTitle:     { fontSize: 16, fontWeight: 800, color: 'var(--text)' },
  emptySub:       { fontSize: 13, textAlign: 'center', lineHeight: 1.6, maxWidth: 280 },
  modalOverlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal:          { background: 'var(--surface)', borderRadius: 24, padding: '28px 24px', width: '100%', maxWidth: 340, textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' },
  modalSecBtn:    { flex: 1, padding: 13, background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  modalDangerBtn: { flex: 1, padding: 13, background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.35)', borderRadius: 12, color: '#ef4444', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, cursor: 'pointer' },
}

