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

const PLAYER_PRESETS = [
  { id: 'player-1', name: 'Alex', avatar: '🧒', color: '#f97316' },
  { id: 'player-2', name: 'Bella', avatar: '👧', color: '#0ea5e9' },
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
  const clamped = Math.min(Math.max(progress, 0), 100) / 100
  const pathIndex = laneIndex % 2
  const sharedProgress = Math.min(clamped, 0.24)
  const branchProgress = Math.max(0, (clamped - 0.24) / 0.76)
  const x = clamped < 0.24 ? 8 + sharedProgress * 92 : 30 + branchProgress * 62
  const sharedY = 78 - sharedProgress * 88
  const branchBaseY = pathIndex === 0 ? 33 : 70
  const branchWave = Math.sin(branchProgress * Math.PI * 2) * (pathIndex === 0 ? 11 : 9)
  const y = clamped < 0.24 ? sharedY + laneIndex * 2 : branchBaseY + branchWave

  return {
    left: `${x}%`,
    top: `${Math.min(Math.max(y, 12), 84)}%`,
  }
}
