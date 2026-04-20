import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, LogIn, AlertCircle } from 'lucide-react'
import { register, login, getMe } from '../services/api'

interface Props {
  onAuth: () => void
  mode?: 'login' | 'register'
}

export default function AuthPage({ onAuth, mode: initMode = 'login' }: Props) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>(initMode)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        await register(form)
      }
      const res = await login(form.username, form.password)
      localStorage.setItem('token', res.data.access_token)
      onAuth()
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600/20 border border-brand-500/30 mb-4">
            <span className="text-3xl">⬡</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">WASM Marketplace</h1>
          <p className="text-white/40 text-sm mt-1">Serverless WebAssembly on IPFS</p>
        </div>

        <div className="glass p-8">
          {/* Tab switcher */}
          <div className="flex rounded-xl bg-surface-700/50 p-1 mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                id={`auth-tab-${m}`}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-150 capitalize
                  ${mode === m
                    ? 'bg-brand-600 text-white shadow-[0_0_12px_rgba(51,68,255,0.3)]'
                    : 'text-white/40 hover:text-white'
                  }`}
              >
                {m}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5">Username</label>
              <input
                id="auth-username"
                className="input"
                required
                autoComplete="username"
                placeholder="johndoe"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-white/50 mb-1.5">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  className="input"
                  required
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5">Password</label>
              <input
                id="auth-password"
                type="password"
                className="input"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'register' ? (
                <><UserPlus className="w-4 h-4" /> Create Account</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          New accounts start with 100 free credits
        </p>
      </div>
    </div>
  )
}
