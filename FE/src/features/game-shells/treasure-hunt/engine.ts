import type { GameSettings } from '@/types/app'

export type PlayerMood = 'idle' | 'run' | 'celebrate' | 'sad'

export interface TreasurePlayer {
  id: string
  name: string
  avatar: string
  assetId: string
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
  { id: 'player-1', name: '', avatar: '🧒', assetId: 'choice-01', color: '#e84233' },
  { id: 'player-2', name: '', avatar: '👧', assetId: 'choice-02', color: '#2b7fda' },
]

const PLAYER_1_PATH: PathPoint[] = [
  { x: 4.8, y: 47.8 },
  { x: 8.8, y: 48.5 },
  { x: 13.6, y: 49.6 },
  { x: 18.8, y: 50.6 },
  { x: 24.0, y: 50.2 },
  { x: 28.8, y: 49.0 },
  { x: 32.4, y: 47.6 },
  { x: 35.7, y: 45.6 },
  { x: 38.6, y: 42.2 },
  { x: 41.8, y: 37.8 },
  { x: 46.0, y: 40.6 },
  { x: 50.6, y: 41.8 },
  { x: 55.4, y: 44.8 },
  { x: 60.4, y: 48.2 },
  { x: 65.8, y: 49.0 },
  { x: 71.0, y: 47.2 },
  { x: 76.4, y: 39.8 },
  { x: 81.8, y: 40.8 },
  { x: 87.0, y: 43.0 },
  { x: 92.8, y: 45.4 },
]

const PLAYER_2_PATH: PathPoint[] = [
  { x: 4.8, y: 73.2 },
  { x: 7.3, y: 72.8 },
  { x: 10.3, y: 72.0 },
  { x: 14.8, y: 72.0 },
  { x: 21.6, y: 72.2 },
  { x: 28.8, y: 75.5 },
  { x: 35.7, y: 76.9 },
  { x: 42.3, y: 73.6 },
  { x: 47.3, y: 66.3 },
  { x: 51.2, y: 59.1 },
  { x: 56.2, y: 54.9 },
  { x: 62.4, y: 56.5 },
  { x: 68.8, y: 60.5 },
  { x: 74.9, y: 63.5 },
  { x: 80.8, y: 63.4 },
  { x: 85.8, y: 60.6 },
  { x: 89.6, y: 56.9 },
  { x: 92.7, y: 55.1 },
]

export function createTreasurePlayers(settings?: GameSettings, selectedAssetIds: string[] = []): TreasurePlayer[] {
  const count = 2

  return PLAYER_PRESETS.slice(0, count).map((player, index) => ({
    ...player,
    assetId: selectedAssetIds[index] ?? player.assetId,
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

  return {
    left: `${point.x}%`,
    top: `${Math.min(Math.max(point.y, 8), 88)}%`,
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
