'use client'

import { useState } from 'react'
import type { GameDefinition } from '@/features/game-shells/registry'

interface GuideModalProps {
  game: GameDefinition
  onClose: () => void
}

export function GuideModal({ game, onClose }: GuideModalProps) {
  const [mediaError, setMediaError] = useState(false)
  const mediaSrc = game.howToPlayMedia
  const isVideo = !!mediaSrc && /\.(webm|mp4|ogg)$/i.test(mediaSrc)
  const showMedia = !!mediaSrc && !mediaError

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500, maxHeight: '90dvh', overflowY: 'auto',
          background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(15,23,42,.28)',
          fontFamily: "'Be Vietnam Pro', sans-serif", color: '#1b2333',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '20px 22px', borderBottom: '1px solid #eef0f4' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, flexShrink: 0 }}>
            {game.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700 }}>Hướng dẫn chơi: {game.title}</div>
            <div style={{ fontSize: 13, color: '#8b94a6', marginTop: 1 }}>{game.interactionType}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: 'none', background: '#f1f3f7', color: '#5b6577', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px 24px' }}>
          {showMedia ? (
            <div style={{ marginBottom: 18, borderRadius: 12, overflow: 'hidden', border: '1px solid #e6ebf6', background: '#0b0b16', lineHeight: 0 }}>
              {isVideo ? (
                <video
                  src={mediaSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onError={() => setMediaError(true)}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mediaSrc}
                  alt={`Minh họa cách chơi ${game.title}`}
                  onError={() => setMediaError(true)}
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />
              )}
            </div>
          ) : null}

          <div style={{ fontSize: 14.5, lineHeight: 1.65, color: '#374151', whiteSpace: 'pre-wrap' }}>
            {game.howToPlay}
          </div>

          <div style={{ marginTop: 18, background: '#f8faff', border: '1px solid #e6ebf6', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#8b94a6', marginBottom: 6 }}>Ví dụ</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#475067' }}>{game.example}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ marginTop: 20, width: '100%', border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 14.5, padding: '11px', borderRadius: 11, boxShadow: '0 5px 14px rgba(79,70,229,.28)' }}
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  )
}
