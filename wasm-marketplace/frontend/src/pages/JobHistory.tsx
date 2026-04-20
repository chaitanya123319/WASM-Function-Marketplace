import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Clock, Shield } from 'lucide-react'
import { listJobs, type Job } from '../services/api'
import { StatusBadge } from '../components/StatusBadge'

function fmt(dt: string | null) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString()
}

export default function JobHistory() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    listJobs().then(r => setJobs(r.data)).finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => setExpanded(e => (e === id ? null : id))

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="section-title gradient-text">Job History</h1>
          <p className="text-white/40 text-sm mt-1">All your past function invocations</p>
        </div>
        <span className="text-xs text-white/30">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="glass p-16 text-center text-white/30">
          <p className="text-lg font-semibold mb-1">No jobs yet</p>
          <p className="text-sm">Invoke a function from the marketplace to see history</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(job => (
            <div key={job.id} id={`job-row-${job.id}`} className="glass overflow-hidden">
              {/* Summary row */}
              <button
                onClick={() => toggle(job.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-700/30 transition-colors"
              >
                <StatusBadge status={job.status} />

                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-white/40 truncate">
                    {job.id}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    {fmt(job.created_at)}
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-1 text-xs text-white/40">
                  <Clock className="w-3.5 h-3.5" />
                  {job.execution_time_ms.toFixed(0)} ms
                </div>

                <div className="text-sm font-bold text-brand-400">
                  {job.credits_charged > 0 ? `-${job.credits_charged} cr` : 'refunded'}
                </div>

                {expanded === job.id
                  ? <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />}
              </button>

              {/* Expanded detail */}
              {expanded === job.id && (
                <div className="border-t border-white/5 p-4 space-y-4 animate-slide-up">
                  {/* Billing */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Platform Fee (20%)', value: job.platform_fee },
                      { label: 'Developer (56%)', value: job.developer_payout },
                      { label: 'Node (24%)', value: job.node_payout },
                    ].map(({ label, value }) => (
                      <div key={label} className="glass-sm p-3 text-center">
                        <p className="text-xs text-white/30 mb-1">{label}</p>
                        <p className="text-sm font-bold text-white/80">{value.toFixed(4)} cr</p>
                      </div>
                    ))}
                  </div>

                  {/* Output */}
                  {job.output_result !== null && (
                    <div>
                      <p className="text-xs text-white/30 mb-1.5 font-semibold">Output</p>
                      <pre className="glass-sm p-3 font-mono text-xs text-green-300 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                        {job.output_result || '(empty)'}
                      </pre>
                    </div>
                  )}

                  {job.error_message && (
                    <div>
                      <p className="text-xs text-white/30 mb-1.5 font-semibold">Error</p>
                      <pre className="glass-sm p-3 font-mono text-xs text-red-300 whitespace-pre-wrap">{job.error_message}</pre>
                    </div>
                  )}

                  {/* Signature */}
                  {job.execution_signature && (
                    <div className="flex items-start gap-2">
                      <Shield className="w-3.5 h-3.5 text-brand-500/60 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-white/30 mb-1">Ed25519 Execution Signature</p>
                        <p className="font-mono text-xs text-white/40 break-all">{job.execution_signature}</p>
                      </div>
                    </div>
                  )}

                  {/* Node + timing */}
                  <div className="flex flex-wrap gap-4 text-xs text-white/30">
                    {job.node_id && <span>Node: <span className="text-white/50">{job.node_id}</span></span>}
                    {job.started_at && <span>Started: <span className="text-white/50">{fmt(job.started_at)}</span></span>}
                    {job.finished_at && <span>Finished: <span className="text-white/50">{fmt(job.finished_at)}</span></span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
