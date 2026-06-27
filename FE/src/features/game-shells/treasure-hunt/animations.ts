import type { PlayerMood } from './engine'

export type FeedbackState = 'idle' | 'correct' | 'wrong'

export function getFeedbackCopy(feedback: FeedbackState, correctAnswer: string) {
  if (feedback === 'correct') {
    return {
      title: 'Chính xác!',
      message: 'Nhân vật tiến gần hơn tới hang kho báu.',
    }
  }

  if (feedback === 'wrong') {
    return {
      title: 'Chưa đúng',
      message: `Đáp án đúng là ${correctAnswer}.`,
    }
  }

  return { title: '', message: '' }
}

export function getPlayerAnimationClass(mood: PlayerMood): string {
  if (mood === 'run') return 'scale-110 -translate-y-2'
  if (mood === 'celebrate') return 'scale-110 -translate-y-3 rotate-3'
  if (mood === 'sad') return 'translate-y-1 opacity-80'
  return ''
}

export function getFeedbackClass(feedback: FeedbackState): string {
  if (feedback === 'correct') return 'border-emerald-300 bg-emerald-100 text-emerald-950'
  if (feedback === 'wrong') return 'border-amber-300 bg-amber-100 text-amber-950'
  return 'border-transparent bg-transparent text-transparent'
}
