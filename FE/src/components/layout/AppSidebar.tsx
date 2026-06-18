'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi, type BeWebGameSummary } from '@/features/game-library/services/be-web'
import { useEffect, useState } from 'react'

const s = {
  sidebar: {
    width: 256, flexShrink: 0, background: '#fff',
    borderRight: '1px solid #e9ebf1', display: 'flex',
    flexDirection: 'column' as const, padding: '18px 16px',
    height: '100vh', boxSizing: 'border-box' as const,
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
    color: '#1b2333', fontSize: 13.5, fontWeight: 500, background: '#f4f5f8',
  },
  recentInactive: {
    display: 'block', padding: '8px 11px', borderRadius: 8, textDecoration: 'none',
    color: '#5b6577', fontSize: 13.5,
  },
  userRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: 10,
    borderTop: '1px solid #eef0f4', marginTop: 8,
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', background: '#dfe3ee',
    color: '#4a5570', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: 13, flexShrink: 0,
  },
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [recentGames, setRecentGames] = useState<BeWebGameSummary[]>([])

  useEffect(() => {
    beWebApi.listGames().then(g => setRecentGames(g.slice(0, 4))).catch(() => {})
  }, [])

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : (user?.email?.[0] ?? 'T').toUpperCase()

  return (
    <aside style={s.sidebar}>
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

      <div style={{ marginTop: 22, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={s.recentLabel}>Gần đây</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          {recentGames.length > 0 ? recentGames.map((g, i) => (
            <Link
              key={g.gameId}
              href={`/dashboard/lesson/${g.lessonId}/review/${g.gameId}`}
              style={i === 0 ? s.recentActive : s.recentInactive}
            >
              {g.title}
            </Link>
          )) : (
            <span style={{ ...s.recentInactive, display: 'block', fontStyle: 'italic' }}>Chưa có trò chơi nào</span>
          )}
        </div>
      </div>

      <div style={s.userRow}>
        <div style={s.avatar}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name || user?.email || 'Giáo viên'}
          </div>
          <div style={{ fontSize: 11.5, color: '#8b94a6' }}>GV · Học Mà Chơi</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#9aa2b2" strokeWidth="1.6"><circle cx="10" cy="10" r="2.4"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M15 5l-1.4 1.4M6.4 13.6L5 15"/></svg>
      </div>
    </aside>
  )
}
