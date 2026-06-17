import type { GameItem } from '@/types/app'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FaithfulnessScore } from './FaithfulnessScore'
import { ValidationBadge } from './ValidationBadge'

interface TeacherEditFormProps {
  item: GameItem
  itemNumber: number
  onChange: (item: GameItem) => void
  onValidate: () => void
}

export function TeacherEditForm({ item, itemNumber, onChange, onValidate }: TeacherEditFormProps) {
  const update = (patch: Partial<GameItem>) => {
    onChange({ ...item, ...patch, validationStatus: 'pending' })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Edit Item {itemNumber}</CardTitle>
            <CardDescription>Teacher-approved content is the final gate before launch.</CardDescription>
          </div>
          <ValidationBadge status={item.validationStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {item.validationErrors?.length ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {item.validationErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)]">
          <FaithfulnessScore score={item.faithfulnessScore} />
          <div className="grid gap-2 text-xs sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <Metric label="Entailment" value={item.entailmentStatus ?? 'pending'} />
            <Metric label="Distractors" value={item.distractorStatus ?? 'pending'} />
            <Metric label="Safety" value={item.safetyStatus ?? 'pending'} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="question">Question</Label>
          <Textarea
            id="question"
            value={item.question}
            onChange={(event) => update({ question: event.target.value })}
            className="min-h-24"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="answer">Correct Answer</Label>
          <Input id="answer" value={item.correctAnswer} onChange={(event) => update({ correctAnswer: event.target.value })} />
        </div>

        {item.options?.length ? (
          <div className="space-y-3">
            <Label>Answer Options</Label>
            {item.options.map((option, index) => (
              <Input
                key={index}
                value={option}
                onChange={(event) => {
                  const options = [...(item.options ?? [])]
                  options[index] = event.target.value
                  update({ options })
                }}
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
              />
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="explanation">Explanation</Label>
          <Textarea
            id="explanation"
            value={item.explanation}
            onChange={(event) => update({ explanation: event.target.value })}
            className="min-h-20"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          <Button onClick={onValidate} className="sm:flex-1">
            Re-check Item
          </Button>
          <Button variant="outline" disabled className="sm:flex-1">
            Regenerate Item Coming Soon
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-secondary/20 p-2">
      <div className="truncate font-semibold text-muted-foreground" title={label}>
        {label}
      </div>
      <div className="mt-1 break-words capitalize leading-snug">{value.replaceAll('-', ' ')}</div>
    </div>
  )
}
