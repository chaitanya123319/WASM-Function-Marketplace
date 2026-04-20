import { Cpu, Globe } from 'lucide-react'
import type { WasmFunction } from '../services/api'

const LANG_COLORS: Record<string, string> = {
  rust: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  go: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  c: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  zig: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
}

interface Props {
  fn: WasmFunction
  onClick: () => void
}

export function FunctionCard({ fn, onClick }: Props) {
  const langColor = LANG_COLORS[fn.source_language] ?? 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  const cidShort = fn.ipfs_cid.slice(0, 8) + '…' + fn.ipfs_cid.slice(-6)

  return (
    <button
      id={`fn-card-${fn.id}`}
      onClick={onClick}
      className="group w-full text-left glass p-5 hover:border-brand-500/30 hover:shadow-[0_0_24px_rgba(74,95,255,0.15)]
                 transition-all duration-300 animate-fade-in cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base text-white group-hover:gradient-text truncate transition-all duration-200">
            {fn.name}
          </h3>
          <p className="text-xs text-white/40 font-mono mt-0.5">v{fn.version}</p>
        </div>
        <span className={`badge border text-xs ${langColor}`}>
          {fn.source_language}
        </span>
      </div>

      {/* Description */}
      {fn.description && (
        <p className="text-sm text-white/50 line-clamp-2 mb-4">{fn.description}</p>
      )}

      {/* CID */}
      <div className="flex items-center gap-1.5 mb-4">
        <Globe className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
        <span className="text-xs font-mono text-white/30 truncate">{cidShort}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-1 text-xs text-white/40">
          <Cpu className="w-3.5 h-3.5" />
          <span>{fn.total_calls.toLocaleString()} calls</span>
        </div>
        <div className="text-sm font-bold text-brand-400">
          {fn.price_per_call} cr / call
        </div>
      </div>
    </button>
  )
}
