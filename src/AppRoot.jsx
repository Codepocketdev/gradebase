import { useState, useEffect, useCallback } from 'react'
import Splash from './pages/Splash'
import Auth from './pages/Auth'
import App from './App'
import {
  getSchool, saveSchool, detectRole,
  replaceAllTeachers, replaceAllClasses, replaceAllPayments,
} from './db'
import { startSync, stopSync, publishSchool } from './nostrSync'
import { useTheme } from './hooks/useTheme'

export default function AppRoot() {
  useTheme()  // apply data-theme to <html> from first render
  const [phase, setPhase]             = useState('splash') // splash | auth | app
  const [user, setUser]               = useState(null)
  const [syncState, setSyncState]     = useState('idle')   // idle | syncing | synced | error
  const [dataVersion, setDataVersion] = useState(0)
  const [splashTarget, setSplashTarget] = useState('auth')        // bumps on every live update → App re-renders

  // ── On mount: check persisted session, always show splash 4s ──────
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('gb_auth')
      let validSession = false

      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (parsed?.nsec && parsed?.npub && parsed?.role) {
            // Re-check role in DB
            let role = await detectRole(parsed.npub)

            // Admin can always recover — their nsec IS the school identity
            // Even if DB was wiped, we trust the nsec and re-fetch from Nostr
            if (!role && parsed.role === 'admin') role = 'admin'

            if (role) {
              setUser({ ...parsed, role })
              validSession = true
            }
          }
        } catch {}
      }

      // Splash calls onDone() when its animation finishes (~5s)
      // We store the target phase so onDone knows where to go
      setSplashTarget(validSession ? 'app' : 'auth')
    }

    init()
  }, [])

  // ── Start Nostr sync when entering app ────────────────────────────
  useEffect(() => {
    if (!user || phase !== 'app') return

    const boot = async () => {
      setSyncState('syncing')

      try {
        // Resolve the admin pubkey — needed to know whose events to subscribe to
        let adminPk = null

        if (user.role === 'admin') {
          adminPk = user.pk
        } else {
          // Teachers and students read admin pubkey from DB
          const school = await getSchool()
          adminPk = school?.adminNpub || null
        }

        if (!adminPk) {
          console.warn('[AppRoot] No admin pubkey — cannot start sync')
          setSyncState('error')
          return
        }

        // Open the persistent WebSocket subscription
        // onUpdate fires on every incoming event (school | teachers | classes | payments | ready)
        startSync(user.nsec, user.pk, adminPk, user.role, async (type) => {
          console.log('[AppRoot] onUpdate:', type)
          setDataVersion(v => v + 1)
          setSyncState('synced')
        })

        setSyncState('synced')
      } catch (err) {
        console.warn('[AppRoot] Boot error:', err)
        setSyncState('error')
      }
    }

    boot()

    // Close WebSocket cleanly on unmount / logout
    return () => stopSync()
  }, [user, phase])

  // ── Auth complete: save session, enter app ─────────────────────────
  const handleAuth = useCallback((userData) => {
    localStorage.setItem('gb_auth', JSON.stringify(userData))
    setUser(userData)
    setPhase('app')
  }, [])

  // ── Logout: close socket, clear session ───────────────────────────
  const handleLogout = useCallback(() => {
    stopSync()
    localStorage.removeItem('gb_auth')
    setUser(null)
    setSyncState('idle')
    setDataVersion(0)
    setPhase('auth')
  }, [])

  // ── Render ─────────────────────────────────────────────────────────
  if (phase === 'splash') return <Splash onDone={() => setPhase(splashTarget)} />
  if (phase === 'auth')   return <Auth onAuth={handleAuth} />

  return (
    <App
      user={user}
      syncState={syncState}
      dataVersion={dataVersion}
      onLogout={handleLogout}
    />
  )
}

