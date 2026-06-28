'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Copy, ExternalLink, Maximize2, Minimize2, Rocket } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi, mapBeWebGame, mapBeWebLesson } from '@/features/game-library/services/be-web'
import { GameShell } from '@/features/game-shells/GameShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { Game, Lesson } from '@/types/app'

export default function ReviewPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const lessonId = params.lessonId as string
  const gameId = params.gameId as string

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/signin')
      return
    }

    beWebApi
      .getGame(gameId)
      .then((beWebGame) => {
        if (String(beWebGame.lessonId) !== lessonId) {
          router.push('/dashboard')
          return
        }
        setLesson(mapBeWebLesson(beWebGame))
        setGame(mapBeWebGame(beWebGame))
        setLoading(false)
      })
      .catch((error) => {
        console.error('Failed to load game:', error)
        router.push('/dashboard')
      })
  }, [authLoading, gameId, lessonId, router, user])

  const publishGame = async () => {
    if (!game) return
    try {
      const updated = await beWebApi.publishGame(game.id)
      setGame({ ...game, status: updated.status })
    } catch (error) {
      console.error('Failed to publish game:', error)
      alert(error instanceof Error ? error.message : 'Failed to publish game')
    }
  }

  const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/dashboard/lesson/${lessonId}/review/${gameId}`

  const copyShareLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!lesson || !game) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Link href="/dashboard">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1720px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-2xl font-bold text-primary hover:opacity-80">
            LearnGame
          </Link>
          <div className="text-sm text-muted-foreground">Approved Game</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1720px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {game.status === 'published' ? 'Published' : 'Approved'}
            </div>
            <h1 className="text-3xl font-bold text-foreground">{lesson.title}</h1>
            <p className="mt-2 text-muted-foreground">
              Final playable game preview with teacher-approved content and validation checks.
            </p>

            <div
              className={
                isFullscreen
                  ? 'fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-slate-950 p-3 text-slate-950'
                  : 'mt-3 min-w-0'
              }
            >
              <div
                className={
                  isFullscreen
                    ? 'fixed right-5 top-5 z-[60] flex items-center justify-end'
                    : 'mb-3 flex justify-end'
                }
              >
                <Button
                  variant={isFullscreen ? 'ghost' : 'outline'}
                  onClick={() => setIsFullscreen((value) => !value)}
                  size="icon"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  className={isFullscreen ? 'h-8 w-8 bg-white/25 text-slate-950 opacity-45 backdrop-blur hover:bg-white/75 hover:opacity-100' : ''}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              <div className={isFullscreen ? 'h-[calc(100dvh-24px)] w-full overflow-y-auto' : 'min-w-0'}>
                <div className={isFullscreen ? 'mx-auto h-full w-full max-w-[1280px]' : 'min-w-0'}>
                  <GameShell game={game} fullscreen={isFullscreen} />
                </div>
              </div>
            </div>
          </div>

          <aside className={isFullscreen ? 'hidden' : 'space-y-6'}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Launch Controls</CardTitle>
                <CardDescription>Publish or share this classroom activity.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button onClick={publishGame}>
                  <Rocket className="mr-2 h-4 w-4" />
                  {game.status === 'published' ? 'Published' : 'Publish Game'}
                </Button>
                <Button variant="outline" onClick={copyShareLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  {copied ? 'Copied' : 'Copy Share Link'}
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Back to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Validation Summary</CardTitle>
                <CardDescription>Teacher and system gates before launch.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Items" value={`${game.items.length}`} />
                <SummaryRow label="Schema valid" value={`${game.items.filter((item) => item.validationStatus === 'valid').length}/${game.items.length}`} />
                <SummaryRow
                  label="Avg. faithfulness"
                  value={`${Math.round((game.items.reduce((sum, item) => sum + (item.faithfulnessScore ?? 0), 0) / game.items.length) * 100)}%`}
                />
                <SummaryRow label="Safety" value={game.items.some((item) => item.safetyStatus === 'blocked') ? 'Blocked' : 'Pass'} />
                <Link href={`/dashboard/lesson/${lesson.id}/validate/${game.id}`}>
                  <Button variant="outline" className="mt-3 w-full">
                    Edit Validation
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/20 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
