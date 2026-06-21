'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi, mapBeWebGame, mapBeWebItem, mapBeWebLesson } from '@/features/game-library/services/be-web'
import { ItemReviewPanel } from '@/features/game-preview/components/ItemReviewPanel'
import { TeacherEditForm } from '@/features/game-preview/components/TeacherEditForm'
import { ValidationBadge } from '@/features/game-preview/components/ValidationBadge'
import { validateGameItem, validateGameItems } from '@/features/game-preview/services/validation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { Game, GameItem, Lesson } from '@/types/app'

export default function ValidationPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const lessonId = params.lessonId as string
  const gameId = params.gameId as string

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
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
        const mappedGame = mapBeWebGame(beWebGame)
        setLesson(mapBeWebLesson(beWebGame))
        setGame({
          ...mappedGame,
          items: mappedGame.items.some((item) => item.validationStatus === 'pending')
            ? validateGameItems(mappedGame.items)
            : mappedGame.items,
        })
        setLoading(false)
      })
      .catch((error) => {
        console.error('Failed to load game:', error)
        router.push('/dashboard')
      })
  }, [authLoading, gameId, lessonId, router, user])

  const updateSelectedItem = async (nextItem: GameItem) => {
    if (!game) return
    const items = [...game.items]
    items[selectedIndex] = nextItem
    setGame({ ...game, items })
    try {
      const saved = await beWebApi.updateItem(game.id, nextItem.id, nextItem)
      items[selectedIndex] = mapBeWebItem(saved)
      setGame({ ...game, items })
    } catch (error) {
      console.error('Failed to save item:', error)
    }
  }

  const validateSelectedItem = async () => {
    if (!game) return
    const items = [...game.items]
    try {
      const checked = await beWebApi.recheckItem(game.id, items[selectedIndex].id)
      items[selectedIndex] = mapBeWebItem(checked)
    } catch (error) {
      console.error('BE_Web recheck failed:', error)
      items[selectedIndex] = validateGameItem(items[selectedIndex])
    }
    setGame({ ...game, items })
  }

  const approveGame = async () => {
    if (!lesson || !game) return

    const validatedItems = validateGameItems(game.items)
    const allValid = validatedItems.every((item) => item.validationStatus === 'valid' && item.safetyStatus !== 'blocked')

    if (!allValid) {
      setGame({ ...game, items: validatedItems })
      return
    }

    try {
      await beWebApi.approveGame(game.id)
      router.push(`/dashboard/lesson/${lesson.id}/review/${game.id}`)
    } catch (error) {
      console.error('Failed to approve game:', error)
      alert(error instanceof Error ? error.message : 'Failed to approve game')
    }
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

  const selectedItem = game.items[selectedIndex]
  const allItemsValid = game.items.every((item) => item.validationStatus === 'valid' && item.safetyStatus !== 'blocked')
  const queueItems = game.items.slice(selectedIndex, selectedIndex + 3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="text-2xl font-bold text-primary hover:opacity-80">
            LearnGame
          </Link>
          <div className="text-sm text-muted-foreground">Step 4 of 4: Preview, Validate, Approve</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Teacher Review Workspace</h1>
            <p className="mt-2 text-muted-foreground">
              Review generated content, inspect validation evidence, edit weak items, then approve for class use.
            </p>
          </div>
          <Button onClick={approveGame} disabled={!allItemsValid} className="lg:w-56">
            Approve Game
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
          <ItemReviewPanel items={game.items} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <TeacherEditForm
              item={selectedItem}
              itemNumber={selectedIndex + 1}
              onChange={updateSelectedItem}
              onValidate={validateSelectedItem}
            />
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Review Queue</CardTitle>
                <CardDescription>Next items to inspect.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {queueItems.map((item) => {
                  const index = game.items.findIndex((candidate) => candidate.id === item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        selectedIndex === index ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/30'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Item {index + 1}</span>
                        <ValidationBadge status={item.validationStatus} />
                      </div>
                      <p className="line-clamp-3 text-sm text-muted-foreground">{item.question}</p>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
