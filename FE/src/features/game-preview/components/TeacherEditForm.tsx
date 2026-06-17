import { useEffect, useState } from 'react'
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
  onChange: (item: GameItem) => Promise<void>
  onValidate: () => Promise<void>
}

// Snapshot the editable fields we care about.
type Draft = {
  question: string
  correctAnswer: string
  options: string[]
  explanation: string
}

function toDraft(item: GameItem): Draft {
  return {
    question: item.question ?? '',
    correctAnswer: item.correctAnswer ?? '',
    options: item.options ? [...item.options] : [],
    explanation: item.explanation ?? '',
  }
}

function isDirty(draft: Draft, saved: Draft): boolean {
  return (
    draft.question !== saved.question ||
    draft.correctAnswer !== saved.correctAnswer ||
    draft.explanation !== saved.explanation ||
    draft.options.length !== saved.options.length ||
    draft.options.some((o, i) => o !== saved.options[i])
  )
}

export function TeacherEditForm({ item, itemNumber, onChange, onValidate }: TeacherEditFormProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(item))
  const [savedDraft, setSavedDraft] = useState<Draft>(() => toDraft(item))
  const [saving, setSaving] = useState(false)
  const [rechecking, setRechecking] = useState(false)

  // When the parent switches to a different item, reset local draft.
  useEffect(() => {
    const next = toDraft(item)
    setDraft(next)
    setSavedDraft(next)
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (partial: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...partial }))

  const dirty = isDirty(draft, savedDraft)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onChange({ ...item, ...draft, validationStatus: 'pending' })
      setSavedDraft({ ...draft })
    } finally {
      setSaving(false)
    }
  }

  const handleRecheck = async () => {
    // Always save first so the server validates the latest edits.
    if (dirty) await handleSave()
    setRechecking(true)
    try {
      await onValidate()
    } finally {
      setRechecking(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Edit Item {itemNumber}
              {dirty && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Unsaved
                </span>
              )}
            </CardTitle>
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
            value={draft.question}
            onChange={(e) => patch({ question: e.target.value })}
            className="min-h-24"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="answer">Correct Answer</Label>
          <Input
            id="answer"
            value={draft.correctAnswer}
            onChange={(e) => patch({ correctAnswer: e.target.value })}
          />
        </div>

        {draft.options.length > 0 && (
          <div className="space-y-3">
            <Label>Answer Options</Label>
            {draft.options.map((option, index) => (
              <Input
                key={index}
                value={option}
                onChange={(e) => {
                  const options = [...draft.options]
                  options[index] = e.target.value
                  patch({ options })
                }}
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
              />
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="explanation">Explanation</Label>
          <Textarea
            id="explanation"
            value={draft.explanation}
            onChange={(e) => patch({ explanation: e.target.value })}
            className="min-h-20"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          {dirty && (
            <Button onClick={handleSave} disabled={saving} className="sm:flex-1">
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          )}
          <Button
            onClick={handleRecheck}
            disabled={rechecking || saving}
            variant={dirty ? 'outline' : 'default'}
            className="sm:flex-1"
          >
            {rechecking ? 'Checking…' : 'Re-check Item'}
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
