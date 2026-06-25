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
import { FeedTheCatsShell } from './feed-the-cats/FeedTheCatsShell'
import { CatJumpShell } from './cat-jump/CatJumpShell'
import { BeatForgeShell } from './beat-forge/BeatForgeShell'
import { FarmBuilderShell } from './farm-builder/FarmBuilderShell'

export interface ShellProps {
  game: Game
  previewMode?: boolean
  /** Review-harness only: jump straight to a named screen (e.g. 'battle'). Ignored in the app. */
  scene?: string
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
  {
    backendId: 'feed_the_cats',
    type: 'feed-the-cats',
    title: 'Feed the Hungry Cats',
    description: 'Drag each fish-treat to the cat whose label matches the treat\'s answer — a playful sorting game',
    icon: '🐱',
    itemCount: 9,
    interactionType: 'Drag-and-drop sorting',
    bestFor: 'Grades 1-5, math facts, classifying examples into categories, matching',
    example: 'Drag the "3 + 4" treat to the cat that wants 7. Match every treat to feed all the cats.',
    Shell: FeedTheCatsShell,
  },
  {
    backendId: 'cat_jump',
    type: 'cat-jump',
    title: 'Cat Jump',
    description: 'Guide a cat across 8 stepping stones by picking the next number in an escalating pattern sequence',
    icon: '🐱',
    itemCount: 6,
    interactionType: 'Multiple-choice sequence',
    bestFor: 'Grades 1-7, number patterns, skip-counting, sequences, Fibonacci, square numbers',
    example: 'See 2, 4, 6 on the stones — tap 8 to hop the cat forward. Patterns grow harder each level.',
    Shell: CatJumpShell,
  },
  {
    backendId: 'beat_forge',
    type: 'beat-forge',
    title: 'Beat Forge',
    description: 'Fill instrument lines with limited note blocks — fractions must sum exactly to the bar\'s time signature',
    icon: '🎵',
    itemCount: 3,
    interactionType: 'Drag-and-drop fraction puzzle',
    bestFor: 'Grades 2-8, fraction addition, music theory, rhythm, number sense',
    example: 'You have 3 half-notes and 6 quarter-notes — fill 3 bars in 4/4 time so every fraction adds up perfectly.',
    Shell: BeatForgeShell,
  },
  {
    backendId: 'farm_builder',
    type: 'farm-builder',
    title: 'Xây Dựng Trang Trại',
    description: 'Đặt hàng rào trên lưới để quây đúng diện tích yêu cầu — hình gọn hơn nhận được nhiều sao hơn',
    icon: '🌾',
    itemCount: 5,
    interactionType: 'Vẽ tự do trên lưới',
    bestFor: 'Lớp 4-8, diện tích, chu vi, thừa số, tư duy không gian',
    example: 'Quây đúng 12 ô vuông bằng hàng rào. Hình 3×4 cần ít rào nhất — đó là bí quyết!',
    Shell: FarmBuilderShell,
  },
]

export function getGameByType(type: GameTemplateType): GameDefinition | undefined {
  return GAMES.find((g) => g.type === type)
}

export function getGameByBackendId(backendId: string): GameDefinition | undefined {
  return GAMES.find((g) => g.backendId === backendId)
}
