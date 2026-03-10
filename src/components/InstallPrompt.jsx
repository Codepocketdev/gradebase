import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [prompt, setPrompt]   = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Already installed — never show
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (window.navigator.standalone) return

    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    setPrompt(null)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 12, right: 12,
      background: 'var(--surface)',
      border: '1px solid var(--accent)',
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 9999,
      animation: 'slideUp 0.3s ease',
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: 'rgba(79,255,176,0.1)',
        display: 'grid', placeItems: 'center',
      }}>
        <img src="/icon-192.png" width={28} height={28} style={{ borderRadius: 6 }} alt="GradeBase" />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
          Install GradeBase
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          Add to home screen for the best experience
        </div>
      </div>

      {/* Install button */}
      <button onClick={handleInstall} style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '8px 14px',
        background: 'var(--accent)',
        border: 'none', borderRadius: 10,
        color: '#0d0f14',
        fontSize: 12, fontWeight: 800,
        cursor: 'pointer',
        fontFamily: 'var(--font-display)',
        flexShrink: 0,
      }}>
        <Download size={13} /> Install
      </button>

      {/* Dismiss */}
      <button onClick={handleDismiss} style={{
        background: 'none', border: 'none',
        color: 'var(--muted)', cursor: 'pointer',
        padding: 4, display: 'grid', placeItems: 'center',
        flexShrink: 0,
      }}>
        <X size={16} />
      </button>
    </div>
  )
}

