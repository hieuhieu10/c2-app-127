import type { GameItem } from '@/types/app'

export function validateGameItem(item: GameItem): GameItem {
  const errors: string[] = []

  if (!item.question?.trim()) {
    errors.push('Question cannot be empty')
  }

  if (!item.correctAnswer?.trim()) {
    errors.push('Correct answer cannot be empty')
  }

  if (item.type === 'multiple-choice' && (!item.options || item.options.length < 2)) {
    errors.push('Multiple-choice items need at least two options')
  }

  if (item.options?.some((option) => !option.trim())) {
    errors.push('Options cannot be empty')
  }

  const hasAnswerInOptions = !item.options || item.options.includes(item.correctAnswer)
  if (!hasAnswerInOptions) {
    errors.push('Correct answer must match one of the answer options')
  }

  const score = calculateFaithfulnessScore(item, errors)
  const isValid = errors.length === 0 && score >= 0.8

  return {
    ...item,
    validationStatus: isValid ? 'valid' : 'invalid',
    validationErrors: errors,
    faithfulnessScore: score,
    entailmentStatus: score >= 0.8 ? 'entailed' : score >= 0.65 ? 'ambiguous' : 'not-entailed',
    distractorStatus: item.options ? (hasAnswerInOptions ? 'verified-wrong' : 'needs-review') : 'not-applicable',
    safetyStatus: item.question.length > 220 ? 'needs-review' : 'safe',
  }
}

export function validateGameItems(items: GameItem[]): GameItem[] {
  return items.map(validateGameItem)
}

function calculateFaithfulnessScore(item: GameItem, errors: string[]): number {
  const base = 0.92
  const explanationBonus = item.explanation?.trim() ? 0.04 : -0.05
  const optionPenalty = item.options && !item.options.includes(item.correctAnswer) ? -0.18 : 0
  const errorPenalty = errors.length * 0.08
  const lengthPenalty = item.question.length < 12 ? -0.08 : 0

  return Math.max(0.35, Math.min(0.99, Number((base + explanationBonus + optionPenalty + lengthPenalty - errorPenalty).toFixed(2))))
}
