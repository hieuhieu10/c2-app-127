/**
 * Game-picker metadata. This is a thin view over the single game manifest in
 * `@/features/game-shells/registry` — add new games there, not here.
 */
import type { GameTemplateType } from '@/types/app'
import { GAMES, getGameByBackendId, getGameByType, type GameDefinition } from '@/features/game-shells/registry'

export type TemplateMetadata = GameDefinition

export const TEMPLATE_REGISTRY: TemplateMetadata[] = GAMES

export function getTemplateMetadata(type: GameTemplateType): TemplateMetadata {
  return getGameByType(type) ?? GAMES[0]
}

/** Look up game metadata by the backend template id (e.g. 'treasure_hunt'). */
export const getTemplateByBackendId = getGameByBackendId
