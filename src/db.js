/**
 * GradeBase IndexedDB Cache
 * v7: added SALT store for encryption key
 */

const DB_NAME    = 'gradebase'
const DB_VERSION = 7

const STORES = {
  SCHOOL:     'school',
  TEACHERS:   'teachers',
  CLASSES:    'classes',
  PAYMENTS:   'payments',
  ATTENDANCE: 'attendance',
  FEES:       'fees',
  PROFILES:   'profiles',
  LEDGER:     'ledger',
  BUDGETS:    'budgets',
  SALT:       'salt',
}

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
        const cl = e.target.transaction.objectStore(STORES.CLASSES)
        if (!cl.indexNames.contains('teacherNpub')) {
          cl.createIndex('teacherNpub', 'teacherNpub', { unique: false })
        }
      }

      if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
        const p = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' })
        p.createIndex('studentNpub', 'studentNpub', { unique: false })
        p.createIndex('classId',     'classId',     { unique: false })
        p.createIndex('term',        'term',        { unique: false })
        p.createIndex('year',        'year',        { unique: false })
      } else if (oldVer < 4) {
        const p = e.target.transaction.objectStore(STORES.PAYMENTS)
        if (!p.indexNames.contains('classId')) p.createIndex('classId', 'classId', { unique: false })
        if (!p.indexNames.contains('term'))    p.createIndex('term',    'term',    { unique: false })
        if (!p.indexNames.contains('year'))    p.createIndex('year',    'year',    { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.ATTENDANCE)) {
        const at = db.createObjectStore(STORES.ATTENDANCE, { keyPath: 'key' })
        at.createIndex('classId',     'classId',     { unique: false })
        at.createIndex('date',        'date',        { unique: false })
        at.createIndex('teacherNpub', 'teacherNpub', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.FEES)) {
        const f = db.createObjectStore(STORES.FEES, { keyPath: 'key' })
        f.createIndex('year', 'year', { unique: false })
        f.createIndex('term', 'term', { unique: false })
      }

      if (!db.objectStoreNames.contains(STORES.PROFILES)) {
        db.createObjectStore(STORES.PROFILES, { keyPath: 'pk' })
      }

      // ── LEDGER (v6) ───────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.LEDGER)) {
        const l = db.createObjectStore(STORES.LEDGER, { keyPath: 'id' })
        l.createIndex('type',     'type',     { unique: false })
        l.createIndex('category', 'category', { unique: false })
        l.createIndex('date',     'date',     { unique: false })
      }

      // ── BUDGETS (v6) ──────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.BUDGETS)) {
        db.createObjectStore(STORES.BUDGETS, { keyPath: 'category' })
      }

      // ── SALT (v7) ─────────────────────────────────────────────────
      if (!db.objectStoreNames.contains(STORES.SALT)) {
        db.createObjectStore(STORES.SALT)
      }
    }

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror   = (e) => reject(e.target.error)
  })
}

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
  if (!result) {
    try {
      const cached = localStorage.getItem('gb_school_cache')
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  }
  return result
}

