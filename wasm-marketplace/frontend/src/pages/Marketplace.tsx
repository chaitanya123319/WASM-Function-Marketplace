import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Filter } from 'lucide-react'
import { listFunctions, type WasmFunction } from '../services/api'
import { FunctionCard } from '../components/FunctionCard'

const LANGUAGES = ['all', 'rust', 'go', 'c', 'zig']

export default function Marketplace() {
  const navigate = useNavigate()
  const [functions, setFunctions] = useState<WasmFunction[]>([])
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listFunctions(lang === 'all' ? undefined : lang)
      setFunctions(res.data)
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => { load() }, [load])

  const filtered = functions.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.description ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="animate-fade-in">
      {/* Hero banner */}
      <div className="relative mb-10 p-8 glass overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/10 to-violet-600/10" />
        <div className="relative z-10">
          <p className="text-xs font-semibold tracking-widest text-brand-400 uppercase mb-2">
            Powered by IPFS
          </p>
          <h1 className="section-title gradient-text mb-2">
            WASM Function Marketplace
          </h1>
          <p className="text-white/50 max-w-xl">
            Discover, invoke, and monetize serverless WebAssembly functions.
            All binaries stored immutably on IPFS via Pinata.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            id="marketplace-search"
            className="input pl-10"
            placeholder="Search functions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Language filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-white/30" />
          {LANGUAGES.map(l => (
            <button
              key={l}
              id={`filter-${l}`}
              onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                ${lang === l
                  ? 'bg-brand-600 text-white shadow-[0_0_12px_rgba(51,68,255,0.4)]'
                  : 'bg-surface-700 text-white/50 hover:text-white hover:bg-surface-600'
                }`}
            >
              {l === 'all' ? 'All' : l}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass p-5 h-48 animate-pulse">
              <div className="h-4 bg-white/5 rounded mb-3 w-3/4" />
              <div className="h-3 bg-white/5 rounded mb-2 w-full" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <p className="text-lg font-semibold mb-1">No functions found</p>
          <p className="text-sm">Upload the first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(fn => (
            <FunctionCard
              key={fn.id}
              fn={fn}
              onClick={() => navigate(`/invoke/${fn.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
