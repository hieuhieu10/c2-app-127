'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi, type BeWebGameSummary } from '@/features/game-library/services/be-web'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { DashboardHeader } from '@/components/layout/dashboard-header'

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [games, setGames] = useState<BeWebGameSummary[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/signin')
      return
    }

    setLoadingGames(true)
    setLoadError(null)
    beWebApi
      .listGames()
      .then((response) => {
        setGames(response)
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to load games'
        setLoadError(message)
        if (message.includes('401')) {
          router.push('/signin')
        }
      })
      .finally(() => {
        setLoadingGames(false)
      })
  }, [authLoading, router, user])

  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const openGame = (game: BeWebGameSummary) => {
    const target =
      game.status === 'approved' || game.status === 'published'
        ? `/dashboard/lesson/${game.lessonId}/review/${game.gameId}`
        : `/dashboard/lesson/${game.lessonId}/validate/${game.gameId}`
    router.push(target)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Games</h1>
            <p className="mt-2 text-muted-foreground">
              Create, review, and publish learning games for your class.
            </p>
          </div>
          <Link href="/dashboard/lesson/new">
            <Button className="bg-primary hover:bg-primary/90">Create New Game</Button>
          </Link>
        </div>

        {loadingGames ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : loadError ? (
          <Card>
            <CardHeader>
              <CardTitle>Unable to load games</CardTitle>
              <CardDescription>{loadError}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => router.refresh()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : games.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No games loaded yet</CardTitle>
              <CardDescription>
                Start by creating a Treasure Hunt game. Generated games will appear here after they are saved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard/lesson/new">
                <Button variant="outline">Choose Template</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {games.map((game) => (
              <button
                key={game.gameId}
                type="button"
                onClick={() => openGame(game)}
                className="text-left"
              >
                <Card className="transition-shadow hover:shadow-md">
                  <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle>{game.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{game.input}</CardDescription>
                    </div>
                    <StatusBadge status={game.status} />
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-5">
                      <Info label="Template" value="Treasure Hunt" />
                      <Info label="Items" value={String(game.itemCount)} />
                      <Info label="Subject" value={game.subject} />
                      <Info label="Grade" value={`Grade ${game.grade}`} />
                      <Info label="Updated" value={formatDate(game.updatedAt)} />
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/20 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: BeWebGameSummary['status'] }) {
  const styles: Record<BeWebGameSummary['status'], string> = {
    draft: 'border-amber-200 bg-amber-50 text-amber-800',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    published: 'border-sky-200 bg-sky-50 text-sky-800',
    generation_failed: 'border-rose-200 bg-rose-50 text-rose-800',
  }

  return (
    <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${styles[status]}`}>
      {status.replace('_', ' ')}
    </div>
  )
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
