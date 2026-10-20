export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export type ModelStatus = {
  name: string
  loaded: boolean
  error: string | null
}

export type Health = {
  status: string
  models_ready: boolean
  default_model: string
  threshold: number
  models: ModelStatus[]
}

export type PredictionResult = {
  model: string
  probability: number
  risk_score: number
  is_fraud: boolean
  threshold: number
  risk_level: string
}

export type FileRow = {
  index: number
  probability: number
  risk_score: number
  is_fraud: boolean
}

export type FilePrediction = {
  model: string
  threshold: number
  count: number
  fraud_count: number
  rows: FileRow[]
}

// ------------------------------------------------------------- session
const TOKEN_KEY = 'fraudshield.token'

/** Jeton JWT de la session (onglet courant). */
export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // stockage indisponible : la session durera le temps de la page
  }
}

/** Émis quand le serveur refuse le jeton (session expirée ou révoquée). */
export const SESSION_EXPIRED_EVENT = 'fraudshield:session-expired'

export type FieldError = { field: string | null; message: string }

/** Erreur d'API avec, si disponible, l'erreur de chaque champ du formulaire. */
export class ApiError extends Error {
  status: number
  fieldErrors: Record<string, string>

  constructor(message: string, status: number, errors: FieldError[] = []) {
    super(message)
    this.status = status
    this.fieldErrors = Object.fromEntries(
      errors.filter((e) => e.field).map((e) => [e.field as string, e.message])
    )
  }
}

function authHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

async function toApiError(response: Response): Promise<ApiError> {
  let detail = `Erreur ${response.status}`
  let errors: FieldError[] = []

  try {
    const body = await response.json()
    if (typeof body.detail === 'string') {
      detail = body.detail
    } else if (Array.isArray(body.detail)) {
      detail = body.detail
        .map((item: { msg?: string }) => item.msg)
        .join(' ; ')
    }
    if (Array.isArray(body.errors)) errors = body.errors
  } catch {
    // corps de réponse non JSON : on garde le code HTTP
  }

  if (response.status === 401 && getToken()) {
    setToken(null)
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  return new ApiError(detail, response.status, errors)
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: authHeaders(init?.headers),
    })
  } catch {
    throw new ApiError(
      `Backend injoignable (${API_URL}). Vérifiez que l'API FastAPI est démarrée.`,
      0
    )
  }

  if (!response.ok) throw await toApiError(response)
  return response
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await send(path, init)).json() as Promise<T>
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

