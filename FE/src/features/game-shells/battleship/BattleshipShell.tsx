'use client'

import type { Game } from '@/types/app'
import { beWebApi } from '@/features/game-library/services/be-web'

interface BattleshipShellProps {
  game: Game
  previewMode?: boolean
}

export function BattleshipShell({ game, previewMode = false }: BattleshipShellProps) {
  const playUrl = beWebApi.getBattleshipPlayUrl(game.id)

  if (previewMode) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/20 p-6 text-center">
        <div className="text-4xl">⚓</div>
        <div className="font-semibold">Trivia Battleship</div>
        <p className="text-sm text-muted-foreground">
          {game.items.length} questions loaded. Launch the game to play.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border" style={{ height: '80vh' }}>
      <iframe
        src={playUrl}
        title="Trivia Battleship"
        className="h-full w-full border-0"
        allow="fullscreen"
      />
    </div>
  )
}
