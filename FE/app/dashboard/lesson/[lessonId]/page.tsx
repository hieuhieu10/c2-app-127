'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'

export default function LessonDetailPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}
