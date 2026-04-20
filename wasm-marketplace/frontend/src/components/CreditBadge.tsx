import { Zap } from 'lucide-react'

interface Props {
  credits: number
}

export function CreditBadge({ credits }: Props) {
  const low = credits < 10
  return (
    <div
      id="credit-badge"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm
        ${low
          ? 'bg-red-500/10 border border-red-500/30 text-red-400'
          : 'bg-brand-600/20 border border-brand-500/30 text-brand-300'
        }`}
    >
      <Zap className={`w-4 h-4 ${low ? 'text-red-400' : 'text-brand-400'}`} />
      <span>{credits.toFixed(1)}</span>
      <span className="text-xs font-normal opacity-70">cr</span>
    </div>
  )
}
