'use client'

import { useEffect, useState } from 'react'
import type { Game, GameItem } from '@/types/app'
import { Button } from '@/components/ui/button'
import { getGameByType } from './registry'

interface GameShellProps {
  game: Game
  previewMode?: boolean
}

export function GameShell({ game, previewMode = false }: GameShellProps) {
  const def = getGameByType(game.templateType)
  if (def) {
    const Shell = def.Shell
    return <Shell game={game} previewMode={previewMode} />
  }

  return <StandardGameShell game={game} previewMode={previewMode} />
}

function StandardGameShell({ game, previewMode = false }: GameShellProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})

  const currentItem = game.items[currentIndex]
  const currentAnswer = currentItem ? answers[currentItem.id] : ''
  const isChecked = currentItem ? checkedItems[currentItem.id] : false
  const isCorrect = currentItem ? currentAnswer === currentItem.correctAnswer : false

  if (!currentItem) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center text-muted-foreground">
        No game items available.
      </div>
    )
  }

  const setAnswer = (value: string) => {
    if (isChecked && !previewMode) return
    setAnswers((previous) => ({ ...previous, [currentItem.id]: value }))
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Game Shell</div>
            <h3 className="text-lg font-semibold capitalize">{game.templateType.replaceAll('-', ' ')}</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            {currentIndex + 1} / {game.items.length}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <ItemRenderer item={currentItem} answer={currentAnswer} checked={isChecked} onAnswer={setAnswer} />

        {isChecked && (
          <div
            className={`rounded-md border p-4 text-sm ${
              isCorrect
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            <div className="font-semibold">{isCorrect ? 'Correct answer' : 'Review answer'}</div>
            <p className="mt-1">{currentItem.explanation || 'No explanation provided.'}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              setCurrentIndex((value) => Math.max(0, value - 1))
              if (currentItem) setCheckedItems((previous) => ({ ...previous, [currentItem.id]: false }))
            }}
            disabled={currentIndex === 0}
          >
            Previous
          </Button>
          <Button
            onClick={() => setCheckedItems((previous) => ({ ...previous, [currentItem.id]: true }))}
            disabled={!currentAnswer}
            className="sm:flex-1"
          >
            Check Answer
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentIndex((value) => Math.min(game.items.length - 1, value + 1))}
            disabled={currentIndex === game.items.length - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

function PressTheButtonShell({ game, previewMode = false }: GameShellProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(12)
  const [finished, setFinished] = useState(false)

  const currentItem = game.items[currentIndex]
  const isCorrect = selectedAnswer === currentItem?.correctAnswer
  const progress = Math.round(((currentIndex + 1) / game.items.length) * 100)

  useEffect(() => {
    if (previewMode || checked || finished || !currentItem) return

    const timer = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer)
          setChecked(true)
          setStreak(0)
          return 0
        }
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [checked, currentItem, finished, previewMode])

  if (!currentItem) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center text-muted-foreground">
        No game items available.
      </div>
    )
  }

  const checkAnswer = (answer: string) => {
    if (checked) return

    const correct = answer === currentItem.correctAnswer
    setSelectedAnswer(answer)
    setChecked(true)

    if (correct) {
      const nextStreak = streak + 1
      setStreak(nextStreak)
      setScore((value) => value + 100 + nextStreak * 10 + timeLeft * 5)
    } else {
      setStreak(0)
    }
  }

  const nextQuestion = () => {
    if (currentIndex === game.items.length - 1) {
      setFinished(true)
      return
    }

    setCurrentIndex((value) => value + 1)
    setSelectedAnswer('')
    setChecked(false)
    setTimeLeft(12)
  }

  if (finished) {
    return (
      <div className="overflow-hidden rounded-lg border border-cyan-300/40 bg-slate-950 text-white shadow-2xl">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,#22d3ee_0,#0f172a_48%,#020617_100%)] p-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-yellow-300 bg-yellow-400 text-4xl shadow-[0_0_40px_rgba(250,204,21,0.55)]">
            ★
          </div>
          <div className="mt-5 text-sm font-black uppercase tracking-[0.24em] text-cyan-100">Game complete</div>
          <div className="mt-2 text-6xl font-black tracking-tight">{score}</div>
          <div className="mt-2 text-sm text-cyan-100">Final score</div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <Button
            className="h-12 bg-yellow-400 font-black text-slate-950 hover:bg-yellow-300"
            onClick={() => {
              setCurrentIndex(0)
              setSelectedAnswer('')
              setChecked(false)
              setScore(0)
              setStreak(0)
              setTimeLeft(12)
              setFinished(false)
            }}
          >
            Play Again
          </Button>
          <Button variant="outline" disabled className="h-12 border-white/20 bg-white/5 text-white">
            {game.items.length} questions completed
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-cyan-300/30 bg-slate-950 text-white shadow-2xl">
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,#0ea5e9_0,#155e75_34%,#020617_78%)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
          <div className="h-full bg-yellow-300 transition-all" style={{ width: `${progress}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 text-center sm:gap-3">
          <ScoreTile label="Time" value={`${timeLeft}s`} tone={timeLeft <= 4 ? 'danger' : 'default'} />
          <ScoreTile label="Score" value={score.toString()} />
          <ScoreTile label="Streak" value={`x${streak}`} tone={streak > 1 ? 'hot' : 'default'} />
        </div>
      </div>

      <div className="space-y-5 bg-[linear-gradient(135deg,#020617_0%,#082f49_55%,#064e3b_100%)] p-5">
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
          <span>Round {currentIndex + 1} / {game.items.length}</span>
          <span>Press the Button</span>
        </div>

        <div className="rounded-lg border border-cyan-300/30 bg-white/10 p-6 text-center shadow-inner backdrop-blur">
          <div className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-100">Challenge</div>
          <div className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-6xl">{currentItem.question}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {(currentItem.options ?? []).map((option, index) => {
            const selected = selectedAnswer === option
            const correct = checked && option === currentItem.correctAnswer
            const wrong = checked && selected && option !== currentItem.correctAnswer
            const colors = [
              'from-rose-500 to-red-600 shadow-rose-950/50',
              'from-sky-400 to-blue-600 shadow-blue-950/50',
              'from-yellow-300 to-orange-500 shadow-orange-950/50',
              'from-emerald-400 to-green-600 shadow-green-950/50',
            ]

            return (
              <button
                key={option}
                type="button"
                onClick={() => checkAnswer(option)}
                disabled={checked}
                className={`relative min-h-24 overflow-hidden rounded-2xl border-4 px-4 text-3xl font-black text-white shadow-xl transition active:scale-95 disabled:cursor-default sm:min-h-28 ${
                  correct
                    ? 'border-lime-200 bg-gradient-to-br from-lime-400 to-green-600 shadow-lime-400/40'
                    : wrong
                      ? 'border-red-200 bg-gradient-to-br from-red-500 to-red-800 shadow-red-500/40'
                      : `border-white/30 bg-gradient-to-br ${colors[index % colors.length]} hover:-translate-y-1 hover:border-white hover:shadow-2xl`
                }`}
              >
                <span className="absolute inset-x-4 top-2 h-4 rounded-full bg-white/25 blur-sm" />
                <span className="relative drop-shadow">{option}</span>
              </button>
            )
          })}
        </div>

        {checked && (
          <div className={`rounded-lg border p-4 text-sm ${isCorrect ? 'border-lime-300/40 bg-lime-400/15 text-lime-50' : 'border-yellow-300/40 bg-yellow-400/15 text-yellow-50'}`}>
            <div className="text-lg font-black">{isCorrect ? 'Nice hit!' : timeLeft === 0 ? 'Time is up' : 'Try the next one'}</div>
            <p className="mt-1 text-white/85">{currentItem.explanation}</p>
          </div>
        )}

        <Button onClick={nextQuestion} disabled={!checked} className="h-12 w-full bg-yellow-400 font-black text-slate-950 hover:bg-yellow-300 disabled:bg-white/20 disabled:text-white/50">
          {currentIndex === game.items.length - 1 ? 'Finish Game' : 'Next Question'}
        </Button>
      </div>
    </div>
  )
}

function ScoreTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' | 'hot' }) {
  const toneClass = {
    default: 'bg-white/15 text-white',
    danger: 'bg-red-500 text-white shadow-[0_0_24px_rgba(239,68,68,0.45)]',
    hot: 'bg-yellow-300 text-slate-950 shadow-[0_0_24px_rgba(250,204,21,0.45)]',
  }[tone]

  return (
    <div className={`rounded-lg px-3 py-2 backdrop-blur ${toneClass}`}>
      <div className="text-xs font-semibold uppercase opacity-80">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  )
}

function ItemRenderer({
  item,
  answer,
  checked,
  onAnswer,
}: {
  item: GameItem
  answer: string
  checked: boolean
  onAnswer: (answer: string) => void
}) {
  if (item.options?.length) {
    return (
      <div className="space-y-4">
        <h4 className="text-xl font-semibold leading-snug">{item.question}</h4>
        <div className="grid gap-3">
          {item.options.map((option, index) => {
            const selected = answer === option
            const correct = checked && option === item.correctAnswer
            const wrong = checked && selected && option !== item.correctAnswer

            return (
              <button
                key={`${option}-${index}`}
                type="button"
                onClick={() => onAnswer(option)}
                className={`rounded-md border p-4 text-left transition ${
                  correct
                    ? 'border-green-500 bg-green-50'
                    : wrong
                      ? 'border-red-500 bg-red-50'
                      : selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-secondary/30'
                }`}
              >
                <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-current text-xs font-semibold">
                  {String.fromCharCode(65 + index)}
                </span>
                {option}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (item.type === 'true-false') {
    return (
      <div className="space-y-4">
        <h4 className="text-xl font-semibold leading-snug">{item.question}</h4>
        <div className="grid grid-cols-2 gap-3">
          {['True', 'False'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(option)}
              className={`rounded-md border p-4 font-semibold transition ${
                answer === option ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/30'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h4 className="text-xl font-semibold leading-snug">{item.question}</h4>
      <input
        value={answer}
        onChange={(event) => onAnswer(event.target.value)}
        placeholder="Type answer"
        className="w-full rounded-md border border-input bg-background px-3 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}
