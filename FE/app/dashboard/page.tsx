'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [games, setGames] = useState<BeWebGameSummary[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [localGames, setLocalGames] = useState<LocalGame[]>([])

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

  if (authLoading || !user) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  }

  const openGame = (g: BeWebGameSummary) => {
    const target = g.status === 'approved' || g.status === 'published'
      ? `/dashboard/lesson/${g.lessonId}/review/${g.gameId}`
      : `/dashboard/lesson/${g.lessonId}/validate/${g.gameId}`
    router.push(target)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', fontFamily: "'Be Vietnam Pro', sans-serif", background: '#f4f5f8', color: '#1b2333', overflow: 'hidden' }}>
      <AppSidebar />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{ height: 60, flexShrink: 0, borderBottom: '1px solid #e9ebf1', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 26px' }}>
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.2px' }}>Trò chơi của tôi</span>
          <Link href="/dashboard/game/new" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, padding: '9px 16px', borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 10px rgba(79,70,229,.25)' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
            Tạo trò chơi mới
          </Link>
        </header>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '30px 32px' }}>
          {localGames.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>Đã lưu trên thiết bị này</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#5b6577', background: '#f1f3f7', borderRadius: 6, padding: '2px 8px' }}>{localGames.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {localGames.map(g => {
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {games.map(g => (
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
          )}
        </div>
      </main>
    </div>
  )
}
