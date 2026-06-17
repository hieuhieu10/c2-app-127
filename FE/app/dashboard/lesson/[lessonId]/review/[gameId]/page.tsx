'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Copy, ExternalLink, Rocket } from 'lucide-react'
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-2xl font-bold text-primary hover:opacity-80">
            LearnGame
          </Link>
          <div className="text-sm text-muted-foreground">Approved Game</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {game.status === 'published' ? 'Published' : 'Approved'}
            </div>
            <h1 className="text-3xl font-bold text-foreground">{lesson.title}</h1>
            <p className="mt-2 text-muted-foreground">
              Final playable game preview with teacher-approved content and validation checks.
            </p>
          </div>

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
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <GameShell game={game} />

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
