import { useState } from 'react'
import {
  BookOpen, Home, Users, Wallet,
  ClipboardList, MoreHorizontal,
  Sun, Moon, TrendingUp
} from 'lucide-react'
import { useTransactions } from './hooks/useTransactions'
import { useTheme }        from './hooks/useTheme'
import { useCurrency }     from './hooks/useCurrency'

// Pages
import HomePg         from './pages/Home'
import Students       from './pages/Students'
import StudentProfile from './pages/StudentProfile'
import Transactions   from './pages/Transactions'
import Dashboard      from './pages/Dashboard'
import Teachers       from './pages/Teachers'
import Classes        from './pages/Classes'
import Reports        from './pages/Reports'
import Budget         from './pages/Budget'
import Settings       from './pages/Settings'
import AdminProfile   from './pages/AdminProfile'
import TeacherProfile from './pages/TeacherProfile'
import Attendance     from './pages/Attendance'
import Payments       from './pages/payments/index'
import FeeStructure   from './pages/FeeStructure'

// Layout
import MoreLayout, { MORE_ITEMS } from './layout/MoreLayout'

import styles from './App.module.css'

const BOTTOM_NAV = [
  { id: 'home',       label: 'Home',       icon: Home },
  { id: 'students',   label: 'Students',   icon: Users },
  { id: 'payments',   label: 'Payments',   icon: Wallet },
  { id: 'attendance', label: 'Attendance', icon: ClipboardList },
  { id: 'more',       label: 'More',       icon: MoreHorizontal },
]

export default function App({ user, syncState, dataVersion, onLogout, onUpdateUser }) {
  const [page, setPage]         = useState('home')
  const [moreOpen, setMoreOpen] = useState(false)

  const { theme, toggleTheme }           = useTheme()
  const { fmt, rate, loading: rateLoad } = useCurrency()
  const {
    transactions, schoolName,
    addTransaction, deleteTransaction,
    categories, addCategory, deleteCategory,
    stats, spentByCategory, chartData,
  } = useTransactions()

  const userRole = user?.role || 'admin'
  const isAdmin  = userRole === 'admin'

  const sideMoreItems = MORE_ITEMS.filter(i => i.roles.includes(userRole))

  const navigate = (id) => { setPage(id); setMoreOpen(false) }

  const handleBottomNav = (id) => {
    if (id === 'more') { setMoreOpen(true); return }
    setPage(id)
  }

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <HomePg user={user} userRole={userRole} schoolName={schoolName} onNavigate={navigate} dataVersion={dataVersion} />

      case 'students':
        return userRole === 'student'
          ? <StudentProfile user={user} syncState={syncState} />
          : <Students user={user} userRole={userRole} dataVersion={dataVersion} />

      // ── Student fees / payments (new) ─────────────────────────────
      case 'payments':
        return <Payments user={user} userRole={userRole} dataVersion={dataVersion} />

      // ── School ledger (old Transactions, moved to More) ────────────
      case 'school-ledger':
        return (
          <Transactions
            transactions={transactions} onAdd={addTransaction} onDelete={deleteTransaction}
            fmt={fmt} categories={categories} onAddCategory={addCategory} onDeleteCategory={deleteCategory}
          />
        )

      case 'attendance':
        return <Attendance user={user} userRole={userRole} dataVersion={dataVersion} />

      case 'dashboard':
        return <Dashboard stats={stats} chartData={chartData} transactions={transactions} fmt={fmt} />

      case 'teachers':
        return isAdmin ? <Teachers user={user} dataVersion={dataVersion} /> : null

      case 'classes':
        return <Classes user={user} userRole={userRole} dataVersion={dataVersion} />

      case 'fee-structure':
        return isAdmin ? <FeeStructure user={user} onBack={() => setMoreOpen(true)} /> : null

      case 'reports':
        return <Reports transactions={transactions} stats={stats} spentByCategory={spentByCategory} schoolName={schoolName} fmt={fmt} />

      case 'budget':
        return <Budget spentByCategory={spentByCategory} fmt={fmt} />

      case 'profile':
        return <AdminProfile user={user} syncState={syncState} onBack={() => setPage('settings')} onUpdateUser={onUpdateUser} />

      case 'teacher-profile':
        return <TeacherProfile user={user} syncState={syncState} onBack={() => setPage('settings')} onUpdateUser={onUpdateUser} />

      case 'settings':
        return (
          <Settings
            user={user} theme={theme} toggleTheme={toggleTheme}
            syncState={syncState} rate={rate} rateLoading={rateLoad}
            onLogout={onLogout}
            onNavigate={setPage}
          />
        )

      default: return null
    }
  }

  const activeBottom = ['home','students','payments','attendance'].includes(page) ? page : null

  return (
    <div className={styles.root}>

      {/* ── Sidebar (desktop) ─────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <div className={styles.sidebarLogoIcon}><BookOpen size={18} color="#0d0f14" /></div>
          <span className={styles.sidebarLogoText}>Grade<span>Base</span></span>
        </div>

        <nav className={styles.sidebarNav}>
          {BOTTOM_NAV.filter(n => n.id !== 'more').map(({ id, label, icon: Icon }) => (
            <button key={id}
              className={styles.sidebarBtn + (page === id ? ' ' + styles.sidebarBtnActive : '')}
              onClick={() => setPage(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
          {sideMoreItems.map(({ id, label, icon: Icon }) => (
            <button key={id}
              className={styles.sidebarBtn + (page === id ? ' ' + styles.sidebarBtnActive : '')}
              onClick={() => navigate(id)}>
              <Icon size={16} />{label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.rateBadge}>
            <TrendingUp size={11} />
            {rateLoad ? 'Fetching...' : `1 USD = KSh ${rate.toFixed(2)}`}
          </div>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </aside>

      {/* ── Right panel ───────────────────────────────────────────── */}
      <div className={styles.right}>

        {/* Mobile header */}
        <div className={styles.mobileHeader}>
          <div className={styles.mobileLogoWrap}>
            <BookOpen size={18} color="var(--accent)" />
            <span className={styles.mobileLogoText}>Grade<span>Base</span></span>
          </div>
          <button className={styles.iconBtn} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>

        <main className={styles.main}>{renderPage()}</main>

        {/* Bottom nav */}
        <nav className={styles.bottomNav}>
          {BOTTOM_NAV.map(({ id, label, icon: Icon }) => (
            <button key={id}
              className={styles.bottomNavBtn + (activeBottom === id ? ' ' + styles.bottomNavActive : '')}
              onClick={() => handleBottomNav(id)}>
              <Icon size={20} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── More drawer ───────────────────────────────────────────── */}
      {moreOpen && (
        <MoreLayout
          userRole={userRole}
          onNavigate={navigate}
          onClose={() => setMoreOpen(false)}
        />
      )}

    </div>
  )
}

