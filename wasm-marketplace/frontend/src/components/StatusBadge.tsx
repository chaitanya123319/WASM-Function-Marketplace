interface Props {
  status: string
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Pending',    cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  dispatched: { label: 'Dispatched', cls: 'bg-blue-500/15   text-blue-400   border-blue-500/30'   },
  running:    { label: 'Running',    cls: 'bg-cyan-500/15   text-cyan-400   border-cyan-500/30'    },
  completed:  { label: 'Completed',  cls: 'bg-green-500/15  text-green-400  border-green-500/30'   },
  failed:     { label: 'Failed',     cls: 'bg-red-500/15    text-red-400    border-red-500/30'     },
  timeout:    { label: 'Timeout',    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30'  },
}

export function StatusBadge({ status }: Props) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' }
  return (
    <span className={`badge border text-xs px-2.5 py-0.5 rounded-full font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
