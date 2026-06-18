'use client'

import { useMemo, useState } from 'react'
import type { Game } from '@/types/app'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  FINISH_POSITION,
  createTreasurePlayers,
  getMovePercent,
  getPathPoint,
  getWinner,
  movePlayerAfterAnswer,
  rankPlayers,
  type TreasurePlayer,
} from './engine'
import { getFeedbackClass, getFeedbackCopy, getPlayerAnimationClass, type FeedbackState } from './animations'
import { normalizeTreasureQuestion } from './question-system'
import { getCharacterAsset, treasureHuntAssets } from './assets'

interface TreasureHuntShellProps {
  game: Game
  previewMode?: boolean
  fullscreen?: boolean
}

export function TreasureHuntShell({ game, fullscreen = false }: TreasureHuntShellProps) {
  const [players, setPlayers] = useState<TreasurePlayer[]>(() => createTreasurePlayers(game.settings))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState('')
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [finished, setFinished] = useState(false)

  const currentItem = game.items[currentIndex]
  const currentQuestion = currentItem ? normalizeTreasureQuestion(currentItem, currentIndex) : null
  const activePlayer = players[currentIndex % players.length]
  const rankings = useMemo(() => rankPlayers(players), [players])
  const movePercent = getMovePercent(game.items.length)
  const activePlayerProgress = getDisplayProgress(activePlayer.position)

  if (!currentQuestion || !activePlayer) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-8 text-center text-muted-foreground">
        No game items available.
      </div>
    )
  }

  const answerQuestion = (answer: string) => {
    if (feedback !== 'idle') return

    const isCorrect = answer === currentQuestion.correctAnswer
    setSelectedAnswer(answer)
    setFeedback(isCorrect ? 'correct' : 'wrong')
    setPlayers((currentPlayers) => movePlayerAfterAnswer(currentPlayers, activePlayer.id, isCorrect, game.items.length))
  }

  const goNext = () => {
    const hasWinner = players.some((player) => player.position >= FINISH_POSITION)
    const isLastQuestion = currentIndex >= game.items.length - 1

    if (hasWinner || isLastQuestion) {
      setFinished(true)
      return
    }

    setCurrentIndex((value) => value + 1)
    setSelectedAnswer('')
    setFeedback('idle')
    setPlayers((currentPlayers) => currentPlayers.map((player) => ({ ...player, mood: 'idle' })))
  }

  const resetGame = () => {
    setPlayers(createTreasurePlayers(game.settings))
    setCurrentIndex(0)
    setSelectedAnswer('')
    setFeedback('idle')
    setFinished(false)
  }

  if (finished) {
    return <TreasureEndScreen players={players} totalQuestions={game.items.length} onRestart={resetGame} />
  }

  const feedbackCopy = getFeedbackCopy(feedback, currentQuestion.correctAnswer)

  return (
    <div
      className={`overflow-hidden bg-sky-50 text-slate-900 shadow-xl ${
        fullscreen ? 'rounded-lg border border-white/20' : 'rounded-lg border border-emerald-200'
      }`}
    >
      <div className="bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-300 px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-950/75">Game Template</div>
            <h3 className="text-2xl font-black text-emerald-950">Treasure Hunt</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <StatPill label="Round" value={`${currentIndex + 1}/${game.items.length}`} />
            <StatPill label="Move" value={`+${Math.round(movePercent)}%`} />
          </div>
        </div>
      </div>

      <div
        className={`grid gap-4 bg-gradient-to-br from-sky-100 via-amber-50 to-lime-100 p-4 ${
          fullscreen
            ? 'min-h-[calc(100vh-126px)] lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.45fr)]'
            : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]'
        }`}
      >
        <TreasureMap players={players} activePlayerId={activePlayer.id} fullscreen={fullscreen} />

        <aside className="space-y-4">
          <div className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-sky-700">Current Turn</div>
                <div className="mt-1 flex items-center gap-2 text-xl font-black">
                  <span>{activePlayer.avatar}</span>
                  <span>{activePlayer.name}</span>
                </div>
              </div>
              <div className="rounded-full bg-amber-200 px-3 py-1 text-sm font-black text-amber-950">
                {activePlayerProgress}%
              </div>
            </div>
          </div>

          <QuestionCard
            question={currentQuestion.prompt}
            options={currentQuestion.options}
            correctAnswer={currentQuestion.correctAnswer}
            selectedAnswer={selectedAnswer}
            feedback={feedback}
            onAnswer={answerQuestion}
          />

          {feedback !== 'idle' && (
            <div className={`rounded-lg border p-4 text-sm shadow-sm ${getFeedbackClass(feedback)}`}>
              <div className="text-lg font-black">{feedbackCopy.title}</div>
              <p className="mt-1 font-medium">{feedbackCopy.message}</p>
              {currentQuestion.explanation && <p className="mt-2 text-sm opacity-85">{currentQuestion.explanation}</p>}
              <Button onClick={goNext} className="mt-4 h-11 w-full bg-emerald-600 font-black hover:bg-emerald-700">
                {players.some((player) => player.position >= FINISH_POSITION) || currentIndex >= game.items.length - 1
                  ? 'View Results'
                  : 'Next Question'}
              </Button>
            </div>
          )}

          <Leaderboard players={rankings} />
        </aside>
      </div>
    </div>
  )
}

