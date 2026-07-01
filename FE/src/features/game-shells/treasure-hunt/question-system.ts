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
    prompt: item.question || `Câu hỏi ${index + 1}`,
    options,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation || `Đáp án đúng là ${item.correctAnswer}.`,
    isValid: validationErrors.length === 0,
    validationErrors,
  }
}

function validateTreasureQuestionOptions(options: string[], correctAnswer: string): string[] {
  const errors: string[] = []
  const cleanedOptions = options.map((option) => option.trim()).filter(Boolean)

  if (cleanedOptions.length < 2) {
    errors.push('Câu hỏi này đang thiếu các lựa chọn trả lời hợp lệ từ AI. Vui lòng tạo lại hoặc chỉnh sửa mục này.')
  }

  if (cleanedOptions.length !== options.length) {
    errors.push('Các lựa chọn trả lời không được để trống.')
  }

  if (correctAnswer.trim() && !cleanedOptions.includes(correctAnswer)) {
    errors.push('Đáp án đúng phải trùng với một trong các lựa chọn do AI tạo ra.')
  }

  return errors
}
