import { useState, useEffect } from 'react'
import { X, Plus, Check, ArrowLeft, Trash2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import CategoryIcon from './CategoryIcon'
import { CATEGORY_COLORS, CATEGORY_ICON_NAMES, DEFAULT_CATEGORIES } from '../hooks/useTransactions'
import styles from './CategoryPicker.module.css'

export default function CategoryPicker({ value, onChange, categories, onAddCategory, onDeleteCategory }) {
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [deleteMode, setDeleteMode] = useState(false)

  const color = CATEGORY_COLORS[value] || '#94a3b8'
  const iconName = CATEGORY_ICON_NAMES[value] || 'MoreHorizontal'

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleAdd = () => {
    const trimmed = newCat.trim()
    if (!trimmed) return
    onAddCategory(trimmed)
    onChange(trimmed)
    setNewCat('')
    setAdding(false)
  }

  const handleDelete = (cat) => {
    if (DEFAULT_CATEGORIES.includes(cat)) return
    onDeleteCategory(cat)
    if (value === cat) onChange(categories.find(c => c !== cat) || 'Other')
  }

  const close = () => {
    setOpen(false)
    setAdding(false)
    setNewCat('')
    setDeleteMode(false)
  }

  const picker = open ? (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-display)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        minHeight: 58,
      }}>
        <button onClick={close} style={btnStyle}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
          Select Category
        </span>
        <button
          onClick={() => { setDeleteMode(d => !d); setAdding(false) }}
          style={{ ...btnStyle, ...(deleteMode ? activeBtnStyle('#ff6b6b') : {}) }}
        >
          <Trash2 size={16} />
        </button>
        <button
          onClick={() => { setAdding(a => !a); setDeleteMode(false) }}
          style={{ ...btnStyle, ...(adding ? activeBtnStyle('var(--accent)') : {}) }}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Add input */}
      {adding && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <input
            style={{
              flex: 1, padding: '10px 14px',
              background: 'var(--bg)',
              border: '2px solid var(--accent)',
              borderRadius: 10, color: 'var(--text)',
              fontFamily: 'var(--font-display)', fontSize: 14, outline: 'none',
            }}
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            placeholder="e.g. Transport, Library, Sports..."
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <button onClick={handleAdd} style={{
            height: 42, padding: '0 16px',
            background: 'var(--accent)', border: 'none', borderRadius: 10,
            color: '#0d0f14', fontWeight: 800, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            fontFamily: 'var(--font-display)', whiteSpace: 'nowrap',
          }}>
            <Check size={14} /> Save
          </button>
          <button onClick={() => { setAdding(false); setNewCat('') }} style={{
            height: 42, width: 42, background: 'var(--surface2)',
            border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'pointer',
          }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Delete banner */}
      {deleteMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px',
          background: 'rgba(255,107,107,0.1)',
          borderBottom: '1px solid rgba(255,107,107,0.3)',
          color: '#ff6b6b', fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>
          <Trash2 size={12} /> Tap a custom category to delete. Default ones are protected.
        </div>
      )}

      {/* Scrollable grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, WebkitOverflowScrolling: 'touch' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {categories.map(cat => {
            const c = CATEGORY_COLORS[cat] || '#94a3b8'
            const icon = CATEGORY_ICON_NAMES[cat] || 'MoreHorizontal'
            const active = cat === value
            const isDefault = DEFAULT_CATEGORIES.includes(cat)
            const canDelete = deleteMode && !isDefault
            const locked = deleteMode && isDefault

            return (
              <button
                key={cat}
                onClick={() => {
                  if (deleteMode) { if (!isDefault) handleDelete(cat) }
                  else { onChange(cat); close() }
                }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '14px 8px',
                  border: `1px solid ${canDelete ? '#ff6b6b' : active && !deleteMode ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 14,
                  background: active && !deleteMode ? 'rgba(79,255,176,0.07)' : 'var(--surface)',
                  color: 'var(--text)', cursor: locked ? 'not-allowed' : 'pointer',
                  opacity: locked ? 0.35 : 1,
                  position: 'relative', minHeight: 90,
                  fontFamily: 'var(--font-display)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: c + (active ? '33' : '18'),
                  color: c, display: 'grid', placeItems: 'center',
                }}>
                  <CategoryIcon name={icon} size={22} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>
                  {cat}
                </span>
                {active && !deleteMode && (
                  <div style={{
                    position: 'absolute', top: 7, right: 7,
                    width: 18, height: 18, background: 'var(--accent)',
                    borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#0d0f14',
                  }}>
                    <Check size={10} />
                  </div>
                )}
                {canDelete && (
                  <div style={{
                    position: 'absolute', top: 7, right: 7,
                    width: 18, height: 18, background: '#ff6b6b',
                    borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'white',
                  }}>
                    <X size={10} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen(true)} type="button">
        <div className={styles.triggerLeft}>
          <div className={styles.iconWrap} style={{ background: color + '22', color }}>
            <CategoryIcon name={iconName} size={14} />
          </div>
          <span>{value}</span>
        </div>
        <span className={styles.change}>Tap to change</span>
      </button>

      {createPortal(picker, document.body)}
    </>
  )
}

const btnStyle = {
  width: 40, height: 40,
  border: '1px solid var(--border)',
  borderRadius: 10,
  background: 'var(--surface2)',
  color: 'var(--text)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
}

const activeBtnStyle = (color) => ({
  borderColor: color,
  color: color,
  background: color + '22',
})