function TreasureMap({
  players,
  activePlayerId,
  fullscreen = false,
}: {
  players: TreasurePlayer[]
  activePlayerId: string
  fullscreen?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border-4 border-emerald-800/20 bg-[#77c95b] shadow-[inset_0_0_50px_rgba(20,83,45,0.28)] ${
        fullscreen ? 'min-h-[520px] lg:min-h-[calc(100vh-170px)]' : 'min-h-[430px] md:min-h-[540px]'
      }`}
    >
      <AssetImage
        src={treasureHuntAssets.map.background}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fallback={null}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.18)_0,transparent_20%),radial-gradient(circle_at_82%_72%,rgba(22,101,52,0.24)_0,transparent_24%),linear-gradient(135deg,rgba(187,247,208,0.2)_0,transparent_34%,rgba(21,128,61,0.18)_100%)]" />
      <div className="absolute left-[5%] top-[8%] h-14 w-24 rounded-lg border-4 border-amber-900/25 bg-amber-200 shadow-md" />
      <div className="absolute left-[8%] top-[11%] h-3 w-14 rounded-full bg-amber-900/35" />
      <div className="absolute bottom-[7%] left-[14%] h-8 w-24 rounded-full bg-emerald-900/20" />
      <div className="absolute right-[15%] top-[11%] h-10 w-16 rounded-full bg-emerald-900/20" />
      <div className="absolute bottom-[12%] right-[23%] h-10 w-24 rounded-full bg-emerald-900/20" />
      <div className="absolute left-[22%] top-[18%] text-4xl drop-shadow">🌳</div>
      <div className="absolute left-[16%] top-[56%] text-3xl drop-shadow">🪨</div>
      <div className="absolute right-[30%] top-[47%] text-4xl drop-shadow">🌳</div>
      <div className="absolute right-[10%] bottom-[18%] text-3xl drop-shadow">🪨</div>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M 7 79 C 16 65, 20 56, 30 57 C 45 46, 52 28, 66 34 C 76 38, 82 31, 91 35"
          fill="none"
          stroke="#a16207"
          strokeLinecap="round"
          strokeWidth="7.5"
        />
        <path
          d="M 7 79 C 16 65, 20 56, 30 57 C 43 65, 52 75, 66 70 C 78 66, 82 72, 91 72"
          fill="none"
          stroke="#a16207"
          strokeLinecap="round"
          strokeWidth="7.5"
        />
        <path
          d="M 7 79 C 16 65, 20 56, 30 57 C 45 46, 52 28, 66 34 C 76 38, 82 31, 91 35"
          fill="none"
          stroke="#f4b86a"
          strokeLinecap="round"
          strokeWidth="5.2"
        />
        <path
          d="M 7 79 C 16 65, 20 56, 30 57 C 43 65, 52 75, 66 70 C 78 66, 82 72, 91 72"
          fill="none"
          stroke="#f4b86a"
          strokeLinecap="round"
          strokeWidth="5.2"
        />
      </svg>
      <AssetImage
        src={treasureHuntAssets.map.pathOverlay}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        fallback={null}
      />

      <div className="absolute left-[7%] top-[77%] rounded-full border border-amber-950/25 bg-[#fff7d6]/95 px-3 py-1 text-xs font-black text-amber-950 shadow">
        Start
      </div>
      <TreasureCave className="right-[2%] top-[26%]" label="Treasure Cave 1" />
      <TreasureCave className="right-[2%] top-[63%]" label="Treasure Cave 2" />

      {players.map((player, index) => {
        const point = getPathPoint(getVisualProgress(player.position), index, players.length)
        const isActive = player.id === activePlayerId

        return (
          <div
            key={player.id}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out ${getPlayerAnimationClass(player.mood)}`}
            style={point}
          >
            <div className="mb-1 rounded-full border border-amber-950/20 bg-[#fff3cf] px-2 py-0.5 text-center text-xs font-black shadow">{player.name}</div>
            <PlayerAvatar player={player} active={isActive} />
          </div>
        )
      })}
    </div>
  )
}

