import type { GameItem } from '@/types/app'

export interface TreasureQuestion {
  id: string
  prompt: string
  options: string[]
  correctAnswer: string
  explanation: string
}

export function normalizeTreasureQuestion(item: GameItem, index: number): TreasureQuestion {
  const options = item.options?.length ? item.options : buildFallbackOptions(item.correctAnswer)

  return {
    id: item.id,
    prompt: item.question || `Question ${index + 1}`,
    options,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation || `The correct answer is ${item.correctAnswer}.`,
  }
}

function buildFallbackOptions(correctAnswer: string): string[] {
  const options = new Set([correctAnswer])
  for (const fallback of ['Answer A', 'Answer B', 'Answer C']) {
    if (options.size >= 4) break
    options.add(fallback)
  }

  return [...options]
}
