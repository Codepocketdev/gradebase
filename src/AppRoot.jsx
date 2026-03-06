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

export default function AppRoot() {
  useTheme()
  const [phase, setPhase]             = useState('splash')
  const [user, setUser]               = useState(null)
  const [syncState, setSyncState]     = useState('idle')
  const [dataVersion, setDataVersion] = useState(0)
  const [splashDone, setSplashDone]   = useState(false)
  const [initTarget, setInitTarget]   = useState(null)

  // ── On mount: check persisted session ─────────────────────────────
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('gb_auth')
      let target = 'auth'

      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.nsec && parsed?.npub && parsed?.role) {

            // Check IndexedDB first
            let role = await detectRole(parsed.npub)

            // ── DB is cold (new port / fresh device) ──────────────────
            // Trust the stored role and warm up DB from Nostr in background
            if (!role && parsed.role) {
              role = parsed.role

              // Kick off background re-seed so DB gets populated
              // Teachers need adminNpub, students need teacherNpub — stored in gb_sync_meta
              const meta = (() => {
                try { return JSON.parse(localStorage.getItem('gb_sync_meta') || '{}') } catch { return {} }
              })()

              fetchAndSeed({
                role:        parsed.role,
                userNsec:    parsed.nsec,
                userPk:      parsed.pk,
                adminNpub:   meta.adminNpub   || undefined,
                teacherNpub: meta.teacherNpub || undefined,
              }).catch(console.warn)
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

  // ── When BOTH init and splash are done, transition ─────────────────
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
          // Try DB first, fall back to localStorage cache
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

        startSync(user.nsec, user.pk, adminPk, user.role, async (type) => {
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

  // ── Auth complete: save session + sync meta ────────────────────────
  const handleAuth = useCallback((userData) => {
    localStorage.setItem('gb_auth', JSON.stringify(userData))

    // Store adminNpub / teacherNpub so warm-up works on new devices
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

