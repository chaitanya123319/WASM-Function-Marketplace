import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { Play, ExternalLink, Clock, Zap, Shield, AlertCircle } from 'lucide-react'
import { getFunction, invokeFunction, type WasmFunction, type InvokeResponse } from '../services/api'
import { StatusBadge } from '../components/StatusBadge'

export default function Invoke() {
  const { id } = useParams<{ id: string }>()
  const [fn, setFn] = useState<WasmFunction | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [args, setArgs] = useState('{}')
  const [result, setResult] = useState<InvokeResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    getFunction(id).then(r => setFn(r.data)).finally(() => setLoading(false))
  }, [id])

  const handleInvoke = async () => {
    if (!fn) return
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const parsed = JSON.parse(args)
      const res = await invokeFunction(fn.id, parsed)
      setResult(res.data)
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in args')
      } else {
        setError(err.response?.data?.detail ?? 'Invocation failed')
      }
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="glass p-8 animate-pulse h-40" />
        <div className="glass p-8 animate-pulse h-64" />
      </div>
    )
  }

  if (!fn) {
    return (
      <div className="text-center py-20 text-white/40">
        <p className="text-xl font-semibold">Function not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Function Info */}
      <div className="glass p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold gradient-text">{fn.name}</h1>
            <p className="text-sm text-white/40 mt-1">v{fn.version} · {fn.source_language}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-brand-400">{fn.price_per_call}</p>
            <p className="text-xs text-white/30">credits / call</p>
          </div>
        </div>

        {fn.description && <p className="text-white/50 text-sm mb-4">{fn.description}</p>}

        <div className="glass-sm p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs text-white/30 w-20 flex-shrink-0 mt-0.5">IPFS CID</span>
            <span className="font-mono text-xs text-brand-300 break-all">{fn.ipfs_cid}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 w-20 flex-shrink-0">Gateway</span>
            <a
              href={fn.gateway_url}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 truncate"
            >
              <span className="truncate">{fn.gateway_url}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30 w-20 flex-shrink-0">Total calls</span>
            <span className="text-xs text-white/60">{fn.total_calls.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Input Editor */}
      <div className="glass p-6">
        <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">
          Input Arguments (JSON)
        </h2>
        <div className="rounded-xl overflow-hidden border border-white/5">
          <Editor
            height="200px"
            defaultLanguage="json"
            value={args}
            onChange={v => setArgs(v ?? '{}')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
            }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          id="invoke-run-btn"
          onClick={handleInvoke}
          disabled={running}
          className="btn-primary w-full justify-center py-3 mt-4"
        >
          {running ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Executing in Wazero sandbox…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Run Function
            </>
          )}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="glass p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Result</h2>
            <StatusBadge status={result.status} />
          </div>

          {/* Metrics row */}
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Clock className="w-3.5 h-3.5" />
              {result.execution_time_ms.toFixed(1)} ms
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Zap className="w-3.5 h-3.5" />
              {result.credits_charged} credits charged
            </div>
          </div>

          {result.output_result !== null && (
            <div className="glass-sm p-4 font-mono text-sm text-green-300 whitespace-pre-wrap break-all max-h-64 overflow-auto mb-3">
              {result.output_result || '(empty output)'}
            </div>
          )}

          {result.error_message && (
            <div className="glass-sm p-4 font-mono text-sm text-red-300 whitespace-pre-wrap break-all max-h-32 overflow-auto mb-3">
              {result.error_message}
            </div>
          )}

          <div className="flex items-start gap-2 mt-3">
            <Shield className="w-3.5 h-3.5 text-white/20 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-white/20 font-mono break-all">Job: {result.job_id}</p>
          </div>
        </div>
      )}
    </div>
  )
}
