import { useState, useEffect } from 'react'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import {
  Plus, Users, ChevronRight, Search, School, X,
  UserPlus, ArrowLeft, Loader, Printer, Download
} from 'lucide-react'
import { replaceAllClasses, getSchool } from '../db'
import { syncSaveClass } from '../nostrSync'
import { useTeacherClasses } from '../hooks/useTeacherClasses'
import StudentModal from './StudentModal'

const GRAD = [
  'linear-gradient(135deg,#00c97a,#00a862)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#a855f7,#7c3aed)',
  'linear-gradient(135deg,#f97316,#ea580c)',
  'linear-gradient(135deg,#ef4444,#dc2626)',
  'linear-gradient(135deg,#14b8a6,#0d9488)',
  'linear-gradient(135deg,#fbbf24,#f59e0b)',
  'linear-gradient(135deg,#ec4899,#db2777)',
]

const CARD_COLORS = [
  // GradeBase & greens
  { hex: '#00c97a', label: 'GradeBase'   },
  { hex: '#2ecc71', label: 'Forest'      },
  { hex: '#1a6b4a', label: 'Pine'        },
  { hex: '#84cc16', label: 'Lime'        },
  { hex: '#a3e635', label: 'Yellow-Green'},
  // Blues & teals
  { hex: '#00b4d8', label: 'Ocean'       },
  { hex: '#06b6d4', label: 'Cyan'        },
  { hex: '#2dd4bf', label: 'Aqua'        },
  { hex: '#14b8a6', label: 'Teal'        },
  { hex: '#1e6bb5', label: 'Cobalt'      },
  { hex: '#3b82f6', label: 'Blue'        },
  { hex: '#00a8e8', label: 'Sky Blue'    },
  // Purples & violets
  { hex: '#7c3aed', label: 'Violet'      },
  { hex: '#6366f1', label: 'Indigo'      },
  { hex: '#818cf8', label: 'Periwinkle'  },
  { hex: '#9b59b6', label: 'Nostr'       },
  { hex: '#a855f7', label: 'Purple'      },
  { hex: '#e879f9', label: 'Fuchsia'     },
  // Reds & pinks
  { hex: '#e94560', label: 'Midnight'    },
  { hex: '#ef4444', label: 'Red'         },
  { hex: '#f43f5e', label: 'Rose'        },
  { hex: '#e91e8c', label: 'Magenta'     },
  { hex: '#e06090', label: 'Blush'       },
  { hex: '#ec4899', label: 'Pink'        },
  // Oranges, yellows & browns
  { hex: '#f7931a', label: 'Bitcoin'     },
  { hex: '#f97316', label: 'Orange'      },
  { hex: '#fb923c', label: 'Amber'       },
  { hex: '#f59e0b', label: 'Yellow'      },
  { hex: '#eab308', label: 'Gold'        },
  { hex: '#a0714a', label: 'Mocha'       },
  // Neutrals
  { hex: '#9e9e9e', label: 'Slate'       },
  { hex: '#94a3b8', label: 'Cool Grey'   },
]

