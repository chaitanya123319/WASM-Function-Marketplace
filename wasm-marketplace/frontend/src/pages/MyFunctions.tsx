import { useEffect, useState } from 'react'
import { Trash2, Globe, ExternalLink } from 'lucide-react'
import { listMyFunctions, deleteFunction, type WasmFunction } from '../services/api'

const LANG_COLORS: Record<string, string> = {
  rust: 'text-orange-400',
  go: 'text-cyan-400',
  c: 'text-yellow-400',
  zig: 'text-purple-400',
}

export default function MyFunctions() {
  const [functions, setFunctions] = useState<WasmFunction[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    listMyFunctions().then(r => setFunctions(r.data)).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('This will unpin the binary from IPFS. Continue?')) return
    setDeleting(id)
    try {
      await deleteFunction(id)
      setFunctions(fs => fs.filter(f => f.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="section-title gradient-text">My Functions</h1>
          <p className="text-white/40 text-sm mt-1">Manage your uploaded WASM binaries</p>
        </div>
        <span className="text-xs text-white/30">{functions.length} function{functions.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : functions.length === 0 ? (
        <div className="glass p-16 text-center text-white/30">
          <p className="text-lg font-semibold mb-1">No functions uploaded yet</p>
          <p className="text-sm">Upload your first .wasm binary to get started</p>
        </div>
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/30 text-xs uppercase tracking-wider">
                <th className="text-left p-4 font-semibold">Name</th>
                <th className="text-left p-4 font-semibold hidden md:table-cell">Lang</th>
                <th className="text-left p-4 font-semibold hidden lg:table-cell">IPFS CID</th>
                <th className="text-right p-4 font-semibold">Calls</th>
                <th className="text-right p-4 font-semibold">Earnings</th>
                <th className="text-right p-4 font-semibold">Price</th>
                <th className="text-center p-4 font-semibold">Public</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {functions.map((fn, i) => (
                <tr
                  key={fn.id}
                  id={`my-fn-${fn.id}`}
                  className={`border-b border-white/5 hover:bg-surface-700/30 transition-colors ${i % 2 === 0 ? '' : 'bg-surface-800/20'}`}
                >
                  <td className="p-4">
                    <div>
                      <p className="font-semibold text-white">{fn.name}</p>
                      <p className="text-xs text-white/30">v{fn.version}</p>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className={`text-xs font-mono font-semibold ${LANG_COLORS[fn.source_language] ?? 'text-gray-400'}`}>
                      {fn.source_language}
                    </span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-white/40 truncate max-w-[180px]">
                        {fn.ipfs_cid.slice(0, 12)}…{fn.ipfs_cid.slice(-8)}
                      </span>
                      <a
                        href={fn.gateway_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-400 hover:text-brand-300"
                        title="Open in gateway"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                  <td className="p-4 text-right text-white/70">{fn.total_calls.toLocaleString()}</td>
                  <td className="p-4 text-right text-green-400 font-semibold">
                    {fn.total_earnings.toFixed(2)} cr
                  </td>
                  <td className="p-4 text-right text-brand-400 font-bold">{fn.price_per_call}</td>
                  <td className="p-4 text-center">
                    <Globe className={`w-4 h-4 mx-auto ${fn.is_public ? 'text-green-400' : 'text-white/20'}`} />
                  </td>
                  <td className="p-4 text-right">
                    <button
                      id={`delete-fn-${fn.id}`}
                      onClick={() => handleDelete(fn.id)}
                      disabled={deleting === fn.id}
                      className="btn-danger !px-2.5 !py-1.5"
                    >
                      {deleting === fn.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
