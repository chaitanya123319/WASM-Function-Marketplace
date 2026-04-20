import axios from 'axios'

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  username: string
  email: string
  credits: number
  is_active: boolean
  is_node: boolean
}

export interface WasmFunction {
  id: string
  developer_id: string
  name: string
  description: string | null
  version: string
  ipfs_cid: string
  gateway_url: string
  file_size_bytes: number
  source_language: string
  price_per_call: number
  total_calls: number
  total_earnings: number
  is_public: boolean
  is_active: boolean
  created_at: string
}

export interface Job {
  id: string
  function_id: string | null
  consumer_id: string
  node_id: string | null
  status: string
  input_args: Record<string, unknown>
  output_result: string | null
  error_message: string | null
  credits_charged: number
  platform_fee: number
  developer_payout: number
  node_payout: number
  execution_signature: string | null
  execution_time_ms: number
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface InvokeResponse {
  job_id: string
  status: string
  output_result: string | null
  error_message: string | null
  execution_time_ms: number
  credits_charged: number
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const register = (data: { username: string; email: string; password: string }) =>
  apiClient.post<User>('/auth/register', data)

export const login = (username: string, password: string) => {
  const form = new URLSearchParams()
  form.set('username', username)
  form.set('password', password)
  return apiClient.post<{ access_token: string; token_type: string }>(
    '/auth/login',
    form,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )
}

export const getMe = () => apiClient.get<User>('/auth/me')

// ── Functions ─────────────────────────────────────────────────────────────────

export const listFunctions = (language?: string) =>
  apiClient.get<WasmFunction[]>('/functions/', { params: language ? { language } : {} })

export const listMyFunctions = () => apiClient.get<WasmFunction[]>('/functions/my')

export const getFunction = (id: string) => apiClient.get<WasmFunction>(`/functions/${id}`)

export const uploadFunction = (formData: FormData) =>
  apiClient.post<WasmFunction>('/functions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const invokeFunction = (id: string, args: Record<string, unknown>) =>
  apiClient.post<InvokeResponse>(`/functions/${id}/invoke`, { args })

export const deleteFunction = (id: string) => apiClient.delete(`/functions/${id}`)

// ── Jobs ──────────────────────────────────────────────────────────────────────

export const listJobs = () => apiClient.get<Job[]>('/jobs/')

export const getJob = (id: string) => apiClient.get<Job>(`/jobs/${id}`)
