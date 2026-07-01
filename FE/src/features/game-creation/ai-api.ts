const AI_BASE = process.env.NEXT_PUBLIC_AI_URL || 'http://localhost:8000'
const API_DEBUG = process.env.NEXT_PUBLIC_API_DEBUG === 'true'

export type StageStatus = 'pending' | 'running' | 'done' | 'warning' | 'error'

export interface StageEvent {
  type: 'stage'
  id: string
  label: string
  subtitle: string
  tag: string | null
  status: StageStatus
  elapsed_ms?: number
  detail?: Record<string, unknown>
}

export interface SafetyCheck {
  id: string
  label: string
  detail: string
  status: 'pass' | 'warning' | 'fixed' | 'fail'
}

export interface SafetyReport {
  overall: 'pass' | 'warning' | 'fail'
  checks: SafetyCheck[]
  schema_valid: boolean
}

export interface SafetyEvent {
  type: 'safety'
  report: SafetyReport
  elapsed_ms: number
}

export interface CompleteEvent {
  type: 'complete'
  template_id: string
  template_name: string
  content: Record<string, unknown>
  safety_report: SafetyReport
  elapsed_ms: number
}

export interface ErrorEvent {
  type: 'error'
  message: string
}

export type StreamEvent = StageEvent | SafetyEvent | CompleteEvent | ErrorEvent

export interface GenerateStreamInput {
  subject: string
  grade: number
  difficulty: 'easy' | 'medium' | 'hard'
  prompt: string
  num_items?: number
  objective_id?: string
  source_text?: string
  uploaded_file_id?: string
  upload_type?: 'none' | 'lesson_plan' | 'slide'
  override_template?: string
}

export interface GameRecommendation {
  template_id: string
  name: string
  intro: string
  recommended: boolean
}

export interface RecommendGamesResponse {
  recommendations: GameRecommendation[]
  blocked?: boolean
  message?: string
  suggestion?: string
}

export interface RecommendGamesInput {
  subject: string
  grade: number
  difficulty: 'easy' | 'medium' | 'hard'
  prompt: string
  source_text?: string
  uploaded_file_id?: string
  upload_type?: 'none' | 'lesson_plan' | 'slide'
}

export class GuardrailError extends Error {
  suggestion: string
  constructor(message: string, suggestion: string) {
    super(message)
    this.name = 'GuardrailError'
    this.suggestion = suggestion
  }
}

export async function recommendGames(input: RecommendGamesInput): Promise<GameRecommendation[]> {
  debugLog('BE_AI -> POST /recommend/games', input)
  const res = await fetch(`${AI_BASE}/recommend/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    let detail = `Không lấy được đề xuất trò chơi: ${res.status}`
    try { detail = (await res.json()).detail || detail } catch { /* keep status message */ }
    throw new Error(detail)
  }
  const data = (await res.json()) as RecommendGamesResponse
  debugLog('BE_AI <- POST /recommend/games', data)
  if (data.blocked) {
    throw new GuardrailError(
      data.message || 'Yêu cầu không hợp lệ.',
      data.suggestion || 'Vui lòng điều chỉnh và nhập lại yêu cầu.'
    )
  }
  return data.recommendations
}

export async function* streamGenerate(input: GenerateStreamInput): AsyncGenerator<StreamEvent> {
  debugLog('BE_AI -> POST /generate/stream', input)
  const res = await fetch(`${AI_BASE}/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok || !res.body) {
    throw new Error(`Kết nối thất bại: ${res.status}`)
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const part of parts) {
      const line = part.trim()
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as StreamEvent
          debugLog('BE_AI <- SSE /generate/stream', event)
          yield event
        } catch { /* skip */ }
      }
    }
  }
}

function debugLog(label: string, payload: unknown) {
  if (!API_DEBUG) return
  console.debug(`[API DEBUG] ${label}`, redact(payload))
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const normalized = key.toLowerCase().replaceAll('-', '_')
      if (['authorization', 'cookie', 'password', 'token', 'api_key', 'secret'].some(s => normalized.includes(s))) {
        return [key, '<redacted>']
      }
      return [key, redact(item)]
    }))
  }
  return value
}
