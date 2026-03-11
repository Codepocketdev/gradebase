import { useState, useEffect, useCallback } from 'react'
import Splash from './pages/Splash'
import Auth from './pages/Auth'
import App from './App'
import {
  getSchool, saveSchool, detectRole,
  getTeachers, getClasses,
  replaceAllTeachers, replaceAllClasses, replaceAllPayments,
} from './db'
import {
  startSync, stopSync, fetchAndSeed,
  fetchAndSeedAttendance, fetchAndSeedPayments,
  setEncryptionContext,
} from './nostrSync'
import { useTheme } from './hooks/useTheme'
import InstallPrompt from './components/InstallPrompt'

// ── Restoring screen shown while we re-seed from Nostr ────────────────
function RestoringScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, fontFamily: 'var(--font-display)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'rgba(79,255,176,0.1)', border: '2px solid rgba(79,255,176,0.3)',
        display: 'grid', placeItems: 'center',
      }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--accent)', animation: 'spin 0.9s linear infinite' }} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Restoring your data…</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fetching from Nostr</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Resolve adminNpub for any role ────────────────────────────────────
async function resolveAdminNpub(role, pk, meta) {
  if (role === 'admin') {
    const { nip19 } = await import('nostr-tools')
    return nip19.npubEncode(pk)
  }
  return meta.adminNpub || null
}

// ── Arm encryption: derive key from adminNpub ────────────────────
function armEncryption(adminNpub) {
  if (!adminNpub) return
  setEncryptionContext(adminNpub)
  console.log('[AppRoot] encryption armed')
}

