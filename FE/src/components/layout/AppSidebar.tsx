'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi, type BeWebChatSessionSummary } from '@/features/game-library/services/be-web'
import { UserAvatar } from '@/components/ui/user-avatar'
import { useEffect, useRef, useState } from 'react'

const s = {
  sidebar: {
    width: 256, flexShrink: 0, background: '#fff',
    borderRight: '1px solid #e9ebf1', display: 'flex',
    flexDirection: 'column' as const, padding: '18px 16px',
    height: '100dvh', boxSizing: 'border-box' as const,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 11, padding: '4px 6px 18px' },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10, background: '#4f46e5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 4px 10px rgba(79,70,229,.28)',
  },
  newBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, width: '100%', border: 'none', cursor: 'pointer',
    background: '#4f46e5', color: '#fff', fontFamily: 'inherit',
    fontWeight: 600, fontSize: 14.5, padding: '11px', borderRadius: 11,
    boxShadow: '0 4px 12px rgba(79,70,229,.25)',
  },
  navActive: {
    display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px',
    borderRadius: 9, textDecoration: 'none', color: '#4f46e5',
    background: '#eef0fe', fontWeight: 600, fontSize: 14,
  },
  navInactive: {
    display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px',
    borderRadius: 9, textDecoration: 'none', color: '#5b6577',
    fontWeight: 500, fontSize: 14,
  },
  recentLabel: {
    fontSize: 11.5, fontWeight: 600, letterSpacing: '.6px',
    textTransform: 'uppercase' as const, color: '#9aa2b2', padding: '0 11px 8px',
  },
  recentActive: {
    display: 'block', padding: '8px 11px', borderRadius: 8, textDecoration: 'none',
    color: '#3730a3', fontSize: 13.5, fontWeight: 600, background: '#eef0fe',
  },
  recentInactive: {
    display: 'block', padding: '8px 11px', borderRadius: 8, textDecoration: 'none',
    color: '#5b6577', fontSize: 13.5,
  },
  recentSection: {
    marginTop: 22,
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: '1 1 0',
    gap: 1,
    minHeight: 0,
    maxHeight: '100%',
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    overscrollBehavior: 'contain' as const,
    paddingRight: 4,
    scrollbarWidth: 'thin' as const,
    scrollbarColor: '#c8d0e2 transparent',
  },
  recentItemTitle: {
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    lineHeight: 1.4,
    wordBreak: 'break-word' as const,
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 10,
    border: 'none', borderTop: '1px solid #eef0f4', marginTop: 8, background: '#fff',
    cursor: 'pointer', textAlign: 'left' as const, borderRadius: 12,
  },
  userMenu: {
    position: 'absolute' as const, left: 0, bottom: 58, zIndex: 20, width: 180,
    overflow: 'hidden', borderRadius: 12, border: '1px solid #e3e7ef',
    background: '#fff', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.14)', padding: '6px 0',
  },
  userMenuItem: {
    display: 'flex', alignItems: 'center', width: '100%', padding: '10px 14px',
    border: 'none', background: 'transparent', color: '#1b2333', cursor: 'pointer',
    textAlign: 'left' as const, fontSize: 14, fontFamily: 'inherit',
  },
}