// ── The actual printable student card ────────────────────────────
function StudentCard({ student, schoolName, color, dark, single = false }) {
  const qrBg    = dark ? 'ffffff' : 'fafafa'
  const qrColor = dark ? '000000' : '0d1117'
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(student.npub)}&bgcolor=${qrBg}&color=${qrColor}&margin=4`

  const bg      = dark ? '#0d1117' : '#ffffff'
  const textPri = dark ? '#ffffff' : '#0d1117'
  const textMut = dark ? 'rgba(255,255,255,0.35)' : '#999999'
  const border  = dark ? 'rgba(255,255,255,0.07)' : '#f0f0f0'
  const footBg  = dark ? 'rgba(255,255,255,0.03)' : '#fafafa'
  const qrBgCSS = dark ? '#1a1a2e' : '#f8f8f8'
  const qrBord  = dark ? 'rgba(255,255,255,0.1)' : '#e8e8e8'

  return (
    <div className="student-card" style={{
      width: 400,
      height: 580,
      borderRadius: 40,
      background: bg,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      // Full color border going all the way round
      outline: `5px solid ${color}`,
      outlineOffset: '-5px',
      boxShadow: single ? 'none' : `0 24px 60px rgba(0,0,0,0.18), 0 0 0 5px ${color}`,
      flexShrink: 0,
    }}>

      {/* Colored corner glow top-left and bottom-right */}
      <div style={{
        position: 'absolute', top: -60, left: -60,
        width: 160, height: 160,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}30 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, right: -60,
        width: 160, height: 160,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        padding: '26px 32px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
            <path d="M24 6L6 16V32L24 42L42 32V16L24 6Z" stroke={color} strokeWidth="2.5" fill="none"/>
            <path d="M24 6L24 42M6 16L42 32M42 16L6 32" stroke={color} strokeWidth="1" opacity="0.4"/>
            <circle cx="24" cy="24" r="6" fill={color} opacity="0.9"/>
          </svg>
          <span style={{
            fontFamily: "'Syne','Plus Jakarta Sans',sans-serif",
            fontSize: 17, fontWeight: 800, color: textPri, letterSpacing: 0.2,
          }}>GradeBase</span>
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 9,
          letterSpacing: 2, color: textMut,
          textTransform: 'uppercase', textAlign: 'right', lineHeight: 1.8,
        }}>
          Student ID<br/>2025 – 2026
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '20px 32px 24px',
      }}>
        {/* QR */}
        <div style={{
          width: 210, height: 210, borderRadius: 24,
          border: `2px solid ${qrBord}`, background: qrBgCSS,
          padding: 14, marginBottom: 30, position: 'relative',
        }}>
          <img
            src={qrUrl}
            alt="QR"
            style={{ width: '100%', height: '100%', borderRadius: 12, display: 'block' }}
          />
          <div style={{
            position: 'absolute', bottom: -14, left: '50%',
            transform: 'translateX(-50%)',
            padding: '5px 18px', borderRadius: 20,
            background: color,
            color: dark ? '#0d1117' : '#fff',
            fontFamily: 'monospace', fontSize: 8,
            letterSpacing: 2, whiteSpace: 'nowrap',
            fontWeight: 600,
          }}>
            SCAN TO VERIFY
          </div>
        </div>

        {/* Name */}
        <div style={{
          fontFamily: "'Syne','Plus Jakarta Sans',sans-serif",
          fontSize: 26, fontWeight: 800, color: textPri,
          textAlign: 'center', letterSpacing: 0.2, marginBottom: 10,
        }}>
          {student.name}
        </div>

        {/* Class pill */}
        <div style={{
          padding: '6px 20px', borderRadius: 20,
          background: `${color}20`,
          border: `1.5px solid ${color}55`,
          fontFamily: 'monospace', fontSize: 11,
          letterSpacing: 1, color: color, fontWeight: 600,
        }}>
          {student.className}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 32px 22px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
        background: footBg, borderTop: `1px solid ${border}`,
      }}>
        <div style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          fontSize: 11, fontWeight: 700, color: textMut,
        }}>
          {schoolName || 'GradeBase School'}
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 8,
          color: textMut, textAlign: 'right', lineHeight: 1.8,
        }}>
          {student.npub?.slice(0, 16)}<br/>…{student.npub?.slice(-8)}
        </div>
      </div>
    </div>
  )
}

// ── Pure canvas card generator (same approach as Bitsavers ticketGenerator) ──
async function generateStudentCard({ student, schoolName, color, dark }) {
  const S   = 2          // retina scale
  const W   = 400 * S    // 800px
  const H   = 580 * S    // 1160px
  const px  = v => v * S
  const R   = px(40)     // corner radius

  // Load QR image
  const qrBg    = dark ? 'ffffff' : 'fafafa'
  const qrColor = dark ? '000000' : '0d1117'
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(student.npub)}&bgcolor=${qrBg}&color=${qrColor}&margin=4`
  const qrImg   = new Image()
  qrImg.crossOrigin = 'anonymous'
  qrImg.src = qrUrl
  await new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; setTimeout(rej, 6000) })

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const bg      = dark ? '#0d1117' : '#ffffff'
  const textPri = dark ? '#ffffff' : '#0d1117'
  const textMut = dark ? 'rgba(255,255,255,0.35)' : '#aaaaaa'
  const divider = dark ? 'rgba(255,255,255,0.07)' : '#f0f0f0'
  const footBg  = dark ? 'rgba(255,255,255,0.03)' : '#f8f8f8'
  const qrBoxBg = dark ? '#1a1a2e' : '#f8f8f8'
  const qrBoxBd = dark ? 'rgba(255,255,255,0.12)' : '#e0e0e0'

  // ── Outer colored border (the full round border) ──────────────────
  const border = px(6)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(0, 0, W, H, R + border)
  ctx.fill()

  // Corner glow top-left
  const glowTL = ctx.createRadialGradient(px(60), px(60), 0, px(60), px(60), px(140))
  glowTL.addColorStop(0, color + '44')
  glowTL.addColorStop(1, 'transparent')
  ctx.fillStyle = glowTL
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, R + border); ctx.fill()

  // ── Inner card background ─────────────────────────────────────────
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(border, border, W - border * 2, H - border * 2, R)
  ctx.fill()

  // Corner glow bottom-right inside card
  const glowBR = ctx.createRadialGradient(W - px(60), H - px(60), 0, W - px(60), H - px(60), px(120))
  glowBR.addColorStop(0, color + '18')
  glowBR.addColorStop(1, 'transparent')
  ctx.fillStyle = glowBR
  ctx.beginPath(); ctx.roundRect(border, border, W - border * 2, H - border * 2, R); ctx.fill()

  // ── HEADER ────────────────────────────────────────────────────────
  const headerH = px(80)
  const hPad    = px(32)

  // Header divider line
  ctx.strokeStyle = divider; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.moveTo(border, border + headerH); ctx.lineTo(W - border, border + headerH); ctx.stroke()

  // GradeBase logo hexagon
  const logoX = border + hPad
  const logoY = border + px(27)
  const lS    = px(13) // scale for the 48-viewbox svg paths

  // Draw hexagon manually from SVG path scaled
  const scale = lS / 24
  const ox = logoX, oy = logoY - lS

  // Outer hexagon
  ctx.strokeStyle = color; ctx.lineWidth = px(2.5)
  ctx.beginPath()
  ctx.moveTo(ox + 24*scale, oy + 6*scale)
  ctx.lineTo(ox + 6*scale,  oy + 16*scale)
  ctx.lineTo(ox + 6*scale,  oy + 32*scale)
  ctx.lineTo(ox + 24*scale, oy + 42*scale)
  ctx.lineTo(ox + 42*scale, oy + 32*scale)
  ctx.lineTo(ox + 42*scale, oy + 16*scale)
  ctx.closePath(); ctx.stroke()

  // Inner crossing lines (M24 6L24 42, M6 16L42 32, M42 16L6 32)
  ctx.strokeStyle = color; ctx.lineWidth = px(1); ctx.globalAlpha = 0.4
  ctx.beginPath(); ctx.moveTo(ox + 24*scale, oy + 6*scale);  ctx.lineTo(ox + 24*scale, oy + 42*scale); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(ox + 6*scale,  oy + 16*scale); ctx.lineTo(ox + 42*scale, oy + 32*scale); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(ox + 42*scale, oy + 16*scale); ctx.lineTo(ox + 6*scale,  oy + 32*scale); ctx.stroke()
  ctx.globalAlpha = 1

  // Center dot
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(ox + 24*scale, oy + 24*scale, px(4.5), 0, Math.PI*2); ctx.fill()

  // GradeBase text
  ctx.fillStyle = textPri
  ctx.font = `800 ${px(17)}px Arial`
  ctx.fillText('GradeBase', logoX + px(30), border + px(44))

  // Student ID tag (right)
  ctx.fillStyle = textMut
  ctx.font = `${px(9)}px monospace`
  ctx.textAlign = 'right'
  ctx.fillText('STUDENT ID', W - border - hPad, border + px(36))
  ctx.fillText('2025 – 2026', W - border - hPad, border + px(36) + px(14))
  ctx.textAlign = 'left'

  // ── QR CODE ───────────────────────────────────────────────────────
  const qrSize   = px(190)
  const qrX      = (W - qrSize) / 2
  const qrY      = border + headerH + px(28)
  const qrRadius = px(20)

  // QR box background
  ctx.fillStyle = qrBoxBg
  ctx.beginPath(); ctx.roundRect(qrX - px(12), qrY - px(12), qrSize + px(24), qrSize + px(24), qrRadius); ctx.fill()
  ctx.strokeStyle = qrBoxBd; ctx.lineWidth = px(1.5)
  ctx.beginPath(); ctx.roundRect(qrX - px(12), qrY - px(12), qrSize + px(24), qrSize + px(24), qrRadius); ctx.stroke()

  // Clip & draw QR
  ctx.save()
  ctx.beginPath(); ctx.roundRect(qrX, qrY, qrSize, qrSize, px(10)); ctx.clip()
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
  ctx.restore()

  // SCAN TO VERIFY pill
  const pillText = 'SCAN TO VERIFY'
  ctx.font = `600 ${px(9)}px monospace`
  const pillW = ctx.measureText(pillText).width + px(28)
  const pillX = (W - pillW) / 2
  const pillY = qrY + qrSize + px(22)
  ctx.fillStyle = color
  ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, px(20), px(10)); ctx.fill()
  ctx.fillStyle = dark ? '#0d1117' : '#ffffff'
  ctx.textAlign = 'center'
  ctx.fillText(pillText, W / 2, pillY + px(13))
  ctx.textAlign = 'left'

  // ── STUDENT NAME ──────────────────────────────────────────────────
  const nameY = pillY + px(20) + px(36)
  ctx.fillStyle = textPri
  ctx.font      = `800 ${px(26)}px Arial`
  ctx.textAlign = 'center'
  ctx.fillText(student.name, W / 2, nameY)

  // ── CLASS PILL ────────────────────────────────────────────────────
  ctx.font = `600 ${px(11)}px monospace`
  const cpText = student.className || ''
  const cpW    = ctx.measureText(cpText).width + px(36)
  const cpX    = (W - cpW) / 2
  const cpY    = nameY + px(18)

  ctx.fillStyle = color + '22'
  ctx.beginPath(); ctx.roundRect(cpX, cpY, cpW, px(28), px(14)); ctx.fill()
  ctx.strokeStyle = color + '55'; ctx.lineWidth = px(1.5)
  ctx.beginPath(); ctx.roundRect(cpX, cpY, cpW, px(28), px(14)); ctx.stroke()
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.fillText(cpText, W / 2, cpY + px(18))
  ctx.textAlign = 'left'

  // ── FOOTER ────────────────────────────────────────────────────────
  const footH  = px(58)
  const footY  = H - border - footH

  ctx.fillStyle = footBg
  ctx.beginPath(); ctx.roundRect(border, footY, W - border * 2, footH, [0, 0, R, R]); ctx.fill()

  ctx.strokeStyle = divider; ctx.lineWidth = px(1)
  ctx.beginPath(); ctx.moveTo(border, footY); ctx.lineTo(W - border, footY); ctx.stroke()

  ctx.fillStyle = textMut
  ctx.font = `700 ${px(11)}px Arial`
  ctx.fillText(schoolName || 'GradeBase School', border + hPad, footY + px(34))

  ctx.font = `${px(8)}px monospace`
  ctx.textAlign = 'right'
  ctx.fillText(student.npub?.slice(0, 16) + '…', W - border - hPad, footY + px(26))
  ctx.fillText(student.npub?.slice(-16), W - border - hPad, footY + px(40))
  ctx.textAlign = 'left'

  return canvas
}