/** Télécharge un fichier protégé (l'en-tête d'authentification est ajouté). */
export async function downloadFile(path: string, fallbackName: string) {
  const response = await send(path)
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match?.[1] ?? fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const qs = (params: Record<string, string | number | undefined | null>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')

// ----------------------------------------------------------- comptes
export type Role = 'analyste' | 'expert' | 'admin'

export type User = {
  id: number
  username: string
  email: string
  full_name: string | null
  role: Role
  role_label: string
  is_active: boolean
  locked: boolean
  last_login_at: string | null
  created_at: string
}

export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

export const loginRequest = (identifier: string, password: string) =>
  request<TokenResponse>('/auth/login', json('POST', { identifier, password }))

export const registerRequest = (data: {
  username: string
  email: string
  password: string
  password_confirm: string
  full_name?: string
}) => request<TokenResponse>('/auth/register', json('POST', data))

export const fetchMe = () => request<User>('/auth/me')

export const logoutRequest = () => request<{ detail: string }>('/auth/logout', json('POST'))

export const changePassword = (data: {
  current_password: string
  new_password: string
  new_password_confirm: string
}) => request<TokenResponse>('/auth/password', json('PUT', data))

export type Page<T> = { total: number; page: number; page_size: number; rows: T[] }

export const fetchUsers = (params: { q?: string; role?: string; status?: string; page?: number }) =>
  request<Page<User> & { roles: Role[] }>(`/users?${qs(params)}`)

export const createUser = (data: {
  username: string
  email: string
  password: string
  role: Role
  full_name?: string | null
  is_active: boolean
}) => request<User>('/users', json('POST', data))

export const updateUser = (
  id: number,
  data: Partial<{
    email: string
    full_name: string | null
    role: Role
    is_active: boolean
    password: string
    unlock: boolean
  }>
) => request<User>(`/users/${id}`, json('PUT', data))

export const deleteUser = (id: number) =>
  request<{ detail: string }>(`/users/${id}`, json('DELETE'))

// ------------------------------------------------------- transactions
export type StoredTransaction = {
  id: number
  reference: string | null
  description: string | null
  amount: number
  time: number
  true_label: 0 | 1 | null
  source: string
  dataset_row: number | null
  last_model: string | null
  last_probability: number | null
  last_risk_score: number | null
  last_is_fraud: boolean | null
  last_analyzed_at: string | null
  created_at: string
  updated_at: string
  features?: Record<string, number>
}

export type TransactionPayload = {
  features: Record<string, number>
  reference?: string | null
  description?: string | null
  true_label?: 0 | 1 | null
  source?: string
  dataset_row?: number | null
}

export const fetchTransactions = (params: {
  q?: string
  label?: string
  verdict?: string
  page?: number
  page_size?: number
}) => request<Page<StoredTransaction>>(`/transactions?${qs(params)}`)

export const fetchTransaction = (id: number) =>
  request<StoredTransaction>(`/transactions/${id}`)

export const createTransaction = (data: TransactionPayload) =>
  request<StoredTransaction>('/transactions', json('POST', data))

export const updateTransaction = (
  id: number,
  data: Partial<TransactionPayload> & { clear_label?: boolean }
) => request<StoredTransaction>(`/transactions/${id}`, json('PUT', data))

export const deleteTransaction = (id: number) =>
  request<{ detail: string }>(`/transactions/${id}`, json('DELETE'))

export const analyzeTransaction = (id: number, model: string) =>
  request<PredictionResult & { transaction: StoredTransaction; analysis_id: number }>(
    `/transactions/${id}/analyze?${qs({ model })}`,
    json('POST')
  )

// --------------------------------------------------------- historique
export type HistoryEntry = {
  id: number
  kind: string
  kind_label: string
  model: string | null
  threshold: number | null
  filename: string | null
  transaction_id: number | null
  total: number
  fraud_count: number
  summary: Record<string, unknown> | null
  created_at: string
  username: string | null
}

export type HistoryDetail = HistoryEntry & {
  page: number
  page_size: number
  labelled: number
  correct: number
  results: {
    row_index: number
    amount: number
    probability: number
    risk_score: number
    is_fraud: boolean
    true_label: 0 | 1 | null
    risk_level: string
  }[]
}

export const fetchHistory = (params: {
  kind?: string
  model?: string
  date_from?: string
  date_to?: string
  page?: number
}) =>
  request<Page<HistoryEntry> & { kinds: Record<string, string>; models: string[] }>(
    `/history?${qs(params)}`
  )

export const fetchHistoryEntry = (id: number, page = 1) =>
  request<HistoryDetail>(`/history/${id}?${qs({ page, page_size: 50 })}`)

export const deleteHistoryEntry = (id: number) =>
  request<{ detail: string }>(`/history/${id}`, json('DELETE'))

export const exportHistoryEntry = (id: number) =>
  downloadFile(`/history/${id}/export`, `fraudshield_analyse_${id}.csv`)

// ------------------------------------------------------ journal d'audit
export type AuditEntry = {
  id: number
  created_at: string
  username: string | null
  action: string
  action_label: string
  target: string | null
  success: boolean
  ip: string | null
  details: Record<string, unknown> | null
}

export const fetchAudit = (params: {
  action?: string
  username?: string
  outcome?: string
  date_from?: string
  date_to?: string
  page?: number
}) =>
  request<Page<AuditEntry> & { actions: Record<string, string> }>(`/audit?${qs(params)}`)

export const fetchHealth = () => request<Health>('/health')

// ------------------------------------------------------- Jeu de données
export type SplitName = 'train' | 'validation' | 'test' | 'doublon'

export type DatasetStatus = {
  available: boolean
  expected_path?: string
  hint?: string
  error?: string
  path?: string
  size_mb?: number
  rows?: number
  frauds?: number
  splits?: Record<SplitName, { rows: number; frauds: number }>
}

export type DatasetRow = {
  id: number
  split: SplitName
  label: 0 | 1
  time: number
  amount: number
  features?: Record<string, number>
}

export type DatasetPage = {
  total: number
  page: number
  page_size: number
  rows: DatasetRow[]
}

export const fetchDatasetStatus = () =>
  request<DatasetStatus>('/dataset/status')

export const fetchDatasetPage = (params: {
  split: string
  label: string
  page: number
  pageSize: number
}) =>
  request<DatasetPage>(
    `/dataset/transactions?split=${params.split}&label=${params.label}` +
      `&page=${params.page}&page_size=${params.pageSize}`
  )

export const fetchDatasetRow = (id: number) =>
  request<DatasetRow>(`/dataset/transactions/${id}`)

export const fetchRandomRow = (label: string, split: string) =>
  request<DatasetRow>(`/dataset/random?label=${label}&split=${split}`)

/** Import de creditcard.csv avec progression (fetch n'expose pas l'envoi). */
export function uploadDataset(
  file: File,
  onProgress: (fraction: number) => void
): Promise<DatasetStatus> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/dataset/upload`)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onerror = () =>
      reject(new Error(`Backend injoignable (${API_URL}).`))
    xhr.onload = () => {
      let body: { detail?: string } & Partial<DatasetStatus> = {}
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // réponse non JSON
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as DatasetStatus)
      } else {
        reject(new Error(body.detail ?? `Erreur ${xhr.status}`))
      }
    }

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

export type CompareResult = {
  threshold: number
  fraud_votes: number
  models_scored: number
  results: {
    model: string
    loaded: boolean
    probability?: number
    risk_score?: number
    is_fraud?: boolean
  }[]
}

export const predictAll = (features: Record<string, number>) =>
  request<CompareResult>('/predict-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ features }),
  })

export type EvaluationResult = {
  model: string
  split: string
  threshold: number
  rows: number
  frauds: number
  metrics: {
    tn: number
    fp: number
    fn: number
    tp: number
    accuracy: number
    precision: number
    recall: number
    f1: number
    mcc: number
    ap: number
    roc_auc: number
  }
  reference: {
    source: string
    tp: number
    fp: number
    fn: number
    precision: number
    recall: number
    f1: number
    ap: number
    mcc: number
    matches: boolean
  } | null
}

export const fetchEvaluation = (model: string, split: string) =>
  request<EvaluationResult>(
    `/dataset/evaluation?model=${encodeURIComponent(model)}&split=${split}`
  )

// ---------------------------------------------------------------- Dashboard
export type DashboardData = {
  period: string
  totals: {
    analyzed: number
    fraud: number
    normal: number
    fraud_rate: number
    all_time: number
  }
  series: { label: string; total: number; alerts: number }[]
  by_model: { model: string; total: number; fraud: number }[]
  alerts: {
    id: string
    at: string
    model: string
    amount: number
    score: number
    risk: string
  }[]
  platform: {
    models_ready: boolean
    default_model: string
    threshold: number
    models: ModelStatus[]
  }
}

export const fetchDashboard = (period: string) =>
  request<DashboardData>(`/dashboard?period=${encodeURIComponent(period)}`)

export type DatasetInfo = {
  available: boolean
  source?: string
  transactions?: number
  normal?: number
  fraud?: number
  fraud_rate?: number
  duplicates?: number
}

export const fetchDataset = () => request<DatasetInfo>('/results/dataset')

// ------------------------------------------------- Résultats du mémoire
export type ModelMetrics = {
  name: string
  accuracy: number | null
  precision: number | null
  recall: number | null
  f1: number | null
  rocAuc: number | null
  prAuc: number | null
}

export type ModelsResults = {
  available: boolean
  stages: {
    id: string
    label: string
    source: string
    models: ModelMetrics[]
  }[]
}

export const fetchModelsResults = () =>
  request<ModelsResults>('/results/models')

export type AttackRow = {
  model: string
  attacks: number
  successes: number
  asr: number
  ci_low: number | null
  ci_high: number | null
  mean_l2: number | null
  mean_linf: number | null
  mean_l2_success: number | null
  mean_linf_success: number | null
  mean_queries: number | null
  mean_time_s: number | null
  recall_clean: number | null
  recall_after: number | null
  fn_clean: number | null
  fn_after: number | null
  tp_clean: number | null
  tp_after: number | null
}

export type RobustnessResults = {
  available: boolean
  source?: string
  attacks: { ZOO: AttackRow[]; HSJ: AttackRow[] }
}

export const fetchRobustness = () =>
  request<RobustnessResults>('/results/robustness')

export type DefenseRow = {
  model: string
  version: string
  hsj_before: number | null
  hsj_after: number | null
  hsj_gain_points: number | null
  hsj_relative_reduction: number | null
  zoo_before: number | null
  zoo_after: number | null
  clean_recall_original: number | null
  clean_recall_defended: number | null
  f1_original: number | null
  f1_defended: number | null
  fn_original: number | null
  fn_defended: number | null
  clean_retention: number | null
  clean_gate: boolean | null
  robust_gain: boolean | null
  passed: boolean | null
  train_size: number | null
  adversarial_examples: number | null
  training_time_s: number | null
}

export type DefenseResults = {
  available: boolean
  source?: string
  models: DefenseRow[]
}

export const fetchDefense = () => request<DefenseResults>('/results/defense')

export type FinalModelResults = {
  available: boolean
  selected_model: string
  defense_version: string
  selection: {
    dataset: string
    rule: string
    criteria: string[]
    weights: Record<string, number>
    primary_score: number
    pareto_efficient: boolean
    near_tie: boolean
    relative_gap_to_second: number
    stability: string
    test_used_for_ranking: boolean
    threshold_optimized: boolean
    retrained: boolean
  }
  validation: Record<string, number>
  test_clean: Record<string, number>
  test_hsj: { ASR: number; Robustness: number }
  ranking: {
    rank: number
    model: string
    version: string
    ap: number
    f1: number
    recall: number
    hsj_robustness: number
    score: number
    pareto: boolean
  }[]
  candidates_validation: {
    model: string
    version: string
    ap: number
    precision: number
    recall: number
    f1: number
    mcc: number
    roc_auc: number
    fp: number
    fn: number
    tp: number
    hsj_asr: number
    hsj_robustness: number
  }[]
  hybrid_check: {
    decision: {
      selected: string
      best_hybrid: string
      relative_gain: number
      reason: string
      exploratory: boolean
    }
    limitations: string[]
  } | null
  deployment: {
    model_file_loaded: boolean
    detail: string | null
    threshold: number
  }
}

export const fetchFinalModel = () =>
  request<FinalModelResults>('/results/final-model')

export const predictTransaction = (
  model: string,
  features: Record<string, number>,
  source?: { true_label: 0 | 1; dataset_row: number } | null
) =>
  request<PredictionResult & { analysis_id: number }>('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, features, ...(source ?? {}) }),
  })

export const predictFile = (file: File, model: string) => {
  const form = new FormData()
  form.append('file', file)

  return request<FilePrediction>(
    `/predict-file?model=${encodeURIComponent(model)}`,
    { method: 'POST', body: form }
  )
}
