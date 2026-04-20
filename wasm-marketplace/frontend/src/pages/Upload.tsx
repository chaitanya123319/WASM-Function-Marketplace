import { useState, useRef, DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, FileCode, CheckCircle, AlertCircle, CloudUpload } from 'lucide-react'
import { uploadFunction, type WasmFunction } from '../services/api'

const LANGUAGES = ['rust', 'go', 'c', 'zig']

export default function Upload() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WasmFunction | null>(null)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    source_language: 'rust',
    price_per_call: '1.0',
    is_public: true,
  })

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.wasm')) setFile(dropped)
    else setError('Please drop a .wasm file')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return setError('Please select a .wasm file')

    setLoading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', form.name)
      fd.append('description', form.description)
      fd.append('version', form.version)
      fd.append('source_language', form.source_language)
      fd.append('price_per_call', form.price_per_call)
      fd.append('is_public', String(form.is_public))

      const res = await uploadFunction(fd)
      setResult(res.data)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto animate-slide-up">
        <div className="glass p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-1">Upload Successful!</h2>
          <p className="text-white/40 mb-6">Your WASM function is now live on IPFS</p>

          <div className="glass-sm p-4 text-left space-y-3 mb-6">
            <div>
              <p className="text-xs text-white/30 mb-1">IPFS Content ID (CID)</p>
              <p className="font-mono text-brand-300 text-sm break-all">{result.ipfs_cid}</p>
            </div>
            <div>
              <p className="text-xs text-white/30 mb-1">Gateway URL</p>
              <a
                href={result.gateway_url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-brand-400 text-xs break-all hover:text-brand-300 underline"
              >
                {result.gateway_url}
              </a>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-white/30 mb-1">Size</p>
                <p className="text-sm font-semibold">{(result.file_size_bytes / 1024).toFixed(1)} KB</p>
              </div>
              <div>
                <p className="text-xs text-white/30 mb-1">Price / Call</p>
                <p className="text-sm font-semibold text-brand-400">{result.price_per_call} cr</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button id="go-invoke" onClick={() => navigate(`/invoke/${result.id}`)} className="btn-primary">
              <UploadIcon className="w-4 h-4" /> Invoke Now
            </button>
            <button id="go-my-fns" onClick={() => navigate('/my-functions')} className="btn-secondary">
              My Functions
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="section-title gradient-text mb-1">Upload Function</h1>
      <p className="text-white/40 text-sm mb-8">
        Compile your code to WASM and upload it. Binaries are stored on IPFS via Pinata.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dropzone */}
        <div
          id="wasm-dropzone"
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-brand-500 bg-brand-600/10 scale-[1.01]'
              : file
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-white/10 hover:border-brand-500/40 hover:bg-brand-600/5'
            }`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".wasm"
            className="hidden"
            onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
          />
          {file ? (
            <>
              <FileCode className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="font-semibold text-green-300">{file.name}</p>
              <p className="text-xs text-white/30 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </>
          ) : (
            <>
              <CloudUpload className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="font-semibold text-white/50">Drop your .wasm file here</p>
              <p className="text-xs text-white/30 mt-1">or click to browse</p>
            </>
          )}
        </div>

        {/* Form fields */}
        <div className="glass p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5">Function Name *</label>
              <input
                id="fn-name"
                className="input"
                placeholder="my-sorter"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5">Version</label>
              <input
                id="fn-version"
                className="input"
                placeholder="1.0.0"
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/50 mb-1.5">Description</label>
            <textarea
              id="fn-description"
              className="input resize-none h-20"
              placeholder="What does this function do?"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5">Source Language</label>
              <select
                id="fn-language"
                className="input"
                value={form.source_language}
                onChange={e => setForm(f => ({ ...f, source_language: e.target.value }))}
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 mb-1.5">Price / Call (credits)</label>
              <input
                id="fn-price"
                type="number"
                step="0.1"
                min="0.1"
                className="input"
                value={form.price_per_call}
                onChange={e => setForm(f => ({ ...f, price_per_call: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              id="fn-public"
              type="checkbox"
              className="w-4 h-4 rounded accent-brand-500"
              checked={form.is_public}
              onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))}
            />
            <span className="text-sm text-white/60">List publicly in marketplace</span>
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          id="submit-upload"
          type="submit"
          disabled={loading || !file}
          className="btn-primary w-full justify-center py-3"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploading to Pinata IPFS…
            </>
          ) : (
            <>
              <UploadIcon className="w-4 h-4" />
              Upload to IPFS
            </>
          )}
        </button>
      </form>
    </div>
  )
}
