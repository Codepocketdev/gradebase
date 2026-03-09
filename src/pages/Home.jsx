/**
 * Home.jsx — Role-specific dashboard
 * Admin:   school stats, fee collection, teacher/student counts
 * Teacher: their class, today's attendance, quick actions
 * Student: personal balance, attendance rate, class info
 */
import { useState, useEffect } from 'react'
import {
  School, Users, GraduationCap, Wallet, ClipboardList,
  ChevronRight, TrendingUp, Award, BookOpen, Calendar,
  CheckCircle, XCircle, Loader, UtensilsCrossed
} from 'lucide-react'
import { getClasses, getSchool, getPayments, getAllFeeStructures, getAttendanceByClass } from '../db'
import { computeStudentBalance } from '../computeBalance'

const fmt  = (n) => `KSh ${Number(n || 0).toLocaleString()}`
const today = () => new Date().toISOString().slice(0, 10)
const CURRENT_TERM = 'term1'
const CURRENT_YEAR = new Date().getFullYear()

// ── ADMIN HOME ────────────────────────────────────────────────────
function AdminHome({ user, schoolName, onNavigate, dataVersion }) {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [classes, payments, feeStructures, school] = await Promise.all([
        getClasses(), getPayments(), getAllFeeStructures(), getSchool()
      ])
      const allStudents  = (classes || []).flatMap(c => c.students || [])
      const termPayments = (payments || []).filter(p => p.term === CURRENT_TERM && p.year === CURRENT_YEAR)
      const totalCollected = termPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      const activeFees   = (feeStructures || []).find(f => f.year === CURRENT_YEAR && f.term === CURRENT_TERM)
      const fullyPaid    = allStudents.filter(s => {
        const cls = (classes || []).find(c => c.students?.some(st => st.npub === s.npub))
        return cls ? computeStudentBalance(s.npub, s.lunchType, termPayments, activeFees, cls.id).fullyPaid : false
      }).length

      // Total expected = sum of each student's total fees
      const totalExpected = allStudents.reduce((sum, s) => {
        const cls = (classes || []).find(c => c.students?.some(st => st.npub === s.npub))
        if (!cls) return sum
        return sum + computeStudentBalance(s.npub, s.lunchType, termPayments, activeFees, cls.id).total
      }, 0)

      // Teacher count from school record or unique teacherNpubs in classes
      const teacherNpubs = [...new Set((classes || []).map(c => c.teacherNpub).filter(Boolean))]

      setStats({
        classes:         (classes || []).length,
        students:        allStudents.length,
        teachers:        teacherNpubs.length,
        totalCollected,
        totalExpected,
        fullyPaid,
        schoolName:      school?.schoolName || schoolName || 'Your School',
        recentPayments:  termPayments.sort((a, b) => b.createdAt - a.createdAt).slice(0, 3),
      })
      setLoading(false)
    }
    load()
  }, [dataVersion])

  if (loading) return (
    <div style={S.center}>
      <Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const name = user?.name?.split(' ')[0] || 'Admin'

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroIcon}><School size={28} color="var(--accent)" strokeWidth={1.5} /></div>
        <div style={S.heroName}>Welcome back, {name}</div>
        <div style={S.heroSub}>{stats.schoolName}</div>
      </div>

      {/* Key stats row */}
      <div style={S.section}>
        <div style={S.grid3}>
          {[
            { label: 'Classes',  value: stats.classes,  icon: BookOpen      },
            { label: 'Students', value: stats.students, icon: Users          },
            { label: 'Teachers', value: stats.teachers, icon: GraduationCap  },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} style={S.statCard}>
              <div style={{ ...S.statIcon, background: 'rgba(79,255,176,0.1)', color: 'var(--accent)' }}>
                <Icon size={16} />
              </div>
              <div style={S.statValue}>{value}</div>
              <div style={S.statLabel}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Fee collection */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Term 1 · {CURRENT_YEAR} Collection</div>
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e' }}>{fmt(stats.totalCollected)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>collected this term</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{stats.fullyPaid}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>fully paid</div>
            </div>
          </div>
          {stats.totalExpected > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                  {fmt(stats.totalCollected)} of {fmt(stats.totalExpected)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
                  {Math.round((stats.totalCollected / stats.totalExpected) * 100)}%
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, Math.round((stats.totalCollected / stats.totalExpected) * 100))}%`, background: '#22c55e', borderRadius: 99 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent payments */}
      {stats.recentPayments.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionLabel}>Recent Payments</div>
          <div style={S.card}>
            {stats.recentPayments.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: i < stats.recentPayments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{p.studentName || 'Student'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.categoryName} · {new Date(p.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{fmt(p.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Quick Access</div>
        {[
          { label: 'View Payments',    sub: 'Fee collection & balances', page: 'payments',      icon: Wallet         },
          { label: 'Manage Teachers',  sub: 'Add or view teachers',      page: 'teachers',      icon: GraduationCap  },
          { label: 'Fee Structure',    sub: 'Set term fees & lunch',      page: 'fee-structure', icon: TrendingUp     },
        ].map(({ label, sub, page, icon: Icon }) => (
          <button key={page} style={S.quickLink} onClick={() => onNavigate(page)}>
            <div style={{ ...S.quickIcon, background: 'rgba(79,255,176,0.08)', color: 'var(--accent)' }}>
              <Icon size={16} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
            </div>
            <ChevronRight size={15} color="var(--muted)" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── TEACHER HOME ──────────────────────────────────────────────────
function TeacherHome({ user, onNavigate, dataVersion }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const classes = await getClasses()
      const mine    = (classes || []).filter(c => c.teacherNpub === user.npub)
      const students = mine.flatMap(c => c.students || [])

      // Today's attendance across all classes
      let presentToday = 0, totalToday = 0
      for (const cls of mine) {
        const { getAttendance } = await import('../db')
        const rec = await getAttendance(cls.id, today())
        if (rec?.records) {
          totalToday   += rec.records.length
          presentToday += rec.records.filter(r => r.status === 'present').length
        }
      }

      setData({ classes: mine, students, presentToday, totalToday })
      setLoading(false)
    }
    load()
  }, [user.npub, dataVersion])

  if (loading) return (
    <div style={S.center}>
      <Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const name = user?.name?.split(' ')[0] || 'Teacher'
  const attendancePct = data.totalToday > 0 ? Math.round((data.presentToday / data.totalToday) * 100) : null

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroIcon}><GraduationCap size={28} color="var(--accent)" strokeWidth={1.5} /></div>
        <div style={S.heroName}>Good day, {name}</div>
        <div style={S.heroSub}>{data.classes.length} class{data.classes.length !== 1 ? 'es' : ''} · {data.students.length} students</div>
      </div>

      {/* Today's attendance */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Today's Attendance</div>
        <div style={S.card}>
          {attendancePct === null ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)', marginBottom: 12 }}>No attendance marked yet today</div>
              <button style={S.accentBtn} onClick={() => onNavigate('attendance')}>
                <ClipboardList size={15} /> Mark Attendance
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                    <CheckCircle size={14} /> {data.presentToday} present
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                    <XCircle size={14} /> {data.totalToday - data.presentToday} absent
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: attendancePct >= 80 ? '#22c55e' : attendancePct >= 60 ? '#fbbf24' : '#ef4444' }}>
                  {attendancePct}%
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${attendancePct}%`, background: attendancePct >= 80 ? '#22c55e' : attendancePct >= 60 ? '#fbbf24' : '#ef4444', borderRadius: 99 }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* My classes */}
      {data.classes.length > 0 && (
        <div style={S.section}>
          <div style={S.sectionLabel}>My Classes</div>
          {data.classes.map(cls => (
            <div key={cls.id} style={{ ...S.quickLink, marginBottom: 8 }} onClick={() => onNavigate('students')}>
              <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, background: cls.color?.bg || '#f0fdf4', color: cls.color?.color || '#00c97a', border: `1px solid ${cls.color?.border || '#bbf7d0'}` }}>
                {cls.name.slice(0, 3).toUpperCase()}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{cls.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{cls.students?.length || 0} students</div>
              </div>
              <ChevronRight size={15} color="var(--muted)" />
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div style={S.section}>
        <div style={S.sectionLabel}>Quick Access</div>
        {[
          { label: 'Attendance', sub: 'Mark or view records', page: 'attendance', icon: ClipboardList },
          { label: 'Payments',   sub: 'View student balances', page: 'payments',   icon: Wallet        },
          { label: 'Students',   sub: 'Browse your class',     page: 'students',   icon: Users         },
        ].map(({ label, sub, page, icon: Icon }) => (
          <button key={page} style={{ ...S.quickLink, marginBottom: 8 }} onClick={() => onNavigate(page)}>
            <div style={{ ...S.quickIcon, background: 'rgba(79,255,176,0.08)', color: 'var(--accent)' }}>
              <Icon size={16} />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
            </div>
            <ChevronRight size={15} color="var(--muted)" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── STUDENT HOME ──────────────────────────────────────────────────
function StudentHome({ user, onNavigate, dataVersion }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [classes, payments, feeStructures, school] = await Promise.all([
        getClasses(), getPayments(), getAllFeeStructures(), getSchool()
      ])

      // Find which class this student is in
      let myClass = null, myRecord = null
      for (const cls of (classes || [])) {
        const found = cls.students?.find(s => s.npub === user.npub)
        if (found) { myClass = cls; myRecord = found; break }
      }

      // Balance
      const termPayments = (payments || []).filter(p => p.term === CURRENT_TERM && p.year === CURRENT_YEAR)
      const activeFees   = (feeStructures || []).find(f => f.year === CURRENT_YEAR && f.term === CURRENT_TERM)
      const bal = myClass
        ? computeStudentBalance(user.npub, myRecord?.lunchType, termPayments, activeFees, myClass.id)
        : null

      // Attendance rate for this student
      let attended = 0, total = 0
      if (myClass) {
        const history = await getAttendanceByClass(myClass.id)
        for (const h of (history || [])) {
          const r = h.records?.find(r => r.npub === user.npub)
          if (r) { total++; if (r.status === 'present') attended++ }
        }
      }

      setData({
        myClass,
        myRecord,
        bal,
        attended,
        total,
        attendancePct: total > 0 ? Math.round((attended / total) * 100) : null,
        schoolName: school?.schoolName || '',
        lunchType: myRecord?.lunchType || 'monthly',
      })
      setLoading(false)
    }
    load()
  }, [user.npub, dataVersion])

  if (loading) return (
    <div style={S.center}>
      <Loader size={20} color="var(--muted)" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const name = user?.name?.split(' ')[0] || 'Student'
  const LUNCH_LABELS = { monthly: 'Monthly', weekly: 'Weekly', daily: 'Daily', home: 'Home Lunch' }

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Hero */}
      <div style={S.hero}>
        <div style={S.heroIcon}><BookOpen size={28} color="var(--accent)" strokeWidth={1.5} /></div>
        <div style={S.heroName}>Hi, {name} 👋</div>
        <div style={S.heroSub}>{data.myClass?.name || '—'}{data.schoolName ? ` · ${data.schoolName}` : ''}</div>
      </div>

      {/* Balance card */}
      {data.bal && (
        <div style={S.section}>
          <div style={S.sectionLabel}>Term 1 · {CURRENT_YEAR} Fees</div>
          <div style={{ ...S.card, border: data.bal.fullyPaid ? '1.5px solid rgba(34,197,94,0.4)' : '1px solid var(--border)' }}>
            {data.bal.fullyPaid ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Award size={28} color="#fbbf24" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>Fully Paid ✓</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>All fees cleared for this term</div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>Balance due</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: '#ef4444' }}>{fmt(data.bal.balance)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 4 }}>Paid so far</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{fmt(data.bal.paid)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${data.bal.total > 0 ? Math.min(100, (data.bal.paid / data.bal.total) * 100) : 0}%`, background: 'var(--accent)', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, textAlign: 'right' }}>
                  {fmt(data.bal.paid)} of {fmt(data.bal.total)}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Attendance */}
      <div style={S.section}>
        <div style={S.sectionLabel}>My Attendance</div>
        <div style={S.card}>
          {data.total === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>No attendance records yet</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{data.attended} of {data.total} days present</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: data.attendancePct >= 80 ? '#22c55e' : data.attendancePct >= 60 ? '#fbbf24' : '#ef4444' }}>
                  {data.attendancePct}%
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${data.attendancePct}%`, background: data.attendancePct >= 80 ? '#22c55e' : data.attendancePct >= 60 ? '#fbbf24' : '#ef4444', borderRadius: 99 }} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lunch + quick links */}
      <div style={S.section}>
        <div style={S.sectionLabel}>My Info</div>
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              <UtensilsCrossed size={14} /> Lunch
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{LUNCH_LABELS[data.lunchType]}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              <BookOpen size={14} /> Class
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{data.myClass?.name || '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ ...S.section, paddingBottom: 100 }}>
        <button style={S.accentBtn} onClick={() => onNavigate('payments')}>
          <Wallet size={15} /> View My Fees
        </button>
      </div>
    </div>
  )
}

// ── ROUTER ────────────────────────────────────────────────────────
export default function Home({ user, userRole, schoolName, onNavigate, dataVersion }) {
  if (userRole === 'teacher') return <TeacherHome user={user} onNavigate={onNavigate} dataVersion={dataVersion} />
  if (userRole === 'student') return <StudentHome user={user} onNavigate={onNavigate} dataVersion={dataVersion} />
  return <AdminHome user={user} schoolName={schoolName} onNavigate={onNavigate} dataVersion={dataVersion} />
}

// ── SHARED STYLES ─────────────────────────────────────────────────
const S = {
  page:       { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  center:     { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  hero:       { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 24px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', textAlign: 'center' },
  heroIcon:   { width: 64, height: 64, borderRadius: 18, background: 'var(--bg)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', marginBottom: 14 },
  heroName:   { fontSize: 22, fontWeight: 800, color: 'var(--text)' },
  heroSub:    { fontSize: 13, color: 'var(--muted)', marginTop: 4 },
  section:    { padding: '16px 20px 0' },
  sectionLabel: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 10 },
  card:       { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px' },
  grid3:      { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  statCard:   { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  statIcon:   { width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center' },
  statValue:  { fontSize: 22, fontWeight: 800, color: 'var(--text)' },
  statLabel:  { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6 },
  quickLink:  { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: 8, fontFamily: 'var(--font-display)' },
  quickIcon:  { width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0 },
  accentBtn:  { width: '100%', padding: 14, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#0d1117', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
}

