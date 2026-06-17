'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'

export default function DeprecatedTemplatePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/lesson/new')
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}
