import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { Store, Upload, LayoutDashboard, History, LogOut, Menu, X } from 'lucide-react'
import { getMe, type User } from './services/api'
import { CreditBadge } from './components/CreditBadge'
import Marketplace from './pages/Marketplace'
import UploadPage from './pages/Upload'
import MyFunctions from './pages/MyFunctions'
import Invoke from './pages/Invoke'
import JobHistory from './pages/JobHistory'
import AuthPage from './pages/AuthPage'

// ── Protected Route ───────────────────────────────────────────────────────────
function ProtectedRoute({ user, children }: { user: User | null; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Navbar ────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { to: '/',            label: 'Marketplace', Icon: Store },
  { to: '/upload',      label: 'Upload',      Icon: Upload },
  { to: '/my-functions',label: 'My Functions',Icon: LayoutDashboard },
  { to: '/jobs',        label: 'Job History', Icon: History },
]

function Navbar({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
      isActive
        ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
        : 'text-white/50 hover:text-white hover:bg-surface-700/50'
    }`

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-surface-800/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 mr-4 flex-shrink-0">
          <span className="text-2xl">⬡</span>
          <span className="font-bold text-white hidden sm:block">WASM<span className="gradient-text">Market</span></span>
        </NavLink>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={linkClass} id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}>
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="flex-1 md:hidden" />

        {/* Right side */}
        {user ? (
          <div className="flex items-center gap-3">
            <CreditBadge credits={user.credits} />
            <span className="hidden sm:block text-sm text-white/50">{user.username}</span>
            <button
              id="logout-btn"
              onClick={onLogout}
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        ) : (
          <NavLink to="/login" className="btn-primary !py-1.5 text-xs">
            Sign In
          </NavLink>
        )}

        {/* Mobile menu toggle */}
        <button
          id="mobile-menu-btn"
          className="md:hidden btn-secondary !p-2"
          onClick={() => setMenuOpen(o => !o)}
        >
          {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5 bg-surface-800/95 px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={linkClass}
              onClick={() => setMenuOpen(false)}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  )
}

// ── App Shell ─────────────────────────────────────────────────────────────────
function AppShell() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) { setAuthLoading(false); return }
    try {
      const res = await getMe()
      setUser(res.data)
    } catch {
      localStorage.removeItem('token')
    } finally {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <Navbar user={user} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Routes>
          <Route path="/" element={<Marketplace />} />
          <Route path="/login" element={<AuthPage onAuth={loadUser} />} />
          <Route path="/register" element={<AuthPage onAuth={loadUser} mode="register" />} />
          <Route path="/upload" element={
            <ProtectedRoute user={user}>
              <UploadPage />
            </ProtectedRoute>
          } />
          <Route path="/my-functions" element={
            <ProtectedRoute user={user}>
              <MyFunctions />
            </ProtectedRoute>
          } />
          <Route path="/invoke/:id" element={
            <ProtectedRoute user={user}>
              <Invoke />
            </ProtectedRoute>
          } />
          <Route path="/jobs" element={
            <ProtectedRoute user={user}>
              <JobHistory />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