export function AppSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [recentSessions, setRecentSessions] = useState<BeWebChatSessionSummary[]>([])
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const currentSessionId = searchParams.get('session')

  useEffect(() => {
    beWebApi.listChatSessions().then(setRecentSessions).catch(() => {})
  }, [currentSessionId])

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

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')
  const isSessionActive = (sessionId: number) => pathname === '/dashboard/game/new' && currentSessionId === String(sessionId)
  const avatarLabel = user?.name?.trim() || user?.email || 'Giáo viên'
  const avatarTitle = user?.email ? `${avatarLabel} (${user.email})` : avatarLabel

  async function handleSignOut() {
    setIsUserMenuOpen(false)
    await signOut()
    router.push('/signin')
  }

  function handleProfileClick() {
    setIsUserMenuOpen(false)
    router.push('/dashboard/account')
  }

  function getSessionLabel(session: BeWebChatSessionSummary) {
    return session.title || session.lastMessagePreview || 'Untitled chat'
  }

  return (
    <aside style={s.sidebar}>
      <style>{`
        .sidebar-recent-list::-webkit-scrollbar {
          width: 6px;
        }
        .sidebar-recent-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-recent-list::-webkit-scrollbar-thumb {
          background: #c8d0e2;
          border-radius: 999px;
          border: 1px solid #fff;
        }
        .sidebar-recent-list::-webkit-scrollbar-thumb:hover {
          background: #aeb8cd;
        }
      `}</style>
      <div style={s.logo}>
        <div style={s.logoIcon}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="#fff"><path d="M4 3l9 5-9 5z"/></svg>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-.2px' }}>Học Mà Chơi</div>
          <div style={{ fontSize: 11.5, color: '#8b94a6', letterSpacing: '.2px' }}>Trình tạo trò chơi · AI</div>
        </div>
      </div>

      <Link href="/dashboard/game/new" style={{ textDecoration: 'none' }}>
        <button style={s.newBtn}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
          Tạo trò chơi mới
        </button>
      </Link>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 18 }}>
        <Link href="/dashboard" style={isActive('/dashboard') && !isActive('/dashboard/game') ? s.navActive : s.navInactive}>
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>
          Trò chơi của tôi
        </Link>
        <a href="#" style={s.navInactive}>
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M4 5.5A1.5 1.5 0 015.5 4H9v12H5.5A1.5 1.5 0 014 14.5z"/><path d="M16 5.5A1.5 1.5 0 0014.5 4H11v12h3.5A1.5 1.5 0 0016 14.5z"/></svg>
          Thư viện mẫu
        </a>
        <a href="#" style={s.navInactive}>
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="7" cy="7" r="2.5"/><circle cx="14" cy="8" r="2"/><path d="M3 16c0-2.2 1.8-4 4-4s4 1.8 4 4M12 16c0-1.6.8-3 2-3.6"/></svg>
          Lớp học của tôi
        </a>
        <a href="#" style={s.navInactive}>
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 16V9M10 16V4M16 16v-5"/></svg>
          Phân tích
        </a>
      </nav>

      <div style={s.recentSection}>
        <div style={s.recentLabel}>Gần đây</div>
        <div className="sidebar-recent-list" style={s.recentList}>
          {recentSessions.length > 0 ? recentSessions.map((session) => {
            const active = isSessionActive(session.id)
            const label = getSessionLabel(session)
            return (
            <Link
              key={session.id}
              href={`/dashboard/game/new?session=${session.id}`}
              style={{
                ...(active ? s.recentActive : s.recentInactive),
                minWidth: 0,
              }}
              title={label}
              onMouseEnter={(event) => {
                if (!active) {
                  event.currentTarget.style.background = '#f4f3ff'
                  event.currentTarget.style.color = '#4338ca'
                }
              }}
              onMouseLeave={(event) => {
                if (!active) {
                  event.currentTarget.style.background = 'transparent'
                  event.currentTarget.style.color = '#5b6577'
                }
              }}
            >
              <span style={s.recentItemTitle}>{label}</span>
            </Link>
            )
          }) : (
            <span style={{ ...s.recentInactive, display: 'block', fontStyle: 'italic' }}>Chưa có đoạn chat nào</span>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', flexShrink: 0, background: '#fff' }} ref={menuRef}>
        {isUserMenuOpen ? (
          <div role="menu" style={s.userMenu}>
            <button
              type="button"
              role="menuitem"
              style={s.userMenuItem}
              onClick={handleProfileClick}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = '#f4f6fa'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent'
              }}
            >
              Profile
            </button>
            <button
              type="button"
              role="menuitem"
              style={s.userMenuItem}
              onClick={() => void handleSignOut()}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = '#f4f6fa'
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent'
              }}
            >
              Sign out
            </button>
          </div>
        ) : null}

        <button
          type="button"
          style={s.userRow}
          title={avatarTitle}
          aria-label="Open user menu"
          aria-expanded={isUserMenuOpen}
          aria-haspopup="menu"
          onClick={() => setIsUserMenuOpen((open) => !open)}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = '#f8f9fc'
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = '#fff'
          }}
          onFocus={(event) => {
            event.currentTarget.style.background = '#f8f9fc'
          }}
          onBlur={(event) => {
            event.currentTarget.style.background = '#fff'
          }}
        >
          <UserAvatar
            name={user?.name}
            email={user?.email}
            avatarUrl={user?.avatarUrl}
            sizeClassName="h-[34px] w-[34px]"
            textClassName="text-[13px]"
            title={avatarTitle}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || user?.email || 'Giáo viên'}
            </div>
            <div style={{ fontSize: 11.5, color: '#8b94a6' }}>GV · Học Mà Chơi</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa2b2" strokeWidth="1.6"><circle cx="10" cy="10" r="2.4"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M15 5l-1.4 1.4M6.4 13.6L5 15"/></svg>
        </button>
      </div>
    </aside>
  )
}
