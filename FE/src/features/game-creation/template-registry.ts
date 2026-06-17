import type { GameTemplateType } from '@/types/app'

export interface TemplateMetadata {
  type: GameTemplateType
  title: string
  description: string
  icon: string
  itemCount: number
  interactionType: string
  bestFor: string
  example: string
}

export const TEMPLATE_REGISTRY: TemplateMetadata[] = [
  {
    type: 'press-the-button',
    title: 'Treasure Hunt',
    description: 'Players answer lesson questions to race along two map routes toward treasure caves',
    icon: '🗺️',
    itemCount: 10,
    interactionType: 'Turn-based map race',
    bestFor: 'Elementary lessons, quick recall, math facts, vocabulary, science concepts',
    example: 'Answer a multiplication or vocabulary question correctly to move 10% closer to a treasure cave.',
  },
]

export function getTemplateMetadata(type: GameTemplateType): TemplateMetadata {
  return TEMPLATE_REGISTRY.find((template) => template.type === type) ?? TEMPLATE_REGISTRY[0]
}
