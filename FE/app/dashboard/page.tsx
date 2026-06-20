'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { beWebApi, type BeWebGameSummary } from '@/features/game-library/services/be-web'
import { listLocalGames, deleteLocalGame, type LocalGame } from '@/features/game-library/services/local-games'
import { getTemplateByBackendId } from '@/features/game-creation/template-registry'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Spinner } from '@/components/ui/spinner'

function StatusChip({ status }: { status: BeWebGameSummary['status'] }) {
  const cfg = {
    draft:             { label: 'Bản nháp',    color: '#b06f00', bg: '#fdf3e0', border: '#f5e2bb' },
    approved:          { label: 'Đã duyệt',    color: '#047a55', bg: '#e7f7f0', border: '#c4ecd9' },
    published:         { label: 'Đã xuất bản', color: '#047a55', bg: '#e7f7f0', border: '#c4ecd9' },
    generation_failed: { label: 'Lỗi tạo',     color: '#e11d48', bg: '#fee2e6', border: '#fecaca' },
  }[status] ?? { label: status, color: '#5b6577', bg: '#f1f3f7', border: '#e7e9f0' }

  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 7, padding: '3px 9px', flexShrink: 0 }}>
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? '').toLowerCase()
}

function matchBeGame(game: BeWebGameSummary, query: string) {
  if (!query) return true
  return [
    game.title,
    game.subject,
    game.grade,
    game.status,
    game.input,
  ].some((field) => normalizeText(field).includes(query))
}

function matchLocalGame(game: LocalGame, query: string) {
  if (!query) return true
  return [
    game.templateName,
    game.metadata.subject,
    game.metadata.grade,
  ].some((field) => normalizeText(field).includes(query))
}

function DashboardPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [games, setGames] = useState<BeWebGameSummary[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [localGames, setLocalGames] = useState<LocalGame[]>([])
  const [searchText, setSearchText] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/signin'); return }

    setLocalGames(listLocalGames())

    beWebApi.listGames()
      .then(setGames)
      .catch(err => {
        const msg = err instanceof Error ? err.message : 'Không thể tải danh sách trò chơi'
        setLoadError(msg)
        if (msg.includes('401')) router.push('/signin')
      })
      .finally(() => setLoadingGames(false))
  }, [authLoading, router, user])

  useEffect(() => {
    setSearchText(searchParams.get('q') ?? '')
  }, [searchParams])

  const openLocalGame = (g: LocalGame) => {
    sessionStorage.setItem('gamePreviewData', JSON.stringify({
      templateId: g.templateId,
      templateName: g.templateName,
      content: g.content,
      safetyReport: g.safetyReport,
      metadata: g.metadata,
      localId: g.id,
    }))
    router.push('/dashboard/game/preview')
  }

  const removeLocalGame = (id: string) => {
    deleteLocalGame(id)
    setLocalGames(listLocalGames())
  }

  const query = searchText.trim().toLowerCase()
  const filteredGames = useMemo(() => games.filter((game) => matchBeGame(game, query)), [games, query])
  const filteredLocalGames = useMemo(() => localGames.filter((game) => matchLocalGame(game, query)), [localGames, query])
  const hasSearch = query.length > 0
  const hasAnyGames = localGames.length > 0 || games.length > 0
  const hasSearchResults = filteredLocalGames.length > 0 || filteredGames.length > 0

  if (authLoading || !user) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  }

  const updateQuery = (value: string) => {
    setSearchText(value)
    const params = new URLSearchParams(searchParams.toString())
    const trimmedValue = value.trim()
    if (trimmedValue) {
      params.set('q', value)
    } else {
      params.delete('q')
    }
    const next = params.toString()
    router.replace(next ? `${pathname}?${next}` : pathname)
  }

  const openGame = (g: BeWebGameSummary) => {
    const target = g.status === 'approved' || g.status === 'published'
      ? `/dashboard/lesson/${g.lessonId}/review/${g.gameId}`
      : `/dashboard/lesson/${g.lessonId}/validate/${g.gameId}`
    router.push(target)
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', fontFamily: "'Be Vietnam Pro', sans-serif", background: '#f4f5f8', color: '#1b2333', overflow: 'hidden' }}>
      <AppSidebar />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{ minHeight: 60, flexShrink: 0, borderBottom: '1px solid #e9ebf1', background: '#fff', padding: '12px 26px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(300px, 520px) minmax(180px, 1fr)', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.2px' }}>Trò chơi của tôi</span>
            <div style={{ position: 'relative', width: '100%', justifySelf: 'center' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#8b94a6', display: 'inline-flex', pointerEvents: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="9" r="5.5" />
                  <path d="M13.5 13.5L17 17" />
                </svg>
              </span>
              <input
                type="search"
                value={searchText}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Tìm kiếm trò chơi..."
                aria-label="Tìm kiếm trò chơi"
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 12,
                  border: '1px solid #dbe1eb',
                  background: '#f8faff',
                  padding: '0 40px 0 38px',
                  fontSize: 13.5,
                  color: '#1b2333',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.04)',
                }}
              />
              {searchText ? (
                <button
                  type="button"
                  onClick={() => updateQuery('')}
                  aria-label="Xóa tìm kiếm"
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    border: 'none',
                    background: '#e9edf5',
                    color: '#667085',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 5l10 10M15 5L5 15" />
                  </svg>
                </button>
              ) : null}
            </div>
            <div aria-hidden="true" />
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '30px 32px' }}>
          {filteredLocalGames.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>Đã lưu trên thiết bị này</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#5b6577', background: '#f1f3f7', borderRadius: 6, padding: '2px 8px' }}>{filteredLocalGames.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredLocalGames.map(g => {
                  const icon = getTemplateByBackendId(g.templateId)?.icon ?? '🎮'
                  const count = Array.isArray((g.content as { questions?: unknown[] }).questions)
                    ? ((g.content as { questions: unknown[] }).questions).length : 0
                  return (
                    <div key={g.id} style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 2px rgba(16,24,40,.03)' }}>
                      <button type="button" onClick={() => openLocalGame(g)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 19 }}>{icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.templateName}: {g.metadata.subject} lớp {g.metadata.grade}</div>
                          <div style={{ fontSize: 12.5, color: '#8b94a6' }}>{g.metadata.subject} · Lớp {g.metadata.grade} · {count} câu · {formatDate(g.updatedAt)}</div>
                        </div>
                      </button>
                      <StatusChip status={g.status} />
                      <button type="button" onClick={() => removeLocalGame(g.id)} title="Xoá" style={{ display: 'inline-flex', border: 'none', background: 'none', color: '#c2c8d4', cursor: 'pointer', padding: 4 }}>
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h12M8 6V4.5h4V6M7 6l.6 9a1 1 0 001 .9h2.8a1 1 0 001-.9L13 6"/></svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loadingGames ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}><Spinner /></div>
          ) : loadError ? (
            <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1b2333', marginBottom: 6 }}>Không thể tải trò chơi</div>
              <div style={{ fontSize: 13.5, color: '#8b94a6' }}>{loadError}</div>
            </div>
          ) : hasSearch && hasAnyGames && !hasSearchResults ? (
            <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '42px 24px', textAlign: 'center', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Không tìm thấy trò chơi phù hợp</div>
              <div style={{ fontSize: 14, color: '#8b94a6', marginBottom: 18 }}>Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm hiện tại.</div>
              <button
                type="button"
                onClick={() => updateQuery('')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #d8def0', cursor: 'pointer', background: '#f8faff', color: '#4338ca', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, padding: '10px 16px', borderRadius: 10 }}
              >
                Xóa tìm kiếm
              </button>
            </div>
          ) : games.length === 0 ? (
            localGames.length > 0 ? null : (
            <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: '#eef0fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <svg width="22" height="22" viewBox="0 0 20 20" fill="#4f46e5"><path d="M10 2l1.7 4.6L16.5 8l-4.8 1.4L10 14l-1.7-4.6L3.5 8l4.8-1.4z"/></svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Chưa có trò chơi nào</div>
              <div style={{ fontSize: 14, color: '#8b94a6', marginBottom: 20 }}>Tạo trò chơi học tập đầu tiên của bạn ngay bây giờ.</div>
              <Link href="/dashboard/game/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, padding: '11px 22px', borderRadius: 11, textDecoration: 'none', boxShadow: '0 4px 12px rgba(79,70,229,.25)' }}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
                Tạo trò chơi mới
              </Link>
            </div>
            )
          ) : filteredGames.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredGames.map(g => (
                <button key={g.gameId} type="button" onClick={() => openGame(g)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}>
                  <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 2px rgba(16,24,40,.03)', transition: 'box-shadow .15s' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#4f46e5" strokeWidth="1.7"><rect x="3" y="4" width="6" height="6" rx="1.4"/><rect x="11" y="10" width="6" height="6" rx="1.4"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{g.title}</div>
                      <div style={{ fontSize: 12.5, color: '#8b94a6' }}>{g.subject} · Lớp {g.grade} · {g.itemCount} câu · {formatDate(g.updatedAt)}</div>
                    </div>
                    <StatusChip status={g.status} />
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#c2c8d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5l5 5-5 5"/></svg>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  )
}
