import type { GameSettings } from '@/types/app'

export type PlayerMood = 'idle' | 'run' | 'celebrate' | 'sad'

export interface TreasurePlayer {
  id: string
  name: string
  avatar: string
  color: string
  position: number
  correctAnswers: number
  score: number
  mood: PlayerMood
}

export const FINISH_POSITION = 50

interface PathPoint {
  x: number
  y: number
}

const PLAYER_PRESETS = [
  { id: 'player-1', name: 'An', avatar: '🧒', color: '#f97316' },
  { id: 'player-2', name: 'Bống', avatar: '👧', color: '#0ea5e9' },
]

const PLAYER_1_PATH: PathPoint[] = [
  { x: 8, y: 79 },
  { x: 17, y: 63 },
  { x: 30, y: 57 },
  { x: 42, y: 45 },
  { x: 55, y: 33 },
  { x: 70, y: 36 },
  { x: 88, y: 34 },
]

const PLAYER_2_PATH: PathPoint[] = [
  { x: 8, y: 79 },
  { x: 17, y: 63 },
  { x: 30, y: 57 },
  { x: 42, y: 65 },
  { x: 56, y: 72 },
  { x: 72, y: 69 },
  { x: 88, y: 71 },
]

export function createTreasurePlayers(settings?: GameSettings): TreasurePlayer[] {
  const count = 2

  return PLAYER_PRESETS.slice(0, count).map((player) => ({
    ...player,
    position: 0,
    correctAnswers: 0,
    score: 0,
    mood: 'idle',
  }))
}

export function getMovePercent(totalQuestions: number): number {
  return 100 / Math.max(totalQuestions, 1)
}

export function movePlayerAfterAnswer(
  players: TreasurePlayer[],
  activePlayerId: string,
  isCorrect: boolean,
  totalQuestions: number
): TreasurePlayer[] {
  return players.map((player) => {
    if (player.id !== activePlayerId) {
      return { ...player, mood: 'idle' }
    }

    if (!isCorrect) {
      return { ...player, mood: 'sad' }
    }

    const nextPosition = Math.min(FINISH_POSITION, player.position + getMovePercent(totalQuestions))
    return {
      ...player,
      position: nextPosition,
      correctAnswers: player.correctAnswers + 1,
      score: player.score + 100,
      mood: nextPosition >= FINISH_POSITION ? 'celebrate' : 'run',
    }
  })
}

export function rankPlayers(players: TreasurePlayer[]): TreasurePlayer[] {
  return [...players].sort(
    (a, b) =>
      b.position - a.position ||
      b.correctAnswers - a.correctAnswers ||
      b.score - a.score ||
      a.name.localeCompare(b.name)
  )
}

export function getWinner(players: TreasurePlayer[]): TreasurePlayer {
  return rankPlayers(players)[0]
}

export function getPathPoint(progress: number, laneIndex: number, laneCount: number) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100)
  const path = laneIndex % 2 === 0 ? PLAYER_1_PATH : PLAYER_2_PATH
  const point = interpolatePath(path, clampedProgress)
  const startOffsetStrength = Math.max(0, 1 - clampedProgress / 22)
  const startOffset = laneIndex % 2 === 0 ? -2.2 : 2.2
  const y = point.y + startOffset * startOffsetStrength

  return {
    left: `${point.x}%`,
    top: `${Math.min(Math.max(y, 12), 84)}%`,
  }
}

function interpolatePath(path: PathPoint[], progress: number): PathPoint {
  if (path.length === 0) return { x: 0, y: 0 }
  if (path.length === 1) return path[0]

  const segmentLengths = path.slice(1).map((point, index) => {
    const previous = path[index]
    return Math.hypot(point.x - previous.x, point.y - previous.y)
  })
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0)
  let distance = (Math.min(Math.max(progress, 0), 100) / 100) * totalLength

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index]
    const start = path[index]
    const end = path[index + 1]

    if (distance <= segmentLength) {
      const ratio = segmentLength === 0 ? 0 : distance / segmentLength
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      }
    }

    distance -= segmentLength
  }

  return path[path.length - 1]
}
