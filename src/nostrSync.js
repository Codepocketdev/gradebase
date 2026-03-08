/**
 * GradeBase Nostr Sync Engine v3
 * Content format: 'PREFIX:' + JSON.stringify(data)
 */

import { SimplePool } from 'nostr-tools/pool'
import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools'
import { saveSchool, getSchool, replaceAllTeachers, replaceAllClasses, replaceAllPayments, getTeachers, getClasses, getPayments, saveAttendance } from './db'

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

const TAG = { SCHOOL: 'gradebase-school', TEACHERS: 'gradebase-teachers', CLASSES: 'gradebase-classes', PAYMENTS: 'gradebase-payments' }
const P   = { SCHOOL: 'SCHOOL:', TEACHERS: 'TEACHERS:', CLASSES: 'CLASSES:', PAYMENTS: 'PAYMENTS:' }

let _pool = null
function pool() { if (!_pool) _pool = new SimplePool(); return _pool }

let _sub = null, _userNsec = null, _userPk = null, _adminPk = null

export function skFromNsec(nsec) { return nip19.decode(nsec).data }
export function pkFromNsec(nsec) { return getPublicKey(skFromNsec(nsec)) }

// ── NIP-98 image upload ───────────────────────────────────────────────
export async function uploadImage(nsec, file) {
  const PROVIDERS = [
    { name: 'nostr.build',        url: 'https://nostr.build/api/v2/upload/files',  field: 'fileToUpload', getUrl: j => j?.data?.[0]?.url,             auth: true  },
    { name: 'nostrcheck.me',      url: 'https://nostrcheck.me/api/v2/media',        field: 'uploadedfile', getUrl: j => j?.url || j?.data?.url,         auth: true  },
    { name: 'nostr.build legacy', url: 'https://nostr.build/api/upload/image',      field: 'fileToUpload', getUrl: j => j?.data?.display_url || j?.data?.url, auth: false },
  ]
  for (const p of PROVIDERS) {
    try {
      const fd = new FormData()
      fd.append(p.field, file)
      const headers = {}
      if (p.auth && nsec) {
        try {
          const ev = finalizeEvent({ kind: 27235, created_at: Math.floor(Date.now()/1000), tags: [['u', p.url], ['method', 'POST']], content: '' }, skFromNsec(nsec))
          headers['Authorization'] = 'Nostr ' + btoa(JSON.stringify(ev))
        } catch {}
      }
      const res = await fetch(p.url, { method: 'POST', headers, body: fd })
      if (!res.ok) continue
      const url = p.getUrl(await res.json())
      if (url) { console.log(`[nostrSync] upload via ${p.name}: ${url}`); return url }
    } catch (e) { console.warn(`[nostrSync] upload ${p.name} failed:`, e) }
  }
  throw new Error('All upload providers failed')
}

// ── Helpers ───────────────────────────────────────────────────────────
function makeEvent(nsec, content, tag) {
  return finalizeEvent({ kind: 1, created_at: Math.floor(Date.now()/1000), tags: [['t','gradebase'],['t',tag]], content }, skFromNsec(nsec))
}

async function publish(event) {
  const tag = event.tags.find(t => t[0]==='t' && t[1]!=='gradebase')?.[1]
  try { await Promise.any(pool().publish(RELAYS, event)); console.log(`[nostrSync] publish ${tag} OK`); return true }
  catch (e) { console.warn(`[nostrSync] publish ${tag} FAIL`, e); return false }
}

async function fetchEvents(filters, ms = 15000) {
  try {
    console.log('[nostrSync] fetchEvents filters:', JSON.stringify(filters))
    const events = await Promise.race([
      pool().querySync(RELAYS, ...filters),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ])
    console.log('[nostrSync] fetchEvents got:', events.length)
    return events
  } catch (e) {
    console.warn('[nostrSync] fetchEvents failed:', e.message)
    return []
  }
}

