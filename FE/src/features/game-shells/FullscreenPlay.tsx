'use client'

import { useEffect } from 'react'
import type { Game } from '@/types/app'
import { GameShell } from './GameShell'
import type { GameDefinition } from './registry'

interface FullscreenPlayProps {
  title: string
  def?: GameDefinition
  game: Game
  onClose: () => void
}

/**
 * Full-screen, focused "play now" view. Renders the game's shell in play mode —
 * every game is inline-playable, so this is a thin focused wrapper.
 */
export function FullscreenPlay({ title, def, game, onClose }: FullscreenPlayProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(12,16,28,.82)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', color: '#fff' }}>
        <span style={{ fontSize: 20 }}>{def?.icon ?? '🎮'}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          <div style={{ fontSize: 12, opacity: .7 }}>Chế độ chơi thử · nhấn Esc để thoát</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.1)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '8px 14px', borderRadius: 10, cursor: 'pointer' }}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>
          Thoát
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, padding: '0 16px 16px' }}>
        <div style={{ height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8px 0 24px' }}>
          <div style={{ width: '100%', maxWidth: 880 }}>
            <GameShell game={game} previewMode={false} />
          </div>
        </div>
      </div>
    </div>
  )
}
