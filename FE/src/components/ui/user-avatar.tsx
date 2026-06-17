'use client'

import { useEffect, useState } from 'react'
import { getUserInitials } from '@/lib/utils'

interface UserAvatarProps {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  sizeClassName?: string
  textClassName?: string
  className?: string
  title?: string
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  sizeClassName = 'h-9 w-9',
  textClassName = 'text-sm',
  className = '',
  title,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = getUserInitials(name, email)

  useEffect(() => {
    setImageFailed(false)
  }, [avatarUrl])

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border border-border bg-secondary font-semibold text-secondary-foreground ${sizeClassName} ${textClassName} ${className}`.trim()}
      title={title}
      aria-label={title}
    >
      {avatarUrl && !imageFailed ? (
        <img
          src={avatarUrl}
          alt={name || email || 'User avatar'}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  )
}
