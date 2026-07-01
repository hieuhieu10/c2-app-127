'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { Spinner } from '@/components/ui/spinner'
import { GAMES, type GameDefinition } from '@/features/game-shells/registry'
import { CreateGameModal } from '@/features/game-library/components/CreateGameModal'
import { GuideModal } from '@/features/game-library/components/GuideModal'

type ModalKind = 'create' | 'guide'

/** Colour scheme for the game classification tag shown on each library card. */
function categoryStyle(category: string): { background: string; color: string; borderColor: string } {
  if (category === 'Toán học') return { background: '#eaf1ff', color: '#1e51b8', borderColor: '#d4e2fb' }
  // 'Tổng quát' and any future general-purpose tag.
  return { background: '#e7f7ef', color: '#0f7b4f', borderColor: '#cdeedd' }
}

export default function GameLibraryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [active, setActive] = useState<{ game: GameDefinition; kind: ModalKind } | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('Tất cả')

  const categories = ['Tất cả', ...Array.from(new Set(GAMES.map((game) => game.category)))]
  const visibleGames = activeCategory === 'Tất cả'
    ? GAMES
    : GAMES.filter((game) => game.category === activeCategory)

  useEffect(() => {
    if (authLoading) return
    if (!user) router.push('/signin')
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', fontFamily: "'Be Vietnam Pro', sans-serif", background: '#f4f5f8', color: '#1b2333', overflow: 'hidden' }}>
      <AppSidebar />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            minHeight: 60,
            flexShrink: 0,
            borderBottom: '1px solid #e9ebf1',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '10px 26px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.2px' }}>Thư viện game</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            {categories.map((category) => {
              const activeFilter = category === activeCategory
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  style={{
                    border: activeFilter ? '1px solid #c7c5f7' : '1px solid #e3e6ee',
                    background: activeFilter ? '#eef0fe' : '#fff',
                    color: activeFilter ? '#4338ca' : '#5b6577',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: activeFilter ? 700 : 600,
                    padding: '8px 13px',
                    borderRadius: 999,
                    cursor: 'pointer',
                    boxShadow: activeFilter ? '0 4px 12px rgba(79,70,229,.12)' : 'none',
                  }}
                >
                  {category}
                </button>
              )
            })}
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '30px 32px' }}>
          {visibleGames.length === 0 ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid #e9ebf1',
                borderRadius: 16,
                padding: '28px 24px',
                color: '#5b6577',
                fontSize: 14,
                boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)',
              }}
            >
              Chưa có trò chơi nào trong nhóm <strong>{activeCategory}</strong>.
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }}>
            {visibleGames.map((game) => (
              <div
                key={game.backendId}
                style={{
                  background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '20px',
                  display: 'flex', flexDirection: 'column', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {game.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{game.title}</div>
                    <div style={{ fontSize: 12.5, color: '#8b94a6', marginTop: 2 }}>{game.interactionType}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: '4px 10px', whiteSpace: 'nowrap',
                      flexShrink: 0, ...categoryStyle(game.category),
                      borderWidth: 1, borderStyle: 'solid',
                    }}
                  >
                    {game.category}
                  </span>
                </div>

                <div style={{ fontSize: 13.5, color: '#5b6577', lineHeight: 1.55, flex: 1, marginBottom: 14 }}>
                  {game.description}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 16 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3730a3', background: '#eef0fe', border: '1px solid #e0e2fb', borderRadius: 7, padding: '3px 9px', whiteSpace: 'nowrap' }}>
                    Phù hợp
                  </span>
                  <span style={{ fontSize: 12.5, color: '#5b6577', lineHeight: 1.5 }}>{game.bestFor}</span>
                </div>

                <div style={{ display: 'flex', gap: 9, marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => setActive({ game, kind: 'create' })}
                    style={{
                      flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff',
                      fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, padding: '10px', borderRadius: 10,
                      boxShadow: '0 4px 12px rgba(79,70,229,.22)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 4v12M4 10h12" /></svg>
                    Tạo trò chơi
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive({ game, kind: 'guide' })}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      border: '1px solid #e3e6ee', cursor: 'pointer', background: '#fff', color: '#5b6577',
                      fontFamily: 'inherit', fontWeight: 600, fontSize: 13.5, padding: '10px 14px', borderRadius: 10,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 9v4.5M10 6.5v.2" /></svg>
                    Hướng dẫn
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {active?.kind === 'create' ? (
        <CreateGameModal game={active.game} onClose={() => setActive(null)} />
      ) : null}
      {active?.kind === 'guide' ? (
        <GuideModal game={active.game} onClose={() => setActive(null)} />
      ) : null}
    </div>
  )
}
