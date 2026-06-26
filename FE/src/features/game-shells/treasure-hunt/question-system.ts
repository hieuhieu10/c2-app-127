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
    prompt: item.question || `Câu hỏi ${index + 1}`,
    options,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation || `Đáp án đúng là ${item.correctAnswer}.`,
  }
}

function buildFallbackOptions(correctAnswer: string): string[] {
  const options = new Set([correctAnswer])
  for (const fallback of ['Đáp án A', 'Đáp án B', 'Đáp án C']) {
    if (options.size >= 4) break
    options.add(fallback)
  }

  return [...options]
}