export async function saveSchool(data) {
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
export async function getClasses() {
  const { store } = await tx(STORES.CLASSES)
  return promisify(store.getAll())
}

export async function getClassesByTeacher(teacherNpub) {
  const { store } = await tx(STORES.CLASSES)
  return promisify(store.index('teacherNpub').getAll(teacherNpub))
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
  return promisify(store.index('studentNpub').getAll(studentNpub))
}

export async function getPaymentsByClass(classId) {
  const { store } = await tx(STORES.PAYMENTS)
  return promisify(store.index('classId').getAll(classId))
}

export async function getPaymentsByTerm(term, year) {
  const all = await getPayments()
  return all.filter(p => p.term === term && p.year === year)
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

// ── FEES ──────────────────────────────────────────────────────────────
export async function getFeeStructure(year, term) {
  const { store } = await tx(STORES.FEES)
  return promisify(store.get(`${year}-${term}`))
}

export async function getAllFeeStructures() {
  const { store } = await tx(STORES.FEES)
  return promisify(store.getAll())
}

export async function saveFeeStructure(structure) {
  const key = `${structure.year}-${structure.term}`
  const { store } = await tx(STORES.FEES, 'readwrite')
  return promisify(store.put({ ...structure, key }))
}

export async function deleteFeeStructure(year, term) {
  const { store } = await tx(STORES.FEES, 'readwrite')
  return promisify(store.delete(`${year}-${term}`))
}

// ── ATTENDANCE ────────────────────────────────────────────────────────
export async function getAttendance(classId, date) {
  const { store } = await tx(STORES.ATTENDANCE)
  return promisify(store.get(`${classId}:${date}`))
}

export async function saveAttendance(record) {
  const key = `${record.classId}:${record.date}`
  const { store } = await tx(STORES.ATTENDANCE, 'readwrite')
  return promisify(store.put({ ...record, key }))
}

export async function getAttendanceByClass(classId) {
  const { store } = await tx(STORES.ATTENDANCE)
  return promisify(store.index('classId').getAll(classId))
}

export async function getAttendanceByDate(date) {
  const { store } = await tx(STORES.ATTENDANCE)
  return promisify(store.index('date').getAll(date))
}

export async function getAttendanceByTeacher(teacherNpub) {
  const { store } = await tx(STORES.ATTENDANCE)
  return promisify(store.index('teacherNpub').getAll(teacherNpub))
}

// ── PROFILES ──────────────────────────────────────────────────────────
export async function getProfile(pk) {
  const { store } = await tx(STORES.PROFILES)
  return promisify(store.get(pk))
}

export async function saveProfile(pk, content, createdAt) {
  const existing = await getProfile(pk)
  if (existing && existing.createdAt >= createdAt) return existing
  const record = { pk, ...content, createdAt }
  const { store } = await tx(STORES.PROFILES, 'readwrite')
  await promisify(store.put(record))
  return record
}

// ── LEDGER ────────────────────────────────────────────────────────────
export async function getLedgerTransactions() {
  const { store } = await tx(STORES.LEDGER)
  const all = await promisify(store.getAll())
  return all.sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveLedgerTransaction(txn) {
  const { store } = await tx(STORES.LEDGER, 'readwrite')
  return promisify(store.put(txn))
}

export async function deleteLedgerTransaction(id) {
  const { store } = await tx(STORES.LEDGER, 'readwrite')
  return promisify(store.delete(id))
}

export async function replaceAllLedgerTransactions(txns) {
  const { store, transaction } = await tx(STORES.LEDGER, 'readwrite')
  return new Promise((resolve, reject) => {
    store.clear()
    txns.forEach(t => store.put(t))
    transaction.oncomplete = () => resolve()
    transaction.onerror    = (e) => reject(e.target.error)
  })
}

// ── BUDGETS ───────────────────────────────────────────────────────────
export async function getBudgetsMap() {
  const { store } = await tx(STORES.BUDGETS)
  const all = await promisify(store.getAll())
  const map = {}
  all.forEach(b => { map[b.category] = b.amount })
  return map
}

export async function saveBudget(category, amount) {
  const { store } = await tx(STORES.BUDGETS, 'readwrite')
  return promisify(store.put({ category, amount }))
}

// ── SALT ──────────────────────────────────────────────────────────────
export async function getSalt() {
  const { store } = await tx(STORES.SALT)
  return promisify(store.get('main'))
}

export async function saveSalt(salt) {
  const { store } = await tx(STORES.SALT, 'readwrite')
  return promisify(store.put(salt, 'main'))
}

// ── ROLE DETECTION ────────────────────────────────────────────────────
export async function detectRole(npub) {
  const [school, teachers, classes] = await Promise.all([
    getSchool(), getTeachers(), getClasses(),
  ])
  if (school?.adminNpub === npub)                   return 'admin'
  if (teachers.find(t => t.npub === npub))          return 'teacher'
  for (const cls of classes) {
    if (cls.students?.find(s => s.npub === npub))   return 'student'
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

// ── CLEAR ALL ─────────────────────────────────────────────────────────
export async function clearAllData() {
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