function TreasureCave({ className, label }: { className: string; label: string }) {
  return (
    <div className={`absolute z-10 text-center ${className}`}>
      <div className="relative mx-auto h-20 w-24">
        <div className="absolute inset-x-3 bottom-1 h-14 rounded-t-full bg-stone-800 shadow-[0_0_24px_rgba(250,204,21,0.7)]" />
        <div className="absolute inset-x-5 bottom-2 h-10 rounded-t-full bg-yellow-300/80 blur-sm" />
        <AssetImage
          src={treasureHuntAssets.objects.caveClosed}
          alt={label}
          className="absolute inset-0 h-full w-full object-contain"
          fallback={<div className="absolute inset-0 flex items-end justify-center pb-2 text-4xl">⛰️</div>}
        />
      </div>
      <div className="rounded-full border border-amber-950/25 bg-[#fff7d6]/95 px-3 py-1 text-xs font-black text-amber-950 shadow">
        {label}
      </div>
    </div>
  )
}

function PlayerAvatar({ player, active }: { player: TreasurePlayer; active: boolean }) {
  return (
    <div
      className={`flex h-16 w-16 items-center justify-center rounded-full border-4 bg-white text-3xl shadow-xl ${active ? 'border-red-500 ring-4 ring-red-200/70' : 'border-[#fff3cf]'}`}
      style={{ background: `linear-gradient(145deg, ${player.color}, #ffffff)` }}
    >
      <AssetImage
        src={getCharacterAsset(player.id, player.mood)}
        alt={player.name}
        className="h-16 w-16 object-contain"
        fallback={<span>{player.avatar}</span>}
      />
    </div>
  )
}

