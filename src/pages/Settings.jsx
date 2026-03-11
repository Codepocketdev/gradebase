import { Sun, Moon, ChevronRight, Zap, User } from 'lucide-react'
import { useNostrProfile } from '../hooks/useNostrProfile'

const syncColor = s => s === 'synced' ? 'var(--income)' : s === 'syncing' ? '#fbbf24' : '#ef4444'
const syncLabel = s => s === 'synced' ? '● Live' : s === 'syncing' ? '◌ Syncing...' : '○ Offline'

export default function Settings({ user, theme, toggleTheme, syncState, rate, rateLoading, onLogout, onNavigate }) {
  const isAdmin   = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'

  const { profile: liveProfile } = useNostrProfile(user?.pk)
  const liveAvatar = liveProfile?.picture || user?.avatar || ''
  const liveName   = liveProfile?.name || liveProfile?.display_name || user?.name || ''

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: 'var(--text)' }}>Settings</div>

      {/* Profile button — admin and teacher */}
      {(isAdmin || isTeacher) && (
        <button style={S.profileBtn} onClick={() => onNavigate(isAdmin ? 'profile' : 'teacher-profile')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {liveAvatar
              ? <img src={liveAvatar} alt="avatar" style={{ width: 48, height: 48, borderRadius: 14, objectFit: 'cover', border: '2px solid var(--accent)' }} />
              : (
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(79,255,176,0.12)', border: '1.5px solid rgba(79,255,176,0.3)', display: 'grid', placeItems: 'center' }}>
                  <User size={22} color="var(--accent)" />
                </div>
              )
            }
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{liveName || (isAdmin ? 'Admin' : 'Teacher')}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>View & edit your profile</div>
            </div>
          </div>
          <ChevronRight size={16} color="var(--muted)" />
        </button>
      )}

      {/* Sync */}
      <div style={S.card}>
        <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={16} color={syncColor(syncState)} />
            <div>
              <div style={S.rowTitle}>Nostr Sync</div>
              <div style={S.rowSub}>Real-time relay connection</div>
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: syncColor(syncState) }}>{syncLabel(syncState)}</span>
        </div>
      </div>

      {/* Theme */}
      <div style={S.card}>
        <button onClick={toggleTheme} style={S.row}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {theme === 'dark' ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="var(--accent)" />}
            <div style={{ textAlign: 'left' }}>
              <div style={S.rowTitle}>Theme</div>
              <div style={S.rowSub}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
            </div>
          </div>
          <ChevronRight size={16} color="var(--muted)" />
        </button>
      </div>

      {/* Rate */}
      <div style={{ ...S.card, padding: '13px 16px' }}>
        <div style={S.rowTitle}>Exchange Rate</div>
        <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: 6 }}>
          {rateLoading ? 'Fetching...' : `1 USD = KSh ${rate.toFixed(2)}`}
        </div>
      </div>

      {/* Logout */}
      <button onClick={onLogout} style={S.logoutBtn}>Logout</button>
    </div>
  )
}

const S = {
  profileBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface)', border: '1.5px solid rgba(79,255,176,0.2)', borderRadius: 16, cursor: 'pointer', fontFamily: 'var(--font-display)', boxShadow: '0 0 20px rgba(79,255,176,0.06)' },
  card:       { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' },
  row:        { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' },
  rowTitle:   { fontSize: 13, fontWeight: 700, color: 'var(--text)' },
  rowSub:     { fontSize: 11, color: 'var(--muted)', marginTop: 1 },
  logoutBtn:  { width: '100%', padding: '14px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, color: '#ef4444', fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
}

