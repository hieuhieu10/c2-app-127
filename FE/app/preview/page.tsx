'use client'

/**
 * Game preview harness — review any game shell in isolation.
 *
 * Open  /preview  with just `next dev` running. No backend, no auth, no
 * dashboard: each game from the shared GAMES registry is rendered with
 * built-in sample questions so you can click through it as a player would.
 *
 * This route is a dev/review tool only — it is not linked from the app.
 */

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { GAMES } from '@/features/game-shells/registry'
import type { Game, GameItem, GameTemplateType } from '@/types/app'

// ── Sample content (valid for every quiz-style shell) ───────────────────────
const SAMPLE_QA: Array<{ q: string; a: string; opts: string[]; hint?: string; expl: string }> = [
  { q: '7 × 8 bằng bao nhiêu?', a: '56', opts: ['54', '56', '48', '63'], hint: 'Đếm thêm theo 8: 8, 16, 24…', expl: '7 × 8 = 56.' },
  { q: 'Hành tinh nào được gọi là Hành tinh Đỏ?', a: 'Sao Hỏa', opts: ['Sao Kim', 'Sao Hỏa', 'Sao Mộc', 'Sao Thủy'], expl: 'Sao Hỏa có màu đỏ do bề mặt chứa nhiều oxit sắt.' },
  { q: 'Thủ đô của Nhật Bản là gì?', a: 'Tokyo', opts: ['Kyoto', 'Osaka', 'Tokyo', 'Nagoya'], hint: 'Thành phố này nằm trên đảo Honshu.', expl: 'Tokyo là thủ đô của Nhật Bản từ năm 1868.' },
  { q: 'Hình lục giác có bao nhiêu cạnh?', a: '6', opts: ['5', '6', '7', '8'], expl: 'Hình lục giác có 6 cạnh.' },
  { q: 'Nước đóng băng ở nhiệt độ bao nhiêu (°C)?', a: '0', opts: ['0', '10', '32', '100'], hint: 'Tính theo độ C, không phải độ F.', expl: 'Nước đóng băng ở 0 °C.' },
  { q: 'Ai là tác giả của "Romeo và Juliet"?', a: 'Shakespeare', opts: ['Dickens', 'Shakespeare', 'Tolstoy', 'Homer'], expl: 'William Shakespeare viết tác phẩm này vào khoảng năm 1595.' },
  { q: 'Thực vật hấp thụ khí gì từ không khí?', a: 'Carbon dioxide', opts: ['Oxy', 'Nitơ', 'Carbon dioxide', 'Hiđrô'], expl: 'Thực vật hấp thụ CO₂ để quang hợp.' },
  { q: '12 ÷ 4 bằng bao nhiêu?', a: '3', opts: ['2', '3', '4', '6'], expl: '12 ÷ 4 = 3.' },
  { q: 'Đại dương nào lớn nhất?', a: 'Thái Bình Dương', opts: ['Đại Tây Dương', 'Ấn Độ Dương', 'Bắc Băng Dương', 'Thái Bình Dương'], hint: 'Đại dương này nằm giữa châu Á và châu Mỹ.', expl: 'Thái Bình Dương là đại dương lớn nhất và sâu nhất.' },
  { q: 'Có bao nhiêu châu lục?', a: '7', opts: ['5', '6', '7', '8'], expl: 'Có 7 châu lục.' },
]

function makeItems(type: GameTemplateType, n: number): GameItem[] {
  return Array.from({ length: n }, (_, i) => {
    const s = SAMPLE_QA[i % SAMPLE_QA.length]
    return {
      id: `sample-${i}`,
      type,
      question: s.q,
      correctAnswer: s.a,
      options: s.opts,
      explanation: s.expl,
      hint: s.hint,
      validationStatus: 'valid',
    }
  })
}

// Scenes a shell can jump straight to (passed as the `scene` prop). Only games
// that understand `scene` need an entry; others just play from the start.
const SCENES: Partial<Record<GameTemplateType, { id: string; label: string }[]>> = {
  battleship: [
    { id: 'select', label: 'Chọn nhân vật' },
    { id: 'placement', label: 'Đặt tàu' },
    { id: 'battle', label: 'Chiến đấu' },
    { id: 'gameover', label: 'Kết thúc' },
  ],
}

function makeGame(type: GameTemplateType, n: number): Game {
  const now = new Date()
  return {
    id: 'preview-game',
    lessonId: 'preview-lesson',
    templateType: type,
    items: makeItems(type, n),
    status: 'approved',
    createdAt: now,
    updatedAt: now,
  }
}

// ── Harness ─────────────────────────────────────────────────────────────────
export default function PreviewPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return <Suspense fallback={null}><PreviewInner /></Suspense>
}

