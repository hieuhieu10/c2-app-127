/**
 * Local (browser) persistence for games created in the chat flow.
 *
 * The chat flow generates content via the AI backend and is otherwise ephemeral
 * (sessionStorage). Publishing saves the reviewed/edited game here so it survives
 * reloads and shows up in "My games" on this device. This is intentionally local
 * only — it does not sync to the BE_Web library.
 */
import type { SafetyReport } from '@/features/game-creation/ai-api'

const STORAGE_KEY = 'localGames'

export interface LocalGameMetadata {
  subject: string
  grade: number
  difficulty: string
  prompt: string
  elapsed_ms: number
}

export interface LocalGame {
  id: string
  templateId: string
  templateName: string
  content: Record<string, unknown>
  safetyReport: SafetyReport
  metadata: LocalGameMetadata
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
}

function readAll(): LocalGame[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LocalGame[]) : []
  } catch {
    return []
  }
}

function writeAll(games: LocalGame[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(games))
}

export function listLocalGames(): LocalGame[] {
  // Most recently updated first.
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getLocalGame(id: string): LocalGame | undefined {
  return readAll().find((g) => g.id === id)
}

/** Insert or update a game (matched by id) and return the stored record. */
export function saveLocalGame(
  game: Omit<LocalGame, 'createdAt' | 'updatedAt'> & { createdAt?: string },
): LocalGame {
  const now = new Date().toISOString()
  const all = readAll()
  const idx = all.findIndex((g) => g.id === game.id)
  const record: LocalGame = {
    ...game,
    createdAt: game.createdAt ?? (idx >= 0 ? all[idx].createdAt : now),
    updatedAt: now,
  }
  if (idx >= 0) all[idx] = record
  else all.push(record)
  writeAll(all)
  return record
}

export function deleteLocalGame(id: string): void {
  writeAll(readAll().filter((g) => g.id !== id))
}

export function newLocalGameId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `lg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
