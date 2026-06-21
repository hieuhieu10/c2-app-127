import type { GameItem } from '@/types/app'

export interface TreasureQuestion {
  id: string
  prompt: string
  options: string[]
  correctAnswer: string
  explanation: string
  isValid: boolean
  validationErrors: string[]
}

export function normalizeTreasureQuestion(item: GameItem, index: number): TreasureQuestion {
  const options = item.options ?? []
  const validationErrors = validateTreasureQuestionOptions(options, item.correctAnswer)

  return {
    id: item.id,
    prompt: item.question || `Question ${index + 1}`,
    options,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation || `The correct answer is ${item.correctAnswer}.`,
    isValid: validationErrors.length === 0,
    validationErrors,
  }
}

function validateTreasureQuestionOptions(options: string[], correctAnswer: string): string[] {
  const errors: string[] = []
  const cleanedOptions = options.map((option) => option.trim()).filter(Boolean)

  if (cleanedOptions.length < 2) {
    errors.push('This question is missing valid AI answer options. Please regenerate or edit this item.')
  }

  if (cleanedOptions.length !== options.length) {
    errors.push('Answer options cannot be empty.')
  }

  if (correctAnswer.trim() && !cleanedOptions.includes(correctAnswer)) {
    errors.push('Correct answer must match one of the AI answer options.')
  }

  return errors
}
