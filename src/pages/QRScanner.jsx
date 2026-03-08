// GradeBase QR Scanner — adapted from Bitsavers TicketScanner
// Uses qr-scanner npm package (much more reliable than jsQR)
import { useRef, useState, useEffect } from 'react'
import QrScanner from 'qr-scanner'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'

export default function QRScanner({ onScan, onClose }) {
  const videoRef   = useRef(null)
  const scannerRef = useRef(null)
  const [error, setError]         = useState('')
  const [scanning, setScanning]   = useState(false)
  const [cameras, setCameras]     = useState([])
  const [facingMode, setFacingMode] = useState('environment')

  useEffect(() => {
    let isActive = true

    const cleanup = () => {
      isActive = false
      if (scannerRef.current) {
        scannerRef.current.stop()
        scannerRef.current.destroy()
        scannerRef.current = null
      }
    }

    const initScanner = async () => {
      try {
        const hasCamera = await QrScanner.hasCamera()
        if (!hasCamera) { setError('No camera found on this device.'); return }
        if (!videoRef.current || !isActive) return

        scannerRef.current = new QrScanner(
          videoRef.current,
          (result) => {
            if (!isActive || !result?.data) return
            const data = result.data.trim()
            // Only accept npub QR codes
            if (!data.startsWith('npub1')) {
              setError('Not a valid student QR code — scan the npub QR from the student profile')
              setTimeout(() => setError(''), 3000)
              return
            }
            cleanup()
            onScan(data)
          },
          {
            returnDetailedScanResult: true,
            highlightScanRegion:      false,
            highlightCodeOutline:     false,
          }
        )

        await scannerRef.current.start()
        setScanning(true)

        const cameraList = await QrScanner.listCameras(true)
        setCameras(cameraList)
        if (cameraList.length > 1) await scannerRef.current.setCamera(facingMode)

      } catch (err) {
        if (!isActive) return
        if (err.name === 'NotAllowedError')   setError('Camera permission denied. Please allow camera access.')
        else if (err.name === 'NotFoundError') setError('No camera found on this device.')
        else if (err.name === 'NotReadableError') setError('Camera is busy — close other apps using the camera.')
        else setError(`Camera error: ${err.message}`)
      }
    }

    initScanner()
    return cleanup
  }, [facingMode])

  const toggleCamera = async () => {
    if (!scannerRef.current || cameras.length <= 1) return
    const next = facingMode === 'environment' ? 'user' : 'environment'
    try { await scannerRef.current.setCamera(next); setFacingMode(next) } catch {}
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.9)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>Scan Student QR</div>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', color: '#fff', display: 'grid', placeItems: 'center' }}>
          <X size={18} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ margin: 16, padding: 16, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, color: '#ef4444', lineHeight: 1.5, flexShrink: 0 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> {error}
          </div>
        </div>
      )}

      {/* Camera view */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
        <video ref={videoRef}
          style={{ width: '100%', maxWidth: 500, borderRadius: 16, display: error && !scanning ? 'none' : 'block', objectFit: 'cover' }}
          playsInline muted />

        {scanning && (
          <>
            {/* Scan frame */}
            <div style={{
              position: 'absolute', width: 260, height: 260,
              border: '2px solid #00c97a', borderRadius: 16,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              pointerEvents: 'none',
            }}>
              {/* Corner brackets */}
              {[['top',0,'left',0],['top',0,'right',0],['bottom',0,'left',0],['bottom',0,'right',0]].map(([v,vv,h,hh], i) => (
                <div key={i} style={{
                  position: 'absolute', [v]: vv, [h]: hh, width: 36, height: 36,
                  borderTop:    v === 'top'    ? '3px solid #00c97a' : 'none',
                  borderBottom: v === 'bottom' ? '3px solid #00c97a' : 'none',
                  borderLeft:   h === 'left'   ? '3px solid #00c97a' : 'none',
                  borderRight:  h === 'right'  ? '3px solid #00c97a' : 'none',
                }} />
              ))}
              {/* Scan line */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#00c97a,transparent)', animation: 'scanline 2s linear infinite' }} />
            </div>

            {/* Toggle camera button */}
            {cameras.length > 1 && (
              <button onClick={toggleCamera} style={{ position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: '50%', background: 'rgba(0,201,122,0.2)', border: '1px solid rgba(0,201,122,0.4)', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#00c97a' }}>
                <RefreshCw size={18} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Hint text */}
      <div style={{ padding: '8px 20px 0', flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
          Point camera at student's QR code from their profile — marks Present automatically
        </div>
      </div>

      {/* Cancel button — padded above bottom nav */}
      <div style={{
        padding: '12px 20px',
        paddingBottom: 'max(80px, calc(64px + env(safe-area-inset-bottom, 16px)))',
        background: '#000',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ width: '100%', padding: '15px', background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>

      <style>{`@keyframes scanline{0%{transform:translateY(0)}100%{transform:translateY(260px)}}`}</style>
    </div>
  )
}

