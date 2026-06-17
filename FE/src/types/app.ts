// User types
export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  createdAt: Date
}

export interface Session {
  user: User
  expiresAt: Date
}

// Game lesson types
export interface Lesson {
  id: string
  userId: string
  title: string
  subject: string
  grade: number
  gradeLevel: 'elementary' | 'middle' | 'high' | 'college'
  difficulty: 'easy' | 'medium' | 'hard'
  content: string
  gdptObjective?: string
  createdAt: Date
  updatedAt: Date
}

// Game template types
export type GameTemplateType =
  | 'press-the-button'
  | 'multiple-choice'
  | 'matching'
  | 'fill-in-blank'
  | 'ordering'
  | 'true-false'
  | 'battleship'

export interface GameTemplate {
  id: string
  type: GameTemplateType
  name: string
  description: string
  itemCount: number
}

// Game item types
export interface GameItem {
  id: string
  type: GameTemplateType
  question: string
  correctAnswer: string
  options?: string[]
  explanation: string
  validationStatus: 'pending' | 'valid' | 'invalid'
  validationErrors?: string[]
  faithfulnessScore?: number
  entailmentStatus?: 'entailed' | 'not-entailed' | 'ambiguous'
  distractorStatus?: 'verified-wrong' | 'needs-review' | 'not-applicable'
  safetyStatus?: 'safe' | 'blocked' | 'needs-review'
}

export interface GameSettings {
  numItems?: number
  playerCount?: 2
  mapTheme?: 'treasure-hunt'
}

// Game types
export interface Game {
  id: string
  lessonId: string
  templateType: GameTemplateType
  items: GameItem[]
  settings?: GameSettings
  status: 'draft' | 'validating' | 'generation_failed' | 'approved' | 'published'
  createdAt: Date
  updatedAt: Date
}

// Curriculum types
export interface GDPTObjective {
  code: string
  subject: string
  gradeLevel: string
  description: string
}
