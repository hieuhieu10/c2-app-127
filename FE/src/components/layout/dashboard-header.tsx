'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { getUserInitials } from '@/lib/utils'

export function DashboardHeader() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  if (!user) {
    return null
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const avatarLabel = user.name?.trim() || user.email || 'User'
  const avatarTitle = user.email ? `${avatarLabel} (${user.email})` : avatarLabel
  const initials = getUserInitials(user.name, user.email)

  async function handleSignOut() {
    setIsUserMenuOpen(false)
    await signOut()
    router.push('/signin')
  }

  function handleProfileClick() {
    setIsUserMenuOpen(false)
    router.push('/dashboard/account')
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="text-2xl font-bold text-primary hover:opacity-80">
          LearnGame
        </Link>
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
            title={avatarTitle}
            aria-label="Open user menu"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
            onClick={() => setIsUserMenuOpen((open) => !open)}
          >
            {initials}
          </button>

          {isUserMenuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-lg border border-border bg-card py-1 text-sm text-card-foreground shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-muted"
                onClick={handleProfileClick}
              >
                Profile
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-muted"
                onClick={() => void handleSignOut()}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
