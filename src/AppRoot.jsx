import { useState, useEffect, useCallback } from 'react'
import Splash from './pages/Splash'
import Auth from './pages/Auth'
import App from './App'
import {
  getSchool, saveSchool, detectRole,
  replaceAllTeachers, replaceAllClasses, replaceAllPayments,
} from './db'
import { startSync, stopSync, fetchAndSeed } from './nostrSync'
import { useTheme } from './hooks/useTheme'

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
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fetching classes from Nostr</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function AppRoot() {
  useTheme()
  const [phase, setPhase]             = useState('splash')
  const [user, setUser]               = useState(null)
  const [syncState, setSyncState]     = useState('idle')
  const [dataVersion, setDataVersion] = useState(0)
  const [splashDone, setSplashDone]   = useState(false)
  const [initTarget, setInitTarget]   = useState(null)
  const [restoring, setRestoring]     = useState(false)   // ← blocks UI during reseed

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

            // ── DB is cold — BLOCK on reseed so classes are ready ─────
            if (!role && parsed.role) {
              role = parsed.role
              const meta = (() => {
                try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
              })()

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

        // ── For teacher: always re-fetch own classes on every boot ───
        // This ensures classes are never lost even on fresh device/cache clear
        if (user.role === 'teacher') {
          const meta = (() => {
            try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
          })()
          fetchAndSeed({
            role:      'teacher',
            userNsec:  user.nsec,
            userPk:    user.pk,
            adminNpub: meta.adminNpub || undefined,
          }).then(result => {
            if (result?.found) {
              console.log('[AppRoot] teacher boot resync done — bumping dataVersion')
              setDataVersion(v => v + 1)
            }
          }).catch(console.warn)
        }

        // ── For admin: re-fetch all teacher classes on every boot ────
        if (user.role === 'admin') {
          fetchAndSeed({
            role:     'admin',
            userNsec: user.nsec,
            userPk:   user.pk,
          }).then(result => {
            if (result?.found) {
              console.log('[AppRoot] admin boot resync done — bumping dataVersion')
              setDataVersion(v => v + 1)
            }
          }).catch(console.warn)
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

  // ── Re-sync when tab becomes visible (phone wakeup / tab switch) ──
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
  const handleAuth = useCallback((userData) => {
    localStorage.setItem('gb_auth', JSON.stringify(userData))

    const meta = (() => {
      try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
    })()
    if (userData.adminNpub)   meta.adminNpub   = userData.adminNpub
    if (userData.teacherNpub) meta.teacherNpub = userData.teacherNpub
    localStorage.setItem('gb_sync_meta', JSON.stringify(meta))

    setUser(userData)
    setPhase('app')
  }, [])

  const handleUpdateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
    localStorage.setItem('gb_auth', JSON.stringify(updatedUser))
  }, [])

  const handleLogout = useCallback(() => {
    stopSync()
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
    <App
      user={user}
      syncState={syncState}
      dataVersion={dataVersion}
      onLogout={handleLogout}
      onUpdateUser={handleUpdateUser}
    />
  )
}

