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
    title: 'Săn Kho Báu',
    description: 'Người chơi trả lời câu hỏi bài học để đua trên hai tuyến đường tới hang kho báu',
    icon: '🗺️',
    itemCount: 10,
    interactionType: 'Đua trên bản đồ theo lượt',
    bestFor: 'Bài học tiểu học, ôn nhanh, phép tính, từ vựng, khái niệm khoa học',
    example: 'Trả lời đúng câu hỏi nhân hoặc từ vựng để tiến gần hang kho báu thêm 10%.',
    Shell: TreasureHuntShell,
  },
  {
    backendId: 'battleship',
    type: 'battleship',
    title: 'Bắn Tàu Đố Vui',
    description: 'Trò chơi 2 người luân phiên — trả lời đúng câu đố để được bắn vào lưới của đối thủ',
    icon: '⚓',
    itemCount: 20,
    interactionType: 'Đối kháng 2 người theo lượt',
    bestFor: 'Lớp 6-12, ôn tập thi đua, ghi nhớ kiến thức, từ vựng, nhân quả',
    example: 'Trả lời đúng câu hỏi lịch sử để dội bom hạm đội đối thủ. Bắn trúng = thêm lượt.',
    Shell: BattleshipShell,
  },
  {
    backendId: 'feed_the_cats',
    type: 'feed-the-cats',
    title: 'Cho Mèo Đói Ăn',
    description: 'Kéo từng miếng cá tới chú mèo có nhãn khớp với đáp án của miếng đó — trò phân loại vui nhộn',
    icon: '🐱',
    itemCount: 9,
    interactionType: 'Kéo thả phân loại',
    bestFor: 'Lớp 1-5, phép tính, phân loại ví dụ theo nhóm, ghép cặp',
    example: 'Kéo miếng "3 + 4" tới chú mèo muốn số 7. Ghép hết mọi miếng cá để cho tất cả mèo ăn.',
    Shell: FeedTheCatsShell,
  },
  {
    backendId: 'cat_jump',
    type: 'cat-jump',
    title: 'Mèo Nhảy',
    description: 'Dẫn chú mèo qua 8 hòn đá bằng cách chọn số tiếp theo trong dãy quy luật khó dần',
    icon: '🐱',
    itemCount: 6,
    interactionType: 'Dãy số trắc nghiệm',
    bestFor: 'Lớp 1-7, quy luật số, đếm cách quãng, dãy số, Fibonacci, số chính phương',
    example: 'Thấy 2, 4, 6 trên đá — chạm 8 để mèo nhảy tiếp. Quy luật khó dần qua mỗi màn.',
    Shell: CatJumpShell,
  },
  {
    backendId: 'beat_forge',
    type: 'beat-forge',
    title: 'Xưởng Nhịp Điệu',
    description: 'Lấp đầy các dòng nhạc cụ bằng số khối nốt có hạn — tổng phân số phải đúng bằng nhịp của ô nhịp',
    icon: '🎵',
    itemCount: 3,
    interactionType: 'Giải đố phân số kéo thả',
    bestFor: 'Lớp 2-8, cộng phân số, lý thuyết âm nhạc, tiết tấu, cảm nhận số',
    example: 'Bạn có 3 nốt trắng và 6 nốt đen — lấp đầy 3 ô nhịp 4/4 sao cho mọi phân số cộng lại vừa khít.',
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