function QuestionCard({
  question,
  options,
  correctAnswer,
  selectedAnswer,
  feedback,
  onAnswer,
}: {
  question: string
  options: string[]
  correctAnswer: string
  selectedAnswer: string
  feedback: FeedbackState
  onAnswer: (answer: string) => void
}) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/90 p-4 shadow-lg">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Question</div>
      <h4 className="mt-2 text-xl font-black leading-snug text-slate-950">{question}</h4>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {options.map((option, index) => {
          const checked = feedback !== 'idle'
          const isSelected = selectedAnswer === option
          const isSelectedCorrect = checked && isSelected && option === correctAnswer
          const isCorrectReveal = checked && !isSelected && option === correctAnswer
          const isWrong = checked && isSelected && option !== correctAnswer

          return (
            <button
              key={`${option}-${index}`}
              type="button"
              disabled={checked}
              onClick={() => onAnswer(option)}
              className={`min-h-16 rounded-lg border-2 px-3 py-3 text-base font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 disabled:cursor-default ${
                isSelectedCorrect
                  ? 'animate-pulse border-emerald-700 bg-emerald-300 shadow-emerald-500/40'
                  : isWrong
                    ? 'animate-pulse border-red-700 bg-red-300 shadow-red-500/40'
                    : isCorrectReveal
                      ? 'border-emerald-500 bg-white'
                      : 'border-slate-200 bg-white'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Leaderboard({ players }: { players: TreasurePlayer[] }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-lg">
      <div className="text-sm font-black text-slate-950">Leaderboard</div>
      <div className="mt-3 space-y-3">
        {players.map((player, index) => (
          <div key={player.id}>
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span>
                #{index + 1} {player.name}
              </span>
              <span>{getDisplayProgress(player.position)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${getDisplayProgress(player.position)}%`, backgroundColor: player.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TreasureEndScreen({
  players,
  totalQuestions,
  onRestart,
}: {
  players: TreasurePlayer[]
  totalQuestions: number
  onRestart: () => void
}) {
  const winner = getWinner(players)
  const rankings = rankPlayers(players)

  return (
    <div className="overflow-hidden rounded-lg border border-amber-300 bg-gradient-to-br from-stone-200 via-amber-100 to-yellow-200 text-slate-950 shadow-xl">
      <div className="p-6 text-center">
        <div className="relative mx-auto h-32 w-40">
          <div className="absolute inset-x-4 bottom-0 h-24 rounded-t-full bg-stone-800 shadow-[0_0_55px_rgba(234,179,8,0.8)]" />
          <div className="absolute inset-x-8 bottom-2 h-16 rounded-t-full bg-yellow-300/80 blur-md" />
          <AssetImage
            src={treasureHuntAssets.objects.caveOpen}
            alt="Open treasure cave"
            className="absolute inset-0 h-full w-full object-contain"
            fallback={<div className="absolute inset-0 flex items-end justify-center pb-5 text-6xl">⛰️</div>}
          />
          <AssetImage
            src={treasureHuntAssets.objects.treasureChest}
            alt="Treasure chest"
            className="absolute bottom-0 left-1/2 h-20 w-20 -translate-x-1/2 object-contain"
            fallback={<div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-5xl">💰</div>}
          />
        </div>
        <div className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-amber-800">Treasure Cave Opened</div>
        <h3 className="mt-2 text-4xl font-black">{winner.name} wins!</h3>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          The player found gold and jewels after {totalQuestions} questions.
        </p>
      </div>

      <div className="grid gap-3 p-5 md:grid-cols-3">
        {rankings.map((player, index) => (
          <div key={player.id} className="rounded-lg border border-white/70 bg-white/80 p-4 text-center shadow">
            <div className="text-sm font-black text-amber-700">Rank {index + 1}</div>
            <div className="mt-2 text-4xl">{player.avatar}</div>
            <div className="mt-1 text-xl font-black">{player.name}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-bold">
              <div className="rounded bg-emerald-100 p-2">
                <div>{player.correctAnswers}</div>
                <div className="text-xs text-emerald-800">Correct</div>
              </div>
              <div className="rounded bg-sky-100 p-2">
                <div>{player.score}</div>
                <div className="text-xs text-sky-800">Score</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/70 p-5">
        <Button onClick={onRestart} className="h-12 w-full bg-emerald-600 text-base font-black hover:bg-emerald-700">
          Play Again
        </Button>
      </div>
    </div>
  )
}

function AssetImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string
  alt: string
  className?: string
  fallback: ReactNode
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return <>{fallback}</>
  }

  return <img src={src} alt={alt} className={className} draggable={false} onError={() => setFailed(true)} />
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 px-3 py-2 text-emerald-950 shadow">
      <div className="text-[10px] font-black uppercase tracking-wide opacity-75">{label}</div>
      <div className="text-sm font-black">{value}</div>
    </div>
  )
}

function getDisplayProgress(position: number): number {
  return Math.min(100, Math.round((position / FINISH_POSITION) * 100))
}

function getVisualProgress(position: number): number {
  return Math.min(100, (position / FINISH_POSITION) * 100)
}
