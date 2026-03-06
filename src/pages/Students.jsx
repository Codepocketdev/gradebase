import { useState, useEffect } from 'react'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import {
  Plus, Users, ChevronRight, Search,
  School, X, UserPlus, ArrowLeft
} from 'lucide-react'
import StudentModal from './StudentModal'

const STORAGE_KEY = 'gb_classes'
const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [] } catch { return [] } }
const save = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d))

const CLASS_COLORS = [
  { bg: '#f0fdf4', color: '#00c97a', border: '#bbf7d0' },
  { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
  { bg: '#fdf4ff', color: '#a855f7', border: '#e9d5ff' },
  { bg: '#fff7ed', color: '#f97316', border: '#fed7aa' },
  { bg: '#fef2f2', color: '#ef4444', border: '#fecaca' },
  { bg: '#f0fdfa', color: '#14b8a6', border: '#99f6e4' },
  { bg: '#fefce8', color: '#eab308', border: '#fef08a' },
  { bg: '#fdf2f8', color: '#ec4899', border: '#fbcfe8' },
]

const GRAD = [
  'linear-gradient(135deg,#00c97a,#00a862)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#f97316,#ea580c)',
  'linear-gradient(135deg,#ef4444,#dc2626)',
  'linear-gradient(135deg,#14b8a6,#0d9488)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#ec4899,#db2777)',
]

export default function Students({ userRole }) {
  const [classes, setClasses] = useState(load)
  const [selectedClass, setSelectedClass] = useState(null)
  const [search, setSearch] = useState('')
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [newStudentName, setNewStudentName] = useState('')

  const isAdmin   = userRole === 'admin'
  const isTeacher = userRole === 'teacher'
  const canAdd    = isAdmin || isTeacher
  const canDelete = isAdmin || isTeacher

  useEffect(() => { save(classes) }, [classes])

  // Sync selectedClass when classes update
  useEffect(() => {
    if (selectedClass) {
      const updated = classes.find(c => c.id === selectedClass.id)
      if (updated) setSelectedClass(updated)
    }
  }, [classes])

  const addStudent = () => {
    if (!newStudentName.trim() || !selectedClass) return
    const sk   = generateSecretKey()
    const pk   = getPublicKey(sk)
    const npub = nip19.npubEncode(pk)
    const nsec = nip19.nsecEncode(sk)
    const grad = GRAD[selectedClass.students.length % GRAD.length]
    const student = {
      id: Date.now(),
      name: newStudentName.trim(),
      pk, npub, nsec, grad,
      classId: selectedClass.id,
      className: selectedClass.name,
      createdAt: Date.now(),
    }
    setClasses(prev => prev.map(c =>
      c.id === selectedClass.id ? { ...c, students: [...c.students, student] } : c
    ))
    setNewStudentName('')
    setShowAddStudent(false)
  }

  const deleteStudent = (studentId) => {
    setClasses(prev => prev.map(c => ({
      ...c, students: c.students.filter(s => s.id !== studentId)
    })))
    setSelectedStudent(null)
  }

  const students = selectedClass
    ? selectedClass.students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        {selectedClass ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => { setSelectedClass(null); setSearch('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, padding: 0 }}
            >
              <ArrowLeft size={15} /> Classes
            </button>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span style={S.title}>{selectedClass.name}</span>
          </div>
        ) : (
          <div style={S.title}>Students</div>
        )}

        {canAdd && selectedClass && (
          <button style={S.addBtn} onClick={() => setShowAddStudent(true)}>
            <Plus size={15} /> Add Student
          </button>
        )}
      </div>

      {/* Search */}
      <div style={S.searchWrap}>
        <Search size={15} style={S.searchIcon} />
        <input
          style={S.searchInput}
          placeholder={selectedClass ? 'Search students...' : 'Search classes...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Class List ── */}
      {!selectedClass && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <div style={S.sectionLabel}>All Classes</div>
            <div style={S.sectionCount}>{classes.length} classes · {classes.flatMap(c => c.students).length} students</div>
          </div>

          {classes.length === 0 ? (
            <div style={S.empty}>
              <School size={48} strokeWidth={1} color="var(--muted)" />
              <div style={S.emptyTitle}>No classes yet</div>
              <div style={S.emptySub}>
                Go to More → Classes to create your first class, then come back here to add students.
              </div>
            </div>
          ) : (
            <div style={S.list}>
              {classes
                .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
                .map(cls => (
                  <div key={cls.id} style={S.classCard} onClick={() => { setSelectedClass(cls); setSearch('') }}>
                    <div style={{ ...S.classBadge, background: cls.color.bg, color: cls.color.color, border: `1px solid ${cls.color.border}` }}>
                      {cls.name.slice(0, 3).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={S.className}>{cls.name}</div>
                      <div style={S.classSub}>{cls.students.length} student{cls.students.length !== 1 ? 's' : ''}</div>
                    </div>
                    <ChevronRight size={16} color="var(--muted)" />
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Student List ── */}
      {selectedClass && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <div style={S.sectionLabel}>{students.length} student{students.length !== 1 ? 's' : ''}</div>
          </div>

          {students.length === 0 ? (
            <div style={S.empty}>
              <Users size={48} strokeWidth={1} color="var(--muted)" />
              <div style={S.emptyTitle}>No students yet</div>
              <div style={S.emptySub}>
                {canAdd
                  ? 'Tap + Add Student to register a student and generate their identity.'
                  : 'No students in this class yet.'}
              </div>
            </div>
          ) : (
            <div style={S.list}>
              {students.map(stu => (
                <div key={stu.id} style={S.studentRow} onClick={() => setSelectedStudent(stu)}>
                  <div style={{ ...S.avatar, background: stu.grad }}>
                    {stu.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.stuName}>{stu.name}</div>
                    <div style={S.stuSub}>{stu.npub.slice(0, 16)}...</div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Student Sheet ── */}
      {showAddStudent && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowAddStudent(false)}>
          <div style={S.sheet}>
            <button style={S.closeBtn} onClick={() => setShowAddStudent(false)}><X size={15} /></button>
            <div style={S.sheetTitle}>Add Student</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              A unique identity will be generated for this student automatically. Share the student's private key with them or their parent to let them log in.
            </div>
            <div style={S.inputLabel}>Full Name</div>
            <input
              style={S.input}
              placeholder="e.g. Amara Kamau"
              value={newStudentName}
              onChange={e => setNewStudentName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStudent()}
              autoFocus
            />
            <button style={{ ...S.primaryBtn, marginTop: 8 }} onClick={addStudent}>
              <UserPlus size={16} /> Register Student
            </button>
            <button style={S.secondaryBtn} onClick={() => { setShowAddStudent(false); setNewStudentName('') }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Student Modal ── */}
      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          userRole={userRole}
          onClose={() => setSelectedStudent(null)}
          onDelete={canDelete ? deleteStudent : null}
        />
      )}

    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header: { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  addBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0d1117', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)' },

  searchWrap: { padding: '14px 20px 0', position: 'relative' },
  searchInput: { width: '100%', padding: '11px 14px 11px 38px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  searchIcon: { position: 'absolute', left: 32, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' },

  section: { padding: '16px 20px 0' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' },
  sectionCount: { fontSize: 11, color: 'var(--muted)', fontWeight: 600 },

  list: { display: 'flex', flexDirection: 'column', gap: 8 },

  classCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  classBadge: { width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 },
  className: { fontSize: 14, fontWeight: 800, color: 'var(--text)' },
  classSub: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },

  studentRow: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  avatar: { width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 },
  stuName: { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  stuSub: { fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 },

  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 20px', color: 'var(--muted)' },
  emptyTitle: { fontSize: 16, fontWeight: 800, color: 'var(--text)' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 1.6, maxWidth: 280 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 44px', position: 'relative', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' },
  closeBtn: { position: 'absolute', top: 20, right: 20, background: 'var(--surface2)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)' },
  sheetTitle: { fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 },
  inputLabel: { fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input: { width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 11, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  primaryBtn: { width: '100%', padding: 14, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#0d1117', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryBtn: { width: '100%', padding: 14, marginTop: 8, background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' },
}

