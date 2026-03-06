/**
 * GradeBase IndexedDB Cache
 * ─────────────────────────
 * Stores all school data locally so the app works instantly
 * even before Nostr relay responds.
 *
 * Stores:
 *   school    — { adminNpub, adminName, schoolName, createdAt }
 *   teachers  — [{ npub, name, classId?, createdAt }]
 *   classes   — [{ id, name, color, students: [...] }]
 *   payments  — [{ id, studentNpub, amount, note, createdAt }]
 */

const DB_NAME    = 'gradebase'
const DB_VERSION = 2

const STORES = {
  SCHOOL:   'school',
  TEACHERS: 'teachers',
  CLASSES:  'classes',
  PAYMENTS: 'payments',
}

// ── Open / init DB ────────────────────────────────────────────────────
let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db     = e.target.result
      const oldVer = e.oldVersion

      if (!db.objectStoreNames.contains(STORES.SCHOOL)) {
        db.createObjectStore(STORES.SCHOOL)
      }
      if (!db.objectStoreNames.contains(STORES.TEACHERS)) {
        const s = db.createObjectStore(STORES.TEACHERS, { keyPath: 'npub' })
        s.createIndex('name', 'name', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORES.CLASSES)) {
        const cl = db.createObjectStore(STORES.CLASSES, { keyPath: 'id' })
        cl.createIndex('teacherNpub', 'teacherNpub', { unique: false })
      } else if (oldVer < 2) {
        const txn = e.target.transaction
        const cl  = txn.objectStore(STORES.CLASSES)
        if (!cl.indexNames.contains('teacherNpub')) {
          cl.createIndex('teacherNpub', 'teacherNpub', { unique: false })
        }
      }
      if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
        const p = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' })
        p.createIndex('studentNpub', 'studentNpub', { unique: false })
      }
    }

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ── Generic helpers ───────────────────────────────────────────────────
function tx(storeName, mode = 'readonly') {
  return openDB().then(db => {
    const transaction = db.transaction(storeName, mode)
    const store       = transaction.objectStore(storeName)
    return { transaction, store }
  })
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })
}

// ── SCHOOL ────────────────────────────────────────────────────────────
export async function getSchool() {
  const { store } = await tx(STORES.SCHOOL)
  const result = await promisify(store.get('main'))
  // ── Fallback to localStorage if DB is cold (new port / fresh device) ──
  if (!result) {
    try {
      const cached = localStorage.getItem('gb_school_cache')
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  }
  return result
}

export async function saveSchool(data) {
  // ── Also cache in localStorage so session restore works cross-origin ──
  try { localStorage.setItem('gb_school_cache', JSON.stringify(data)) } catch {}
  const { store } = await tx(STORES.SCHOOL, 'readwrite')
  return promisify(store.put(data, 'main'))
}

// ── TEACHERS ──────────────────────────────────────────────────────────
export async function getTeachers() {
  const { store } = await tx(STORES.TEACHERS)
  return promisify(store.getAll())
}

export async function saveTeacher(teacher) {
  const { store } = await tx(STORES.TEACHERS, 'readwrite')
  return promisify(store.put(teacher))
}

export async function deleteTeacher(npub) {
  const { store } = await tx(STORES.TEACHERS, 'readwrite')
  return promisify(store.delete(npub))
}

export async function replaceAllTeachers(teachers) {
  const { store, transaction } = await tx(STORES.TEACHERS, 'readwrite')
  return new Promise((resolve, reject) => {
    store.clear()
    teachers.forEach(t => store.put(t))
    transaction.oncomplete = () => resolve()
    transaction.onerror    = (e) => reject(e.target.error)
  })
}

// ── CLASSES ───────────────────────────────────────────────────────────
export async function getClassesByTeacher(teacherNpub) {
  const { store } = await tx(STORES.CLASSES)
  const index     = store.index('teacherNpub')
  return promisify(index.getAll(teacherNpub))
}

export async function getClasses() {
  const { store } = await tx(STORES.CLASSES)
  return promisify(store.getAll())
}

export async function saveClass(cls) {
  const { store } = await tx(STORES.CLASSES, 'readwrite')
  return promisify(store.put(cls))
}

export async function deleteClass(id) {
  const { store } = await tx(STORES.CLASSES, 'readwrite')
  return promisify(store.delete(id))
}

export async function replaceAllClasses(classes) {
  const { store, transaction } = await tx(STORES.CLASSES, 'readwrite')
  return new Promise((resolve, reject) => {
    store.clear()
    classes.forEach(c => store.put(c))
    transaction.oncomplete = () => resolve()
    transaction.onerror    = (e) => reject(e.target.error)
  })
}

// ── PAYMENTS ──────────────────────────────────────────────────────────
export async function getPayments() {
  const { store } = await tx(STORES.PAYMENTS)
  return promisify(store.getAll())
}

export async function getPaymentsByStudent(studentNpub) {
  const { store } = await tx(STORES.PAYMENTS)
  const index     = store.index('studentNpub')
  return promisify(index.getAll(studentNpub))
}

export async function savePayment(payment) {
  const { store } = await tx(STORES.PAYMENTS, 'readwrite')
  return promisify(store.put(payment))
}

export async function deletePayment(id) {
  const { store } = await tx(STORES.PAYMENTS, 'readwrite')
  return promisify(store.delete(id))
}

export async function replaceAllPayments(payments) {
  const { store, transaction } = await tx(STORES.PAYMENTS, 'readwrite')
  return new Promise((resolve, reject) => {
    store.clear()
    payments.forEach(p => store.put(p))
    transaction.oncomplete = () => resolve()
    transaction.onerror    = (e) => reject(e.target.error)
  })
}

// ── ROLE DETECTION ────────────────────────────────────────────────────
export async function detectRole(npub) {
  const [school, teachers, classes] = await Promise.all([
    getSchool(),
    getTeachers(),
    getClasses(),
  ])

  if (school?.adminNpub === npub)                return 'admin'
  if (teachers.find(t => t.npub === npub))        return 'teacher'
  for (const cls of classes) {
    if (cls.students?.find(s => s.npub === npub)) return 'student'
  }
  return null
}

export async function getNameForNpub(npub, role) {
  if (role === 'admin') {
    const school = await getSchool()
    return school?.adminName || ''
  }
  if (role === 'teacher') {
    const teachers = await getTeachers()
    return teachers.find(t => t.npub === npub)?.name || ''
  }
  if (role === 'student') {
    const classes = await getClasses()
    for (const cls of classes) {
      const s = cls.students?.find(s => s.npub === npub)
      if (s) return s.name
    }
  }
  return ''
}

// ── CLEAR ALL (logout / factory reset) ───────────────────────────────
export async function clearAllData() {
  // Clear localStorage caches too
  localStorage.removeItem('gb_school_cache')
  localStorage.removeItem('gb_sync_meta')

  const db     = await openDB()
  const stores = Object.values(STORES)
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, 'readwrite')
    stores.forEach(name => transaction.objectStore(name).clear())
    transaction.oncomplete = () => resolve()
    transaction.onerror    = (e) => reject(e.target.error)
  })
}

export { STORES }

