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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, init)
  } catch {
    throw new Error(
      `Backend injoignable (${API_URL}). Vérifiez que l'API FastAPI est démarrée.`
    )
  }

  if (!response.ok) {
    let detail = `Erreur ${response.status}`

    try {
      const body = await response.json()
      if (typeof body.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((item: { msg?: string }) => item.msg)
          .join(' ; ')
      }
    } catch {
      // corps de réponse non JSON : on garde le code HTTP
    }

    throw new Error(detail)
  }

  return response.json() as Promise<T>
}

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
  features: Record<string, number>
) =>
  request<PredictionResult>('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, features }),
  })

export const predictFile = (file: File, model: string) => {
  const form = new FormData()
  form.append('file', file)

  return request<FilePrediction>(
    `/predict-file?model=${encodeURIComponent(model)}`,
    { method: 'POST', body: form }
  )
}
