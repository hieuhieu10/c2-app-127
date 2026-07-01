'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, Maximize2, Minimize2 } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi, mapBeWebGame, mapBeWebLesson } from '@/features/game-library/services/be-web'
import { GameShell } from '@/features/game-shells/GameShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { BrandLogo } from '@/components/layout/brand-logo'
import type { Game, Lesson } from '@/types/app'

export default function ReviewPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const lessonId = params.lessonId as string
  const gameId = params.gameId as string

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [game, setGame] = useState<Game | null>(null)
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
          <Button>Quay lại bảng điều khiển</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/5">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1720px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <BrandLogo />
          <div className="text-sm text-muted-foreground">Trò chơi đã duyệt</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1720px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              {game.status === 'published' ? 'Đã xuất bản' : 'Đã duyệt'}
            </div>
            <h1 className="text-3xl font-bold text-foreground">{lesson.title}</h1>
            <p className="mt-2 text-muted-foreground">
              Bản chơi thử cuối cùng với nội dung đã được giáo viên duyệt và kiểm tra xác thực.
            </p>

            <div
              className={
                isFullscreen
                  ? 'fixed inset-0 z-50 flex h-[100dvh] flex-col overflow-hidden bg-[#0686c2] p-3 text-foreground'
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
                  aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                  title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
                  className={isFullscreen ? 'h-8 w-8 border border-border bg-white/85 text-foreground shadow-sm backdrop-blur hover:bg-white' : ''}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              <div className={isFullscreen ? 'flex h-[calc(100dvh-24px)] w-full items-center justify-center overflow-hidden pr-12' : 'min-w-0'}>
                <div className={isFullscreen ? 'flex h-full w-full items-center justify-center' : 'min-w-0'}>
                  <GameShell game={game} fullscreen={isFullscreen} />
                </div>
              </div>
            </div>
          </div>

          <aside className={isFullscreen ? 'hidden' : 'space-y-6'}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tóm tắt kiểm duyệt</CardTitle>
                <CardDescription>Kiểm tra của giáo viên và hệ thống trước khi phát hành.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SummaryRow label="Số mục" value={`${game.items.length}`} />
                <SummaryRow label="Schema hợp lệ" value={`${game.items.filter((item) => item.validationStatus === 'valid').length}/${game.items.length}`} />
                <SummaryRow
                  label="Độ bám sát TB"
                  value={`${Math.round((game.items.reduce((sum, item) => sum + (item.faithfulnessScore ?? 0), 0) / game.items.length) * 100)}%`}
                />
                <SummaryRow label="An toàn" value={game.items.some((item) => item.safetyStatus === 'blocked') ? 'Bị chặn' : 'Đạt'} />
                <Link href={`/dashboard/lesson/${lesson.id}/validate/${game.id}`}>
                  <Button variant="outline" className="mt-3 w-full">
                    Chỉnh phần kiểm duyệt
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
