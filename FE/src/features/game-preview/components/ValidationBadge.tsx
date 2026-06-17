import type { GameItem } from '@/types/app'

export function ValidationBadge({ status }: { status: GameItem['validationStatus'] }) {
  const styles = {
    valid: 'border-green-200 bg-green-50 text-green-800',
    invalid: 'border-red-200 bg-red-50 text-red-800',
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status === 'valid' ? 'Valid' : status === 'invalid' ? 'Needs review' : 'Pending'}
    </span>
  )
}
