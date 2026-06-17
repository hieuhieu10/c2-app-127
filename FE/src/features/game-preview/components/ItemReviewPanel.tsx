import type { GameItem } from '@/types/app'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FaithfulnessScore } from './FaithfulnessScore'
import { ValidationBadge } from './ValidationBadge'

interface ItemReviewPanelProps {
  items: GameItem[]
  selectedIndex: number
  onSelect: (index: number) => void
}

export function ItemReviewPanel({ items, selectedIndex, onSelect }: ItemReviewPanelProps) {
  const validCount = items.filter((item) => item.validationStatus === 'valid').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Items ({validCount}/{items.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(index)}
            className={`w-full rounded-md border p-3 text-left transition ${
              selectedIndex === index ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/30'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">Item {index + 1}</span>
              <ValidationBadge status={item.validationStatus} />
            </div>
            <p className="line-clamp-2 text-sm text-muted-foreground">{item.question}</p>
            <div className="mt-3">
              <FaithfulnessScore score={item.faithfulnessScore} />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