function PreviewInner() {
  const params = useSearchParams()
  // Initial selection comes from the URL so screens are deep-linkable, e.g.
  //   /preview?game=battleship&scene=battle
  const initialType = GAMES.find((g) => g.type === params.get('game'))?.type ?? GAMES[0].type
  const initialScene = (() => {
    const scenes = SCENES[initialType]
    const q = params.get('scene')
    return scenes && q && scenes.some((s) => s.id === q) ? q : scenes?.[0]?.id
  })()

  const [active, setActive] = useState<GameTemplateType>(initialType)
  const [scene, setScene] = useState<string | undefined>(initialScene)
  const [nonce, setNonce] = useState(0)

  const def = GAMES.find((g) => g.type === active) ?? GAMES[0]
  const scenes = SCENES[active]
  // Questions are the same across scenes, so only re-make on game / reset.
  const game = useMemo(() => makeGame(def.type, def.itemCount), [def.type, def.itemCount, nonce])
  const Shell = def.Shell

  const syncUrl = (t: GameTemplateType, sc?: string) => {
    const p = new URLSearchParams({ game: t, ...(sc ? { scene: sc } : {}) })
    window.history.replaceState(null, '', `/preview?${p.toString()}`)
  }
  const pickGame = (t: GameTemplateType) => { const sc = SCENES[t]?.[0]?.id; setActive(t); setScene(sc); syncUrl(t, sc) }
  const pickScene = (sc: string) => { setScene(sc); setNonce((n) => n + 1); syncUrl(active, sc) }

  return (
    <div style={S.page}>
      <header style={S.bar}>
        <span style={S.brand}>🎮 Xem trước trò chơi</span>
        <div style={S.tabs}>
          {GAMES.map((g) => {
            const on = g.type === active
            return (
              <button key={g.type} onClick={() => pickGame(g.type)} style={{ ...S.tab, ...(on ? S.tabOn : null) }}>
                <span style={{ fontSize: 16 }}>{g.icon}</span> {g.title}
              </button>
            )
          })}
        </div>
        <button onClick={() => setNonce((n) => n + 1)} style={S.reset}>↻ Đặt lại</button>
      </header>

      {scenes ? (
        <div style={S.scenes}>
          <span style={S.scenesLabel}>Chuyển tới màn:</span>
          {scenes.map((sc) => {
            const on = sc.id === scene
            return (
              <button
                key={sc.id}
                onClick={() => pickScene(sc.id)}
                style={{ ...S.sceneBtn, ...(on ? S.sceneBtnOn : null) }}
              >
                {sc.label}
              </button>
            )
          })}
        </div>
      ) : (
        <p style={S.meta}>
          {def.icon} <strong>{def.title}</strong> · {def.itemCount} câu mẫu · {def.interactionType}
        </p>
      )}

      <main style={S.stage}>
        <div style={S.frame}>
          <Shell key={`${def.type}-${scene ?? 'play'}-${nonce}`} game={game} scene={scene} />
        </div>
      </main>
    </div>
  )
}

// ── Inline styles (self-contained, no app CSS needed) ───────────────────────
const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#0b0b16', color: '#e8e8f0', padding: '20px 16px 48px' },
  bar: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', maxWidth: 980, margin: '0 auto 8px' },
  brand: { fontFamily: 'monospace', fontWeight: 700, fontSize: 18, letterSpacing: 0.5 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 },
  tab: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 999, border: '1px solid #2c2c4a', background: '#15152b', color: '#b9b9d6', cursor: 'pointer', fontSize: 14 },
  tabOn: { background: '#2a2a5c', border: '1px solid #5b5bff', color: '#fff' },
  reset: { padding: '8px 14px', borderRadius: 8, border: '1px solid #2c2c4a', background: '#15152b', color: '#b9b9d6', cursor: 'pointer', fontSize: 14 },
  meta: { maxWidth: 980, margin: '0 auto 16px', color: '#8a8ab0', fontSize: 14 },
  scenes: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', maxWidth: 980, margin: '0 auto 16px' },
  scenesLabel: { color: '#8a8ab0', fontSize: 13, marginRight: 4 },
  sceneBtn: { padding: '6px 12px', borderRadius: 8, border: '1px solid #2c2c4a', background: '#101022', color: '#b9b9d6', cursor: 'pointer', fontSize: 13 },
  sceneBtnOn: { background: '#1e3a1e', border: '1px solid #3ad13a', color: '#bff5bf' },
  stage: { maxWidth: 980, margin: '0 auto' },
  frame: { background: '#06060f', borderRadius: 16, border: '1px solid #1c1c34', overflow: 'hidden' },
}