async function handleEvent(ev, onUpdate) {
  const tag = ev.tags.find(t => t[0]==='t' && t[1].startsWith('gradebase-'))?.[1]
  if (!tag) return
  try {
    if (tag === TAG.SCHOOL) {
      const raw = ev.content.startsWith(P.SCHOOL) ? ev.content.slice(P.SCHOOL.length) : ev.content
      try {
        const d = JSON.parse(raw)
        await saveSchool({ adminNpub: nip19.npubEncode(ev.pubkey), adminName: d.adminName, schoolName: d.name, about: d.about||'', avatar: d.avatar||'', createdAt: d.createdAt })
        console.log('[nostrSync] school saved:', d.name); onUpdate('school')
      } catch (e) { console.warn('[nostrSync] school parse error:', e.message) }
    }
    else if (tag === TAG.TEACHERS) {
      const raw = ev.content.startsWith(P.TEACHERS) ? ev.content.slice(P.TEACHERS.length) : ev.content
      try {
        const teachers = JSON.parse(raw)
        await replaceAllTeachers(teachers); console.log('[nostrSync] teachers saved:', teachers.length); onUpdate('teachers')
      } catch (e) { console.warn('[nostrSync] teachers parse error:', e.message) }
    }
    else if (tag === TAG.CLASSES) {
      const raw = ev.content.startsWith(P.CLASSES) ? ev.content.slice(P.CLASSES.length) : ev.content
      try {
        const classes = JSON.parse(raw)
        await replaceAllClasses(classes); console.log('[nostrSync] classes saved:', classes.length); onUpdate('classes')
      } catch (e) { console.warn('[nostrSync] classes parse error:', e.message) }
    }
    else if (tag === TAG.PAYMENTS) {
      const raw = ev.content.startsWith(P.PAYMENTS) ? ev.content.slice(P.PAYMENTS.length) : ev.content
      try {
        const payments = JSON.parse(raw)
        await replaceAllPayments(payments); console.log('[nostrSync] payments saved:', payments.length); onUpdate('payments')
      } catch (e) { console.warn('[nostrSync] payments parse error:', e.message) }
    }
    else { console.warn('[nostrSync] unmatched tag/prefix:', tag, ev.content.slice(0,30)) }
  } catch (e) { console.warn('[nostrSync] handleEvent error:', tag, e.message) }
}

// ── detectRole / getNameForNpub ───────────────────────────────────────
export async function detectRole(npub) {
  try {
    const pk = nip19.decode(npub).data
    const evs = await fetchEvents([{ kinds: [1], authors: [pk], '#t': [TAG.SCHOOL], limit: 1 }], 8000)
    if (evs.some(e => e.content.startsWith(P.SCHOOL) || e.content.startsWith('{'))) return 'admin'
    return null
  } catch { return null }
}

export async function getNameForNpub(npub) {
  try {
    const pk = nip19.decode(npub).data
    const evs = await fetchEvents([{ kinds: [0], authors: [pk], limit: 1 }], 5000)
    if (evs.length) { const p = JSON.parse(evs[0].content); return p.name || p.display_name || '' }
  } catch {}
  return ''
}

