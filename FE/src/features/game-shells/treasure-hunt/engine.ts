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
  { id: 'player-1', name: 'Hải tặc đỏ', avatar: '🧒', assetId: 'choice-01', color: '#e84233' },
  { id: 'player-2', name: 'Hải tặc xanh', avatar: '👧', assetId: 'choice-02', color: '#2b7fda' },
]

const PLAYER_1_PATH: PathPoint[] = [
  { x: 1.35, y: 36.32 },
  { x: 7.17, y: 39.32 },
  { x: 17.19, y: 41.45 },
  { x: 27.28, y: 38.68 },
  { x: 37.97, y: 20.94 },
  { x: 48.58, y: 20.51 },
  { x: 57.17, y: 33.33 },
  { x: 67.26, y: 36.32 },
  { x: 75.86, y: 27.78 },
  { x: 84.16, y: 33.76 },
  { x: 90.43, y: 50.43 },
]

const PLAYER_2_PATH: PathPoint[] = [
  { x: 1.35, y: 69.66 },
  { x: 8.97, y: 73.08 },
  { x: 18.31, y: 76.71 },
  { x: 29.9, y: 79.91 },
  { x: 39.61, y: 75.43 },
  { x: 46.34, y: 60.9 },
  { x: 52.32, y: 55.13 },
  { x: 61.29, y: 58.76 },
  { x: 70.25, y: 64.53 },
  { x: 74.74, y: 64.96 },
  { x: 87.29, y: 56.41 },
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
