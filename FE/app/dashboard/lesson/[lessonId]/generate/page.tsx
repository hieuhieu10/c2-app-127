'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'

export default function GeneratePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const lessonId = searchParams.get('lessonId')
  const gameId = searchParams.get('gameId')

  useEffect(() => {
    if (!lessonId || !gameId) {
      router.push('/dashboard')
      return
    }
    router.replace(`/dashboard/lesson/${lessonId}/validate/${gameId}`)
  }, [gameId, lessonId, router])

  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}