// ═══════════════════════════════════════════════════════════════════════
// FETCH & SEED
// ═══════════════════════════════════════════════════════════════════════
export async function fetchAndSeed({ role, userNsec, userPk, adminNpub, teacherNpub }) {
  try {
    const filters = []

    if (role === 'admin') {
      filters.push({ kinds: [1], authors: [userPk], '#t': [TAG.SCHOOL, TAG.TEACHERS, TAG.PAYMENTS] })
    }

    if (role === 'teacher') {
      if (!adminNpub) return { found: false, error: 'School ID required' }
      const adminPk = nip19.decode(adminNpub).data
      filters.push({ kinds: [1], authors: [adminPk], '#t': [TAG.SCHOOL, TAG.TEACHERS] })
      filters.push({ kinds: [1], authors: [userPk],  '#t': [TAG.CLASSES] })
    }

    if (role === 'student') {
      if (!teacherNpub) return { found: false, error: 'Teacher ID required' }
      const teacherPk = nip19.decode(teacherNpub).data
      filters.push({ kinds: [1], authors: [teacherPk], '#t': [TAG.CLASSES] })
      const school = await getSchool()
      if (school?.adminNpub) {
        filters.push({ kinds: [1], authors: [nip19.decode(school.adminNpub).data], '#t': [TAG.SCHOOL] })
      }
    }

    if (!filters.length) return { found: false }

    console.log('[nostrSync] fetchAndSeed start, role:', role, 'filters:', JSON.stringify(filters))
    const events = await fetchEvents(filters, 15000)
    console.log('[nostrSync] fetchAndSeed got', events.length, 'events')

    if (!events.length) return { found: false, error: 'School not found. Check School ID and try again.' }

    // Dedupe — newest per author+tag
    const latest = {}
    for (const ev of events) {
      const tag = ev.tags.find(t => t[0]==='t' && t[1].startsWith('gradebase-'))?.[1]
      if (!tag) continue
      const key = `${ev.pubkey}:${tag}`
      if (!latest[key] || ev.created_at > latest[key].created_at) latest[key] = ev
    }

    // School first
    const evList      = Object.values(latest)
    const schoolFirst = [...evList.filter(e => e.tags.some(t => t[1]===TAG.SCHOOL)), ...evList.filter(e => !e.tags.some(t => t[1]===TAG.SCHOOL))]
    for (const ev of schoolFirst) await handleEvent(ev, () => {})

    // ── Admin phase 2: fetch all teachers' classes ────────────────────
    if (role === 'admin') {
      const teachers   = await getTeachers()
      const teacherPks = teachers.map(t => { try { return nip19.decode(t.npub).data } catch { return null } }).filter(Boolean)
      if (teacherPks.length) {
        const classEvs = await fetchEvents([{ kinds: [1], authors: teacherPks, '#t': [TAG.CLASSES] }], 12000)
        const latestCls = {}
        for (const ev of classEvs) {
          if (!latestCls[ev.pubkey] || ev.created_at > latestCls[ev.pubkey].created_at) latestCls[ev.pubkey] = ev
        }
        for (const ev of Object.values(latestCls)) await handleEvent(ev, () => {})
      }
    }

    // Verify
    if (role === 'teacher') {
      const teachers = await getTeachers()
      const myNpub   = nip19.npubEncode(userPk)
      console.log('[nostrSync] teacher verify — myNpub:', myNpub.slice(0,20), '| list:', teachers.map(t=>t.npub?.slice(0,20)))
      if (!teachers.some(t => t.npub === myNpub)) return { found: false, error: 'You are not in this school teacher list. Ask admin to add you.' }
    }

    if (role === 'student') {
      const classes = await getClasses()
      const myNpub  = nip19.npubEncode(userPk)
      if (!classes.some(c => c.students?.some(s => s.npub === myNpub))) return { found: false, error: 'You are not enrolled in any class. Ask your teacher.' }
    }

    return { found: true }
  } catch (err) {
    console.error('[nostrSync] fetchAndSeed error:', err)
    return { found: false, error: err.message }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ATTENDANCE SEED — fetch all attendance for given teacher pubkeys
// Called on boot for all roles so attendance survives cache clears
// ═══════════════════════════════════════════════════════════════════════
export async function fetchAndSeedAttendance(teacherPks) {
  if (!teacherPks?.length) return
  try {
    const evs = await fetchEvents([{
      kinds: [1], authors: teacherPks, '#t': [TAG_ATTENDANCE], limit: 1000
    }], 15000)

    console.log('[nostrSync] fetchAndSeedAttendance got', evs.length, 'events')

    // Dedupe — newest per classId:date
    const latest = {}
    for (const ev of evs) {
      try {
        const raw = ev.content.startsWith(P_ATTENDANCE) ? ev.content.slice(P_ATTENDANCE.length) : null
        if (!raw) continue
        const record = JSON.parse(raw)
        const key    = `${record.classId}:${record.date}`
        if (!latest[key] || ev.created_at > latest[key].at) latest[key] = { record, at: ev.created_at }
      } catch {}
    }

    for (const { record } of Object.values(latest)) {
      try { await saveAttendance(record) } catch {}
    }
    console.log('[nostrSync] fetchAndSeedAttendance seeded', Object.keys(latest).length, 'records')
  } catch (e) {
    console.warn('[nostrSync] fetchAndSeedAttendance error:', e)
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PAYMENTS + FEES SEED — fetch all fee structures + payment entries
// Called on boot/cache-clear for all roles so payments survive cache clears
// adminNpub is the school admin who publishes all fee/payment events
// ═══════════════════════════════════════════════════════════════════════
export async function fetchAndSeedPayments(adminNpub) {
  if (!adminNpub) return
  try {
    const { saveFeeStructure, savePayment } = await import('./db')
    const adminPk = nip19.decode(adminNpub).data

    const evs = await fetchEvents([
      { kinds: [1], authors: [adminPk], '#t': [TAG_FEES, TAG_PAYMENT_ENTRY], limit: 2000 }
    ], 15000)

    console.log('[nostrSync] fetchAndSeedPayments got', evs.length, 'events')

    // Dedupe fee structures by year+term — keep newest
    const latestFees = {}
    // Dedupe payment entries by id — keep newest
    const latestPmts = {}

    for (const ev of evs) {
      const tag = ev.tags.find(t => t[0]==='t' && (t[1]===TAG_FEES || t[1]===TAG_PAYMENT_ENTRY))?.[1]
      if (!tag) continue

      if (tag === TAG_FEES) {
        try {
          const raw  = ev.content.startsWith(P_FEES) ? ev.content.slice(P_FEES.length) : null
          if (!raw) continue
          const data = JSON.parse(raw)
          const key  = `${data.year}-${data.term}`
          if (!latestFees[key] || ev.created_at > latestFees[key].at) {
            latestFees[key] = { data: { ...data, key }, at: ev.created_at }
          }
        } catch {}
      }

      if (tag === TAG_PAYMENT_ENTRY) {
        try {
          const raw  = ev.content.startsWith(P_PAYMENT_ENTRY) ? ev.content.slice(P_PAYMENT_ENTRY.length) : null
          if (!raw) continue
          const data = JSON.parse(raw)
          if (data.deleted) continue
          if (!latestPmts[data.id] || ev.created_at > latestPmts[data.id].at) {
            latestPmts[data.id] = { data, at: ev.created_at }
          }
        } catch {}
      }
    }

    for (const { data } of Object.values(latestFees)) {
      try { await saveFeeStructure(data) } catch {}
    }
    for (const { data } of Object.values(latestPmts)) {
      try { await savePayment(data) } catch {}
    }

    console.log('[nostrSync] fetchAndSeedPayments seeded',
      Object.keys(latestFees).length, 'fee structures,',
      Object.keys(latestPmts).length, 'payment entries'
    )
  } catch (e) {
    console.warn('[nostrSync] fetchAndSeedPayments error:', e)
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLISH
// ═══════════════════════════════════════════════════════════════════════
export async function publishSchool(adminNsec, schoolData) {
  const sk = skFromNsec(adminNsec)
  const schoolEv  = makeEvent(adminNsec, P.SCHOOL + JSON.stringify({ name: schoolData.schoolName, adminName: schoolData.adminName, about: schoolData.about||'', avatar: schoolData.avatar||'', app: 'gradebase', createdAt: schoolData.createdAt||Date.now() }), TAG.SCHOOL)
  const profileEv = finalizeEvent({ kind: 0, created_at: Math.floor(Date.now()/1000), tags: [], content: JSON.stringify({ name: schoolData.adminName, about: schoolData.about||`Admin of ${schoolData.schoolName} on GradeBase`, picture: schoolData.avatar||'', website: 'https://gradebase.app' }) }, sk)
  try { await Promise.any(pool().publish(RELAYS, schoolEv));  console.log('[nostrSync] school kind:1 OK') }  catch (e) { console.warn('[nostrSync] school kind:1 FAIL', e) }
  try { await Promise.any(pool().publish(RELAYS, profileEv)); console.log('[nostrSync] school kind:0 OK') }  catch (e) { console.warn('[nostrSync] school kind:0 FAIL', e) }
  return true
}

export async function publishTeachers(adminNsec, teachers) { return publish(makeEvent(adminNsec, P.TEACHERS + JSON.stringify(teachers), TAG.TEACHERS)) }
export async function publishClasses(teacherNsec, classes)  { return publish(makeEvent(teacherNsec, P.CLASSES  + JSON.stringify(classes),  TAG.CLASSES))  }
export async function publishPayments(adminNsec, payments)  { return publish(makeEvent(adminNsec, P.PAYMENTS  + JSON.stringify(payments),  TAG.PAYMENTS)) }

// ═══════════════════════════════════════════════════════════════════════
// SYNC WRAPPERS
// ═══════════════════════════════════════════════════════════════════════
export async function syncAddTeacher(adminNsec, teacher) {
  const updated = [...(await getTeachers()).filter(t => t.npub !== teacher.npub), teacher]
  await replaceAllTeachers(updated); return publishTeachers(adminNsec, updated)
}
export async function syncRemoveTeacher(adminNsec, npub) {
  const updated = (await getTeachers()).filter(t => t.npub !== npub)
  await replaceAllTeachers(updated); return publishTeachers(adminNsec, updated)
}
export async function syncSaveClass(teacherNsec, cls) {
  const updated = [...(await getClasses()).filter(c => c.id !== cls.id), cls]
  await replaceAllClasses(updated); return publishClasses(teacherNsec, updated)
}
export async function syncDeleteClass(teacherNsec, classId) {
  const updated = (await getClasses()).filter(c => c.id !== classId)
  await replaceAllClasses(updated); return publishClasses(teacherNsec, updated)
}
export async function syncSavePayment(adminNsec, payment) {
  const updated = [...(await getPayments()).filter(p => p.id !== payment.id), payment]
  await replaceAllPayments(updated); return publishPayments(adminNsec, updated)
}
export async function syncDeletePayment(adminNsec, paymentId) {
  const updated = (await getPayments()).filter(p => p.id !== paymentId)
  await replaceAllPayments(updated); return publishPayments(adminNsec, updated)
}

// ═══════════════════════════════════════════════════════════════════════
// LIVE SYNC
// ═══════════════════════════════════════════════════════════════════════
export function startSync(userNsec, userPk, adminPk, role, onUpdate) {
  if (_sub) { try { _sub.close() } catch {} }
  _userNsec = userNsec; _userPk = userPk; _adminPk = adminPk

  const filters = [
    { kinds: [1], authors: [adminPk], '#t': [TAG.SCHOOL, TAG.TEACHERS] },
    { kinds: [0], authors: [adminPk], limit: 1 },
  ]
  if (role === 'admin')   filters.push({ kinds: [1], authors: [adminPk], '#t': [TAG.PAYMENTS] })
  if (role === 'teacher') filters.push({ kinds: [1], authors: [userPk],  '#t': [TAG.CLASSES]  })
  if (role === 'admin')   filters.push({ kinds: [1], authors: [adminPk], '#t': [TAG.CLASSES]  })

  const latest = {}
  _sub = pool().subscribe(RELAYS, filters, {
    async onevent(ev) {
      if (ev.kind === 0) {
        try {
          const profile = JSON.parse(ev.content)
          const school  = await getSchool()
          if (school && nip19.npubEncode(ev.pubkey) === school.adminNpub) {
            await saveSchool({ ...school, adminName: profile.name||school.adminName, avatar: profile.picture||school.avatar||'', about: profile.about||school.about||'' })
            onUpdate('school')
          }
        } catch {}
        return
      }
      const tag = ev.tags.find(t => t[0]==='t' && t[1].startsWith('gradebase-'))?.[1]
      if (!tag) return
      const key = `${ev.pubkey}:${tag}`
      if (latest[key] && latest[key] >= ev.created_at) return
      latest[key] = ev.created_at
      await handleEvent(ev, onUpdate)
    },
    onclose(r) { console.warn('[nostrSync] relay closed:', r) },
  })
  console.log(`[nostrSync] startSync OK — role:${role}`)
}

export function stopSync() {
  if (_sub) { try { _sub.close() } catch {}; _sub = null }
  _userNsec = _userPk = _adminPk = null
  console.log('[nostrSync] stopped')
}


// ═══════════════════════════════════════════════════════════════════════
// ATTENDANCE SYNC
// ═══════════════════════════════════════════════════════════════════════
const TAG_ATTENDANCE = 'gradebase-attendance'
const P_ATTENDANCE   = 'ATTENDANCE:'

export async function publishAttendance(teacherNsec, attendanceRecord) {
  const content = P_ATTENDANCE + JSON.stringify(attendanceRecord)
  const event   = makeEvent(teacherNsec, content, TAG_ATTENDANCE)
  return publish(event)
}

export async function fetchAttendanceForClass(teacherNpub, classId) {
  try {
    const pk  = nip19.decode(teacherNpub).data
    const evs = await fetchEvents([{
      kinds: [1], authors: [pk], '#t': [TAG_ATTENDANCE], limit: 200
    }], 15000)

    const results = []
    for (const ev of evs) {
      try {
        const raw    = ev.content.startsWith(P_ATTENDANCE) ? ev.content.slice(P_ATTENDANCE.length) : null
        if (!raw) continue
        const record = JSON.parse(raw)
        if (record.classId === classId) results.push({ ...record, nostrId: ev.id, createdAt: ev.created_at })
      } catch {}
    }
    const byDate = {}
    for (const r of results) {
      if (!byDate[r.date] || r.createdAt > byDate[r.date].createdAt) byDate[r.date] = r
    }
    return Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date))
  } catch (e) {
    console.warn('[nostrSync] fetchAttendanceForClass error:', e)
    return []
  }
}


// ═══════════════════════════════════════════════════════════════════════
// FEES & PAYMENTS SYNC (v4)
// ═══════════════════════════════════════════════════════════════════════
const TAG_FEES          = 'gradebase-fees'
const TAG_PAYMENT_ENTRY = 'gradebase-payment-entry'
const P_FEES            = 'FEES:'
const P_PAYMENT_ENTRY   = 'PAYMENT_ENTRY:'

export async function publishFeeStructure(adminNsec, structure) {
  const content = P_FEES + JSON.stringify(structure)
  const event   = makeEvent(adminNsec, content, TAG_FEES)
  return publish(event)
}

export async function publishPaymentEntry(adminNsec, payment) {
  const content = P_PAYMENT_ENTRY + JSON.stringify(payment)
  const event   = makeEvent(adminNsec, content, TAG_PAYMENT_ENTRY)
  return publish(event)
}

export async function publishPaymentDelete(adminNsec, paymentId) {
  const content = P_PAYMENT_ENTRY + JSON.stringify({ deleted: true, id: paymentId, deletedAt: Date.now() })
  const event   = makeEvent(adminNsec, content, TAG_PAYMENT_ENTRY)
  return publish(event)
}

export async function fetchFeeStructure(adminNpub, year, term) {
  try {
    const pk  = nip19.decode(adminNpub).data
    const evs = await fetchEvents([{ kinds: [1], authors: [pk], '#t': [TAG_FEES], limit: 50 }], 12000)
    let best = null
    for (const ev of evs) {
      try {
        const raw = ev.content.startsWith(P_FEES) ? ev.content.slice(P_FEES.length) : null
        if (!raw) continue
        const data = JSON.parse(raw)
        if (data.year === year && data.term === term) {
          if (!best || ev.created_at > best.created_at) best = { ...data, nostrId: ev.id, createdAt: ev.created_at }
        }
      } catch {}
    }
    return best
  } catch (e) {
    console.warn('[nostrSync] fetchFeeStructure error:', e)
    return null
  }
}

export async function fetchAllFeeStructures(adminNpub) {
  try {
    const pk  = nip19.decode(adminNpub).data
    const evs = await fetchEvents([{ kinds: [1], authors: [pk], '#t': [TAG_FEES], limit: 50 }], 12000)
    const byKey = {}
    for (const ev of evs) {
      try {
        const raw = ev.content.startsWith(P_FEES) ? ev.content.slice(P_FEES.length) : null
        if (!raw) continue
        const data = JSON.parse(raw)
        const key  = `${data.year}-${data.term}`
        if (!byKey[key] || ev.created_at > byKey[key].created_at) {
          byKey[key] = { ...data, key, nostrId: ev.id, createdAt: ev.created_at }
        }
      } catch {}
    }
    return Object.values(byKey)
  } catch (e) {
    console.warn('[nostrSync] fetchAllFeeStructures error:', e)
    return []
  }
}

export async function fetchPaymentEntries(adminNpub, { term, year, classId } = {}) {
  try {
    const pk  = nip19.decode(adminNpub).data
    const evs = await fetchEvents([{ kinds: [1], authors: [pk], '#t': [TAG_PAYMENT_ENTRY], limit: 1000 }], 15000)
    const payments = []
    for (const ev of evs) {
      try {
        const raw = ev.content.startsWith(P_PAYMENT_ENTRY) ? ev.content.slice(P_PAYMENT_ENTRY.length) : null
        if (!raw) continue
        const data = JSON.parse(raw)
        if (data.deleted) continue
        if (term    && data.term    !== term)    continue
        if (year    && data.year    !== year)    continue
        if (classId && data.classId !== classId) continue
        payments.push({ ...data, nostrId: ev.id })
      } catch {}
    }
    const byId = {}
    for (const p of payments) {
      if (!byId[p.id] || p.createdAt > byId[p.id].createdAt) byId[p.id] = p
    }
    return Object.values(byId).sort((a, b) => b.createdAt - a.createdAt)
  } catch (e) {
    console.warn('[nostrSync] fetchPaymentEntries error:', e)
    return []
  }
}

