import { X, LayoutDashboard, UserCog, School, BarChart3, PieChart, Settings, ChevronRight, Users } from 'lucide-react'

/**
 * Role visibility:
 *   Admin   → Dashboard, Teachers, Reports, Budget, Settings
 *   Teacher → Classes, Students (their class), Settings
 *   Student → Settings only (home tab is their profile)
 */
const MORE_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',        icon: LayoutDashboard, desc: 'Charts & overview',       roles: ['admin']            },
  { id: 'teachers',  label: 'Teachers',          icon: UserCog,         desc: 'Create & manage staff',   roles: ['admin']            },
  { id: 'classes',   label: 'Classes',           icon: School,          desc: 'Manage your classes',     roles: ['teacher']          },
  { id: 'students',  label: 'My Students',       icon: Users,           desc: 'Students in your class',  roles: ['teacher']          },
  { id: 'reports',   label: 'Reports & Exports', icon: BarChart3,       desc: 'Download reports',        roles: ['admin']            },
  { id: 'budget',    label: 'Budget',            icon: PieChart,        desc: 'Budget tracking',         roles: ['admin']            },
  { id: 'settings',  label: 'Settings',          icon: Settings,        desc: 'App preferences',         roles: ['admin','teacher','student'] },
]

export { MORE_ITEMS }

export default function MoreLayout({ userRole, onNavigate, onClose }) {
  const visible = MORE_ITEMS.filter(item => item.roles.includes(userRole))

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 64, zIndex: 9998, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: '20px 20px 0 0', border: '1px solid var(--border)', borderBottom: 'none', paddingBottom: 16, animation: 'slideUp 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 12px' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Control Room</span>
          <button onClick={onClose} style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 9, background: 'transparent', color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>

        {/* Items */}
        {visible.map(({ id, label, icon: Icon, desc }, i) => (
          <button
            key={id}
            onClick={() => { onNavigate(id); onClose() }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', background: 'none', border: 'none', borderTop: i === 0 ? '1px solid var(--border)' : 'none', borderBottom: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontFamily: 'var(--font-display)' }}
          >
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--bg)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon size={18} color="var(--accent)" />
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{desc}</div>
            </div>
            <ChevronRight size={16} color="var(--muted)" />
          </button>
        ))}
      </div>
    </div>
  )
}