export default function AppRoot() {
  useTheme()
  const [phase, setPhase]             = useState('splash')
  const [user, setUser]               = useState(null)
  const [syncState, setSyncState]     = useState('idle')
  const [dataVersion, setDataVersion] = useState(0)
  const [splashDone, setSplashDone]   = useState(false)
  const [initTarget, setInitTarget]   = useState(null)
  const [restoring, setRestoring]     = useState(false)

  // ── On mount: check persisted session ─────────────────────────────
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('gb_auth')
      let target = 'auth'

      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.nsec && parsed?.npub && parsed?.role) {

            let role = await detectRole(parsed.npub)

            const meta = (() => {
              try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
            })()

            // ── Arm encryption before any fetch ───────────────────────
            const adminNpub = await resolveAdminNpub(parsed.role, parsed.pk, meta)
            await armEncryption(adminNpub)

            // ── DB is cold — BLOCK on reseed so data is ready ─────────
            if (!role && parsed.role) {
              role = parsed.role
              setRestoring(true)
              try {
                const result = await fetchAndSeed({
                  role:        parsed.role,
                  userNsec:    parsed.nsec,
                  userPk:      parsed.pk,
                  adminNpub:   meta.adminNpub   || undefined,
                  teacherNpub: meta.teacherNpub || undefined,
                })
                console.log('[AppRoot] cold reseed result:', result)
              } catch (e) {
                console.warn('[AppRoot] cold reseed failed:', e)
              }
              try {
                const adminNpubForPayments = parsed.role === 'admin'
                  ? (await import('nostr-tools')).nip19.npubEncode(parsed.pk)
                  : meta.adminNpub || undefined
                if (adminNpubForPayments) await fetchAndSeedPayments(adminNpubForPayments)
              } catch (e) {
                console.warn('[AppRoot] cold payment seed failed:', e)
              }
              setRestoring(false)
            }

            if (role) {
              const school = await getSchool()
              setUser({ ...parsed, role, avatar: school?.avatar || '' })
              target = 'app'
            }
          }
        } catch {}
      }

      setInitTarget(target)
    }

    init()
  }, [])

  // ── Transition when splash + init both done ────────────────────────
  useEffect(() => {
    if (splashDone && initTarget) setPhase(initTarget)
  }, [splashDone, initTarget])

  // ── Start Nostr sync when entering app ────────────────────────────
  useEffect(() => {
    if (!user || phase !== 'app') return

    const boot = async () => {
      setSyncState('syncing')

      try {
        let adminPk = null

        const meta = (() => {
          try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
        })()

        if (user.role === 'admin') {
          adminPk = user.pk
        } else {
          const school = await getSchool()
          if (school?.adminNpub) {
            const { nip19 } = await import('nostr-tools')
            try { adminPk = nip19.decode(school.adminNpub).data } catch {}
          }
        }

        if (!adminPk) {
          console.warn('[AppRoot] No admin pubkey — cannot start sync')
          setSyncState('error')
          return
        }

        // ── Arm encryption before boot reseed ─────────────────────────
        const adminNpub = await resolveAdminNpub(user.role, user.pk, meta)
        await armEncryption(adminNpub)

        const bootReseed = async () => {
          if (user.role === 'admin') {
            const result = await fetchAndSeed({
              role:     'admin',
              userNsec: user.nsec,
              userPk:   user.pk,
            }).catch(() => ({ found: false }))
            if (result?.found) {
              console.log('[AppRoot] admin boot resync done')
              setDataVersion(v => v + 1)
            }
            try {
              const { nip19 } = await import('nostr-tools')
              const teachers   = await getTeachers()
              const teacherPks = teachers
                .map(t => { try { return nip19.decode(t.npub).data } catch { return null } })
                .filter(Boolean)
              if (teacherPks.length) {
                await fetchAndSeedAttendance(teacherPks)
                setDataVersion(v => v + 1)
              }
            } catch {}
            try {
              const { nip19 } = await import('nostr-tools')
              const adminNpub = nip19.npubEncode(user.pk)
              await fetchAndSeedPayments(adminNpub)
              setDataVersion(v => v + 1)
            } catch {}
          }

          if (user.role === 'teacher') {
            const result = await fetchAndSeed({
              role:      'teacher',
              userNsec:  user.nsec,
              userPk:    user.pk,
              adminNpub: meta.adminNpub || undefined,
            }).catch(() => ({ found: false }))
            // Always get adminNpub fresh from db after fetchAndSeed
            const teacherSchool = await getSchool().catch(() => null)
            const teacherAdminNpub = teacherSchool?.adminNpub || meta.adminNpub || null
            if (teacherAdminNpub) {
              // Re-arm encryption with confirmed adminNpub from db
              armEncryption(teacherAdminNpub)
              // Save to meta so future boots are instant
              const m = (() => { try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} } })()
              m.adminNpub = teacherAdminNpub
              localStorage.setItem('gb_sync_meta', JSON.stringify(m))
            }
            if (result?.found) {
              console.log('[AppRoot] teacher boot resync done')
              setDataVersion(v => v + 1)
            }
            await fetchAndSeedAttendance([user.pk])
            setDataVersion(v => v + 1)
            if (teacherAdminNpub) {
              await fetchAndSeedPayments(teacherAdminNpub)
              setDataVersion(v => v + 1)
            }
          }

          if (user.role === 'student') {
            if (meta.teacherNpub) {
              const result = await fetchAndSeed({
                role:        'student',
                userNsec:    user.nsec,
                userPk:      user.pk,
                teacherNpub: meta.teacherNpub,
              }).catch(() => ({ found: false }))
              if (result?.found) {
                console.log('[AppRoot] student boot resync done')
                setDataVersion(v => v + 1)
                // Re-arm encryption now that school (with adminNpub) is in db
                try {
                  const school = await getSchool()
                  if (school?.adminNpub) {
                    await armEncryption(school.adminNpub)
                    const m = (() => { try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} } })()
                    m.adminNpub = school.adminNpub
                    localStorage.setItem('gb_sync_meta', JSON.stringify(m))
                  }
                } catch {}
              }
            }
            try {
              const { nip19 } = await import('nostr-tools')
              const classes    = await getClasses()
              const myClass    = classes.find(c => c.students?.some(s => s.npub === user.npub))
              const tNpub      = myClass?.teacherNpub || meta.teacherNpub
              if (tNpub) {
                const teacherPk = nip19.decode(tNpub).data
                await fetchAndSeedAttendance([teacherPk])
                setDataVersion(v => v + 1)
              }
            } catch {}
            try {
              const school = await getSchool()
              if (school?.adminNpub) {
                await fetchAndSeedPayments(school.adminNpub)
                setDataVersion(v => v + 1)
              } else if (meta.adminNpub) {
                await fetchAndSeedPayments(meta.adminNpub)
                setDataVersion(v => v + 1)
              }
            } catch {}
          }
        }

        if (user.role === 'student' || user.role === 'teacher') {
          await bootReseed().catch(console.warn)
          try {
            const school = await getSchool()
            if (school?.adminNpub) {
              const { nip19 } = await import('nostr-tools')
              adminPk = nip19.decode(school.adminNpub).data
            }
          } catch {}
        } else {
          bootReseed().catch(console.warn)
        }

        await startSync(user.nsec, user.pk, adminPk, user.role, async (type) => {
          console.log('[AppRoot] onUpdate:', type)
          setDataVersion(v => v + 1)
          setSyncState('synced')
          if (type === 'school') {
            const { getSchool } = await import('./db')
            const school = await getSchool()
            if (school) {
              setUser(u => ({
                ...u,
                name:   u.role === 'admin' ? (school.adminName || u.name) : u.name,
                avatar: school.avatar || u.avatar || '',
              }))
            }
          }
        })

        setSyncState('synced')
      } catch (err) {
        console.warn('[AppRoot] Boot error:', err)
        setSyncState('error')
      }
    }

    boot()
    return () => stopSync()
  }, [user, phase])

  // ── Re-sync when tab becomes visible ──────────────────────────────
  useEffect(() => {
    if (!user || phase !== 'app') return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && user.role === 'teacher') {
        const meta = (() => {
          try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
        })()
        fetchAndSeed({
          role:      'teacher',
          userNsec:  user.nsec,
          userPk:    user.pk,
          adminNpub: meta.adminNpub || undefined,
        }).then(result => {
          if (result?.found) setDataVersion(v => v + 1)
        }).catch(console.warn)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, phase])

  // ── Auth complete ──────────────────────────────────────────────────
  const handleAuth = useCallback(async (userData) => {
    localStorage.setItem('gb_auth', JSON.stringify(userData))

    const meta = (() => {
      try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
    })()
    if (userData.adminNpub)   meta.adminNpub   = userData.adminNpub
    if (userData.teacherNpub) meta.teacherNpub = userData.teacherNpub
    localStorage.setItem('gb_sync_meta', JSON.stringify(meta))

    // ── Arm encryption on fresh login ─────────────────────────────
    const adminNpub = await resolveAdminNpub(userData.role, userData.pk, meta)
    armEncryption(adminNpub)

    setUser(userData)
    setPhase('app')
  }, [])

  const handleUpdateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('gb_auth', JSON.stringify(updatedUser))
  }, [])

  const handleLogout = useCallback(() => {
    stopSync()
    setEncryptionContext(null, null)  // clear encryption context on logout
    localStorage.removeItem('gb_auth')
    localStorage.removeItem('gb_sync_meta')
    setUser(null)
    setSyncState('idle')
    setDataVersion(0)
    setPhase('auth')
  }, [])

  // ── Render ─────────────────────────────────────────────────────────
  if (restoring)          return <RestoringScreen />
  if (phase === 'splash') return <Splash onDone={() => setSplashDone(true)} />
  if (phase === 'auth')   return <Auth onAuth={handleAuth} />

  return (
    <>
      <App
        user={user}
        syncState={syncState}
        dataVersion={dataVersion}
        onLogout={handleLogout}
        onUpdateUser={handleUpdateUser}
      />
      <InstallPrompt />
    </>
  )
}

