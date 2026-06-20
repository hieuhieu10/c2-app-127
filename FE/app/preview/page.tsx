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
  { q: 'What is 7 × 8?', a: '56', opts: ['54', '56', '48', '63'], hint: 'Count by eights: 8, 16, 24…', expl: '7 × 8 = 56.' },
  { q: 'Which planet is known as the Red Planet?', a: 'Mars', opts: ['Venus', 'Mars', 'Jupiter', 'Mercury'], expl: 'Mars looks red because of iron oxide (rust) on its surface.' },
  { q: 'What is the capital of Japan?', a: 'Tokyo', opts: ['Kyoto', 'Osaka', 'Tokyo', 'Nagoya'], hint: 'It is on Honshu island.', expl: 'Tokyo has been Japan’s capital since 1868.' },
  { q: 'How many sides does a hexagon have?', a: '6', opts: ['5', '6', '7', '8'], expl: 'A hexagon has 6 sides ("hexa" = six).' },
  { q: 'Water freezes at what temperature (°C)?', a: '0', opts: ['0', '10', '32', '100'], hint: 'In Celsius, not Fahrenheit.', expl: 'Water freezes at 0 °C (32 °F).' },
  { q: 'Who wrote "Romeo and Juliet"?', a: 'Shakespeare', opts: ['Dickens', 'Shakespeare', 'Tolstoy', 'Homer'], expl: 'William Shakespeare wrote it around 1595.' },
  { q: 'What gas do plants absorb from the air?', a: 'Carbon dioxide', opts: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], expl: 'Plants take in CO₂ for photosynthesis.' },
  { q: 'What is 12 ÷ 4?', a: '3', opts: ['2', '3', '4', '6'], expl: '12 ÷ 4 = 3.' },
  { q: 'Which ocean is the largest?', a: 'Pacific', opts: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], hint: 'It borders Asia and the Americas.', expl: 'The Pacific is the largest and deepest ocean.' },
  { q: 'How many continents are there?', a: '7', opts: ['5', '6', '7', '8'], expl: 'There are 7 continents.' },
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
    { id: 'select', label: 'Character Select' },
    { id: 'placement', label: 'Ship Placement' },
    { id: 'battle', label: 'Battle' },
    { id: 'gameover', label: 'Game Over' },
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
        <span style={S.brand}>🎮 Game Preview</span>
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
        <button onClick={() => setNonce((n) => n + 1)} style={S.reset}>↻ Reset</button>
      </header>

      {scenes ? (
        <div style={S.scenes}>
          <span style={S.scenesLabel}>Jump to screen:</span>
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
          {def.icon} <strong>{def.title}</strong> · {def.itemCount} sample items · {def.interactionType}
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