// ── Cards view ────────────────────────────────────────────────────
function CardsView({ selectedClass, schoolName, onBack }) {
  const [color, setColor]       = useState('#00c97a')
  const [dark, setDark]         = useState(false)
  const [downloading, setDL]    = useState(null) // studentId | 'all'
  const students                = selectedClass.students || []

  const downloadCard = async (student) => {
    setDL(student.id)
    try {
      const canvas = await generateStudentCard({ student, schoolName, color, dark })
      const link = document.createElement('a')
      link.download = `${student.name.replace(/\s+/g, '_')}_ID_Card.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Download failed', err)
    }
    setDL(null)
  }

  const downloadAll = async () => {
    setDL('all')
    for (const stu of students) {
      await downloadCard(stu)
    }
    setDL(null)
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={S.page}>
        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, padding: 0, flexShrink: 0 }}>
              <ArrowLeft size={15} /> Students
            </button>
            <span style={{ color: 'var(--muted)', flexShrink: 0 }}>/</span>
            <span style={{ ...S.title, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>ID Cards</span>
          </div>
          <button style={{ ...S.addBtn, flexShrink: 0 }} onClick={downloadAll} disabled={downloading === 'all'}>
            {downloading === 'all'
              ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Downloading…</>
              : <><Download size={15} /> Download All</>}
          </button>
        </div>

        {/* Controls */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Color picker */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>Accent Color</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {CARD_COLORS.map(({ hex, label }) => (
                <button key={hex} onClick={() => setColor(hex)} title={label} style={{
                  width: 30, height: 30, borderRadius: '50%', background: hex,
                  border: color === hex ? '3px solid var(--text)' : '3px solid transparent',
                  cursor: 'pointer', outline: 'none', transition: 'transform 0.15s',
                  transform: color === hex ? 'scale(1.15)' : 'scale(1)',
                }} />
              ))}
            </div>
          </div>

          {/* Dark/Light toggle */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Card Theme</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{dark ? 'Black card' : 'White card'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ label: 'White', val: false }, { label: 'Black', val: true }].map(({ label, val }) => (
                <button key={label} onClick={() => setDark(val)} style={{
                  padding: '7px 16px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                  border: dark === val ? 'none' : '1.5px solid var(--border)',
                  background: dark === val ? 'var(--accent)' : 'transparent',
                  color: dark === val ? '#0d1117' : 'var(--muted)',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Student cards preview */}
        <div style={{ padding: '0 20px 100px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {students.map(stu => (
            <div key={stu.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{stu.name}</div>
                <button onClick={() => downloadCard(stu)} disabled={!!downloading} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 10,
                  background: 'var(--surface)', border: '1.5px solid var(--border)',
                  color: 'var(--muted)', fontSize: 12, fontWeight: 700,
                  cursor: downloading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-display)', opacity: downloading === stu.id ? 0.6 : 1,
                }}>
                  {downloading === stu.id
                    ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                    : <><Download size={12} /> Download</>}
                </button>
              </div>
              {/* Live preview scaled to fit */}
              <div style={{ transform: 'scale(0.82)', transformOrigin: 'top left', width: 400, height: 580, marginBottom: -100 }}>
                <StudentCard student={stu} schoolName={schoolName} color={color} dark={dark} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Main Students page ────────────────────────────────────────────
export default function Students({ user, userRole, dataVersion }) {
  const { classes, loading } = useTeacherClasses(userRole === 'teacher' ? user : null)

  const [adminClasses, setAdminClasses]     = useState([])
  const [adminLoading, setAdminLoading]     = useState(userRole === 'admin')
  const [schoolName, setSchoolName]         = useState('')

  useEffect(() => {
    if (userRole !== 'admin') return
    import('../db').then(({ getClasses }) =>
      getClasses().then(list => {
        setAdminClasses((list || []).sort((a, b) => a.createdAt - b.createdAt))
        setAdminLoading(false)
      })
    )
  }, [dataVersion, userRole])

  useEffect(() => {
    getSchool().then(s => { if (s?.schoolName) setSchoolName(s.schoolName) }).catch(() => {})
  }, [])

  const allClasses = userRole === 'teacher' ? classes : adminClasses
  const isLoading  = userRole === 'teacher' ? loading : adminLoading

  const [saving, setSaving]                   = useState(false)
  const [view, setView]                       = useState('classes') // 'classes' | 'students' | 'cards'
  const [selectedClass, setSelectedClass]     = useState(null)
  const [search, setSearch]                   = useState('')
  const [showAddStudent, setShowAddStudent]   = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [newStudentName, setNewStudentName]   = useState('')
  const [msg, setMsg]                         = useState('')

  const canAdd    = userRole === 'admin' || userRole === 'teacher'
  const canDelete = userRole === 'admin' || userRole === 'teacher'
  const canPrint  = userRole === 'admin' || userRole === 'teacher'

  useEffect(() => {
    if (!selectedClass) return
    const updated = allClasses.find(c => c.id === selectedClass.id)
    if (updated) setSelectedClass(updated)
  }, [allClasses])

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const addStudent = async () => {
    if (!newStudentName.trim() || !selectedClass) return
    setSaving(true)
    const sk      = generateSecretKey()
    const pk      = getPublicKey(sk)
    const npub    = nip19.npubEncode(pk)
    const nsec    = nip19.nsecEncode(sk)
    const grad    = GRAD[selectedClass.students.length % GRAD.length]
    const student = {
      id: Date.now().toString(), name: newStudentName.trim(),
      pk, npub, nsec, grad,
      classId: selectedClass.id, className: selectedClass.name, createdAt: Date.now(),
    }
    const updatedClass   = { ...selectedClass, students: [...selectedClass.students, student] }
    const updatedClasses = allClasses.map(c => c.id === selectedClass.id ? updatedClass : c)
    await replaceAllClasses(updatedClasses)
    setSelectedClass(updatedClass)
    setNewStudentName(''); setShowAddStudent(false)
    syncSaveClass(user.nsec, updatedClass)
      .then(() => showMsg('ok: Student published to Nostr'))
      .catch(() => showMsg('ok: Saved locally'))
    setSaving(false)
  }

  const deleteStudent = async (studentId) => {
    setSaving(true)
    const updatedClass   = { ...selectedClass, students: selectedClass.students.filter(s => s.id !== studentId) }
    const updatedClasses = allClasses.map(c => c.id === selectedClass.id ? updatedClass : c)
    await replaceAllClasses(updatedClasses)
    setSelectedClass(updatedClass)
    setSelectedStudent(null)
    syncSaveClass(user.nsec, updatedClass).catch(console.warn)
    setSaving(false)
  }

  // ── Cards view ──────────────────────────────────────────────────
  if (view === 'cards' && selectedClass) {
    return (
      <CardsView
        selectedClass={selectedClass}
        schoolName={schoolName}
        onBack={() => setView('students')}
      />
    )
  }

  const students = selectedClass
    ? selectedClass.students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : []

  return (
    <div style={S.page}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={S.header}>
        {view === 'students' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setView('classes'); setSelectedClass(null); setSearch('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, padding: 0 }}>
              <ArrowLeft size={15} /> Classes
            </button>
            <span style={{ color: 'var(--muted)' }}>/</span>
            <span style={S.title}>{selectedClass.name}</span>
          </div>
        ) : (
          <div style={S.title}>Students</div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Cards button — icon only to avoid header overflow */}
          {view === 'students' && canPrint && selectedClass?.students?.length > 0 && (
            <button
              title="ID Cards"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)' }}
              onClick={() => setView('cards')}>
              <Printer size={15} />
            </button>
          )}
          {view === 'students' && canAdd && (
            <button style={S.addBtn} onClick={() => setShowAddStudent(true)}>
              <Plus size={15} /> Add
            </button>
          )}
        </div>
      </div>

      {/* Status msg */}
      {msg && (
        <div style={{ margin: '0 20px', padding: '10px 14px', borderRadius: 10, background: msg.startsWith('ok') ? 'rgba(0,201,122,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${msg.startsWith('ok') ? 'rgba(0,201,122,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 12, color: msg.startsWith('ok') ? '#00c97a' : '#ef4444', fontWeight: 600 }}>
          {msg.replace(/^(ok|err): /, '')}
        </div>
      )}

      {/* Search */}
      <div style={S.searchWrap}>
        <Search size={15} style={S.searchIcon} />
        <input style={S.searchInput}
          placeholder={view === 'students' ? 'Search students...' : 'Search classes...'}
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      )}

      {/* ── Class List ── */}
      {!isLoading && view === 'classes' && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <div style={S.sectionLabel}>All Classes</div>
            <div style={S.sectionCount}>{allClasses.length} classes · {allClasses.flatMap(c => c.students || []).length} students</div>
          </div>
          {allClasses.length === 0 ? (
            <div style={S.empty}>
              <School size={48} strokeWidth={1} color="var(--muted)" />
              <div style={S.emptyTitle}>No classes yet</div>
              <div style={S.emptySub}>Go to More → Classes to create your first class.</div>
            </div>
          ) : (
            <div style={S.list}>
              {allClasses.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(cls => (
                <div key={cls.id} style={S.classCard} onClick={() => { setSelectedClass(cls); setView('students'); setSearch('') }}>
                  <div style={{ ...S.classBadge, background: cls.color?.bg || '#f0fdf4', color: cls.color?.color || '#00c97a', border: `1px solid ${cls.color?.border || '#bbf7d0'}` }}>
                    {cls.name.slice(0, 3).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.className}>{cls.name}</div>
                    <div style={S.classSub}>{cls.students?.length || 0} student{(cls.students?.length || 0) !== 1 ? 's' : ''}</div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Student List ── */}
      {!isLoading && view === 'students' && selectedClass && (
        <div style={S.section}>
          <div style={S.sectionHeader}>
            <div style={S.sectionLabel}>{students.length} student{students.length !== 1 ? 's' : ''}</div>
          </div>
          {students.length === 0 ? (
            <div style={S.empty}>
              <Users size={48} strokeWidth={1} color="var(--muted)" />
              <div style={S.emptyTitle}>No students yet</div>
              <div style={S.emptySub}>{canAdd ? 'Tap + Add to register a student.' : 'No students in this class yet.'}</div>
            </div>
          ) : (
            <div style={S.list}>
              {students.map(stu => (
                <div key={stu.id} style={S.studentRow} onClick={() => setSelectedStudent(stu)}>
                  <div style={{ ...S.avatar, background: stu.grad }}>{stu.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={S.stuName}>{stu.name}</div>
                    <div style={S.stuSub}>{stu.npub?.slice(0, 16)}...</div>
                  </div>
                  <ChevronRight size={16} color="var(--muted)" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Student Sheet ── */}
      {showAddStudent && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowAddStudent(false)}>
          <div style={S.sheet}>
            <button style={S.closeBtn} onClick={() => setShowAddStudent(false)}><X size={15} /></button>
            <div style={S.sheetTitle}>Add Student</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              A unique Nostr identity will be generated automatically. Share the student's private key with them to log in from any device.
            </div>
            <div style={S.inputLabel}>Full Name</div>
            <input style={S.input} placeholder="e.g. Amara Kamau"
              value={newStudentName} onChange={e => setNewStudentName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStudent()} autoFocus />
            <button style={{ ...S.primaryBtn, marginTop: 8, opacity: saving ? 0.7 : 1 }}
              onClick={addStudent} disabled={saving}>
              {saving ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : <><UserPlus size={16} /> Register Student</>}
            </button>
            <button style={S.secondaryBtn} onClick={() => { setShowAddStudent(false); setNewStudentName('') }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Student Modal ── */}
      {selectedStudent && (
        <StudentModal
          student={selectedStudent}
          userRole={userRole}
          onClose={() => setSelectedStudent(null)}
          onDelete={canDelete ? deleteStudent : null}
        />
      )}
    </div>
  )
}

const S = {
  page:          { minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-display)', paddingBottom: 100 },
  header:        { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title:         { fontSize: 18, fontWeight: 800, color: 'var(--text)' },
  addBtn:        { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 10, color: '#0d1117', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)' },
  searchWrap:    { padding: '14px 20px 0', position: 'relative' },
  searchInput:   { width: '100%', padding: '11px 14px 11px 38px', background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  searchIcon:    { position: 'absolute', left: 32, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' },
  section:       { padding: '16px 20px 0' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel:  { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' },
  sectionCount:  { fontSize: 11, color: 'var(--muted)', fontWeight: 600 },
  list:          { display: 'flex', flexDirection: 'column', gap: 8 },
  classCard:     { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  classBadge:    { width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 },
  className:     { fontSize: 14, fontWeight: 800, color: 'var(--text)' },
  classSub:      { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  studentRow:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  avatar:        { width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 },
  stuName:       { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  stuSub:        { fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 2 },
  empty:         { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 20px', color: 'var(--muted)' },
  emptyTitle:    { fontSize: 16, fontWeight: 800, color: 'var(--text)' },
  emptySub:      { fontSize: 13, textAlign: 'center', lineHeight: 1.6, maxWidth: 280 },
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet:         { width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '24px 20px 44px', position: 'relative', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)' },
  closeBtn:      { position: 'absolute', top: 20, right: 20, background: 'var(--surface2)', border: 'none', width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--muted)' },
  sheetTitle:    { fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 16 },
  inputLabel:    { fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  input:         { width: '100%', padding: '12px 14px', background: 'var(--bg)', border: '1.5px solid var(--border)', borderRadius: 11, fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font-display)', outline: 'none', boxSizing: 'border-box' },
  primaryBtn:    { width: '100%', padding: 14, background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#0d1117', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryBtn:  { width: '100%', padding: 14, marginTop: 8, background: 'transparent', border: '1.5px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' },
}

