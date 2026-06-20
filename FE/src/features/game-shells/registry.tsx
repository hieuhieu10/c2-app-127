/**
 * Single source of truth for games on the frontend.
 *
 * Each entry ties together everything the app needs for one game: its backend
 * template id, its `Game.templateType`, the marketing metadata shown in the chat
 * picker / template gallery, and the React shell that renders it.
 *
 * Adding a new game = write its shell component, then add ONE entry here. Both the
 * game-picker metadata (`@/features/game-creation/template-registry`) and the
 * shell dispatcher (`GameShell`) derive from this list.
 */
import type { ComponentType } from 'react'
import type { Game, GameTemplateType } from '@/types/app'
import { TreasureHuntShell } from './treasure-hunt/TreasureHuntShell'
import { BattleshipShell } from './battleship/BattleshipShell'

export interface ShellProps {
  game: Game
  previewMode?: boolean
  fullscreen?: boolean
}

export interface GameDefinition {
  /** Backend template id (matches the backend `GameSpec.id`), e.g. 'treasure_hunt'. */
  backendId: string
  /** Value carried on `Game.templateType` and used to dispatch the shell. */
  type: GameTemplateType
  title: string
  description: string
  icon: string
  itemCount: number
  interactionType: string
  bestFor: string
  example: string
  /** The component that renders this game. */
  Shell: ComponentType<ShellProps>
  /**
   * When true, the in-app preview can only show a summary (full play needs a
   * BE_Web-hosted game id). The chat preview hides its play toggle for these.
   */
  previewOnly?: boolean
}

export const GAMES: GameDefinition[] = [
  {
    backendId: 'treasure_hunt',
    type: 'press-the-button',
    title: 'Treasure Hunt',
    description: 'Players answer lesson questions to race along two map routes toward treasure caves',
    icon: '🗺️',
    itemCount: 10,
    interactionType: 'Turn-based map race',
    bestFor: 'Elementary lessons, quick recall, math facts, vocabulary, science concepts',
    example: 'Answer a multiplication or vocabulary question correctly to move 10% closer to a treasure cave.',
    Shell: TreasureHuntShell,
  },
  {
    backendId: 'battleship',
    type: 'battleship',
    title: 'Trivia Battleship',
    description: '2-player hot-seat game — answer trivia correctly to earn a shot at the opponent\'s grid',
    icon: '⚓',
    itemCount: 20,
    interactionType: '2-player turn-based combat',
    bestFor: 'Grades 6-12, competitive review, factual recall, vocabulary, cause & effect',
    example: 'Answer a history question correctly to bomb your opponent\'s fleet. Hit = free turn.',
    Shell: BattleshipShell,
  },
]

export function getGameByType(type: GameTemplateType): GameDefinition | undefined {
  return GAMES.find((g) => g.type === type)
}

export function getGameByBackendId(backendId: string): GameDefinition | undefined {
  return GAMES.find((g) => g.backendId === backendId)
}
