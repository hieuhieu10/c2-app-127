import type { Game, GameItem, GameTemplateType, Lesson } from '@/types/app'

const BE_WEB_BASE_URL = process.env.NEXT_PUBLIC_BE_WEB_URL || 'http://localhost:8001'
const ACCESS_TOKEN_KEY = 'be_web_access_token'

export interface BeWebGameItem {
  id: number
  orderIndex: number
  question: string
  correctAnswer: string
  options: string[]
  explanation?: string | null
  hint?: string | null
  validationStatus: 'pending' | 'valid' | 'invalid'
  validationErrors: string[]
}

export interface BeWebGame {
  lessonId: number
  gameId: number
  status: 'draft' | 'generation_failed' | 'approved' | 'published'
  productTemplateId: string
  aiTemplateId: string
  title: string
  input: string
  subject: string
  grade: number
  difficulty: 'easy' | 'medium' | 'hard'
  objectiveId?: string | null
  settings: {
    numItems?: number
    playerCount?: 2
    mapTheme?: 'treasure-hunt'
  }
  items: BeWebGameItem[]
}

export interface BeWebGameSummary {
  gameId: number
  lessonId: number
  title: string
  input: string
  status: 'draft' | 'generation_failed' | 'approved' | 'published'
  productTemplateId: string
  aiTemplateId: string
  subject: string
  grade: number
  difficulty: 'easy' | 'medium' | 'hard'
  itemCount: number
  createdAt: string
  updatedAt: string
}

export interface GenerateGameInput {
  title: string
  input: string
  product_template_id?: string
  num_items?: number
  subject?: string
  grade?: number
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface AuthUser {
  id: number
  email: string
  name: string | null
  avatarUrl?: string | null
  createdAt: string
}

export interface AuthResponse {
  user: AuthUser
  accessToken: string
}

export interface UpdateProfileInput {
  name: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken()
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const response = await fetch(`${BE_WEB_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let detail = `BE_Web request failed with ${response.status}`
    try {
      const body = await response.json()
      detail = body.detail || detail
    } catch {
      // Keep the status-based message when the backend does not return JSON.
    }
    throw new Error(detail)
  }

  return response.json() as Promise<T>
}

export const beWebApi = {
  signUp(input: { name: string; email: string; password: string }) {
    return request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  signIn(input: { email: string; password: string }) {
    return request<AuthResponse>('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  me() {
    return request<AuthUser>('/api/auth/me')
  },

  updateMe(input: UpdateProfileInput) {
    return request<AuthUser>('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },

  changePassword(input: ChangePasswordInput) {
    return request<{ success: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  uploadAvatar(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return request<AuthUser>('/api/auth/me/avatar', {
      method: 'POST',
      body: formData,
    })
  },

  signOut() {
    return request<{ success: boolean }>('/api/auth/signout', {
      method: 'POST',
    })
  },

  generateGame(input: GenerateGameInput) {
    return request<BeWebGame>('/api/games/generate', {
      method: 'POST',
      body: JSON.stringify({
        num_items: 10,
        subject: 'General',
        difficulty: 'medium',
        grade: 3,
        product_template_id: 'treasure_hunt',
        ...input,
      }),
    })
  },

  getBattleshipPlayUrl(gameId: string | number): string {
    const token = getAccessToken()
    return `${BE_WEB_BASE_URL}/api/games/${gameId}/play${token ? `?token=${encodeURIComponent(token)}` : ''}`
  },

  getGame(gameId: string | number) {
    return request<BeWebGame>(`/api/games/${gameId}`)
  },

  listGames() {
    return request<BeWebGameSummary[]>('/api/games')
  },

  updateItem(gameId: string | number, itemId: string | number, item: Partial<GameItem>) {
    return request<BeWebGameItem>(`/api/games/${gameId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        question: item.question,
        correctAnswer: item.correctAnswer,
        options: item.options,
        explanation: item.explanation,
      }),
    })
  },

  recheckItem(gameId: string | number, itemId: string | number) {
    return request<BeWebGameItem>(`/api/games/${gameId}/items/${itemId}/recheck`, {
      method: 'POST',
    })
  },

  approveGame(gameId: string | number) {
    return request<{ gameId: number; status: Game['status'] }>(`/api/games/${gameId}/approve`, {
      method: 'POST',
    })
  },

  publishGame(gameId: string | number) {
    return request<{ gameId: number; status: Game['status'] }>(`/api/games/${gameId}/publish`, {
      method: 'POST',
    })
  },
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function mapAuthUser(user: AuthUser): {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  createdAt: Date
} {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name || user.email.split('@')[0],
    avatarUrl: resolveBeWebAssetUrl(user.avatarUrl),
    createdAt: new Date(user.createdAt),
  }
}

export function mapBeWebLesson(game: BeWebGame): Lesson {
  return {
    id: String(game.lessonId),
    userId: 'be-web',
    title: game.title,
    subject: game.subject,
    grade: game.grade,
    gradeLevel: numericGradeToLevel(game.grade),
    difficulty: game.difficulty,
    content: game.input,
    gdptObjective: game.objectiveId || undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function mapBeWebGame(game: BeWebGame): Game {
  const templateType = productTemplateToGameTemplate(game.productTemplateId)
  return {
    id: String(game.gameId),
    lessonId: String(game.lessonId),
    templateType,
    items: game.items.map((item) => mapBeWebItem(item, templateType)),
    settings: {
      numItems: game.settings?.numItems,
      playerCount: 2,
      mapTheme: game.settings?.mapTheme ?? 'treasure-hunt',
    },
    status: game.status === 'draft' ? 'validating' : game.status,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export function mapBeWebItem(item: BeWebGameItem, templateType?: GameTemplateType): GameItem {
  return {
    id: String(item.id),
    type: templateType ?? 'press-the-button',
    question: item.question,
    correctAnswer: item.correctAnswer,
    options: item.options,
    explanation: item.explanation || '',
    hint: item.hint || undefined,
    validationStatus: item.validationStatus,
    validationErrors: item.validationErrors,
    faithfulnessScore: item.validationStatus === 'valid' ? 0.9 : 0,
    entailmentStatus: item.validationStatus === 'valid' ? 'entailed' : 'ambiguous',
    distractorStatus: item.validationStatus === 'valid' ? 'verified-wrong' : 'needs-review',
    safetyStatus: item.validationStatus === 'invalid' ? 'needs-review' : 'safe',
  }
}

function productTemplateToGameTemplate(productTemplateId: string): GameTemplateType {
  if (productTemplateId === 'treasure_hunt') return 'press-the-button'
  if (productTemplateId === 'battleship') return 'battleship'
  if (productTemplateId === 'feed_the_cats') return 'feed-the-cats'
  if (productTemplateId === 'cat_jump') return 'cat-jump'
  return 'multiple-choice'
}

function numericGradeToLevel(grade: number): Lesson['gradeLevel'] {
  if (grade <= 5) return 'elementary'
  if (grade <= 8) return 'middle'
  if (grade <= 12) return 'high'
  return 'college'
}

function resolveBeWebAssetUrl(path?: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${BE_WEB_BASE_URL}${path}`
}
