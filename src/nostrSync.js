/**
 * GradeBase Nostr Sync Engine v3
 * Content format: 'PREFIX:' + JSON.stringify(data)
 */

import { SimplePool } from 'nostr-tools/pool'
import { nip19, getPublicKey, finalizeEvent } from 'nostr-tools'
import { saveSchool, getSchool, replaceAllTeachers, replaceAllClasses, replaceAllPayments, getTeachers, getClasses, getPayments } from './db'

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
      // ── MERGE teacher classes instead of blindly replacing ────────
      // Each teacher owns their own classes — merge by teacherNpub so
      // one teacher's publish never wipes another teacher's classes.
      const raw = ev.content.startsWith(P.CLASSES) ? ev.content.slice(P.CLASSES.length) : ev.content
      try {
        const incoming = JSON.parse(raw)
        const teacherPk = nip19.npubEncode(ev.pubkey)
        const existing  = await getClasses()
        // Keep classes from OTHER teachers, replace only this teacher's
        const others  = existing.filter(c => c.teacherNpub !== teacherPk)
        const merged  = [...others, ...incoming]
        await replaceAllClasses(merged)
        console.log('[nostrSync] classes merged — teacher:', teacherPk.slice(0,16), 'count:', incoming.length)
        onUpdate('classes')
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
      // Phase 1: fetch school + teachers + payments published by admin
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

    // ── Phase 2 for admin: fetch ALL teachers' classes ────────────────
    if (role === 'admin') {
      const teachers = await getTeachers()
      if (teachers.length > 0) {
        const teacherPks = teachers.map(t => { try { return nip19.decode(t.npub).data } catch { return null } }).filter(Boolean)
        if (teacherPks.length > 0) {
          console.log('[nostrSync] admin phase-2: fetching classes for', teacherPks.length, 'teachers')
          const classEvents = await fetchEvents([{ kinds: [1], authors: teacherPks, '#t': [TAG.CLASSES] }], 12000)
          console.log('[nostrSync] admin phase-2 got', classEvents.length, 'class events')
          // Dedupe class events per teacher
          const latestClass = {}
          for (const ev of classEvents) {
            const key = ev.pubkey
            if (!latestClass[key] || ev.created_at > latestClass[key].created_at) latestClass[key] = ev
          }
          for (const ev of Object.values(latestClass)) await handleEvent(ev, () => {})
        }
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
export async function startSync(userNsec, userPk, adminPk, role, onUpdate) {
  if (_sub) { try { _sub.close() } catch {} }
  _userNsec = userNsec; _userPk = userPk; _adminPk = adminPk

  const filters = [
    { kinds: [1], authors: [adminPk], '#t': [TAG.SCHOOL, TAG.TEACHERS] },
    { kinds: [0], authors: [adminPk], limit: 1 },
  ]
  if (role === 'admin')   filters.push({ kinds: [1], authors: [adminPk], '#t': [TAG.PAYMENTS] })
  if (role === 'teacher') filters.push({ kinds: [1], authors: [userPk],  '#t': [TAG.CLASSES]  })

  // ── For admin: also subscribe to ALL teachers' class events ─────────
  if (role === 'admin') {
    try {
      const teachers    = await getTeachers()
      const teacherPks  = teachers.map(t => { try { return nip19.decode(t.npub).data } catch { return null } }).filter(Boolean)
      if (teacherPks.length > 0) {
        filters.push({ kinds: [1], authors: teacherPks, '#t': [TAG.CLASSES] })
        console.log('[nostrSync] startSync admin: watching classes for', teacherPks.length, 'teachers')
      }
    } catch (e) {
      console.warn('[nostrSync] startSync admin teacher-classes filter failed:', e)
    }
  }

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

