'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Game, GameItem } from '@/types/app'

/**
 * Cat Jump — a number-sequence game ported from the DC design to React.
 *
 * Each GameItem encodes one river-crossing level:
 *   item.question        → level name (e.g. "Hop by 3")
 *   item.correctAnswer   → 8 integers as a comma-separated string (e.g. "3,6,9,12,15,18,21,24")
 *   item.hint            → pattern-rule hint shown in the HUD
 *
 * The shell shows 8 stepping stones; the first 3 reveal their numbers immediately.
 * Students pick the next number from 3 generated choices to hop the cat forward.
 * Correct → cat hops, stone revealed. Wrong → lose a heart. 3 wrong = game over.
 * Complete all stones → level complete overlay → advance to next level.
 */

// ── Types ──────────────────────────────────────────────────────────────────────
interface Level { name: string; seq: number[]; hint: string }

interface GState {
  levelIndex: number
  levelName: string
  hint: string
  seq: number[]
  filledUpTo: number   // last stone whose number is visible (0-indexed)
  catIndex: number     // stone the cat is currently on (0-7, or 8 = goal island)
  prevIndex: number    // stone the cat was on before last hop
  targetIndex: number  // stone to guess next (starts at 3)
  hearts: number
  status: 'playing' | 'levelcomplete' | 'gameover' | 'win'
  hopping: boolean
  parity: number        // alternates 0/1 to re-trigger hop animation
  mood: 'neutral' | 'happy' | 'sad'
  wrongTile: number     // index of the wrong-choice button currently flashing (-1 = none)
  shake: boolean        // stage shake on wrong answer
  floatVisible: boolean // +10 float label
  choices: number[]
  correct: number
  score: number
  confettiKey: number
}

// React.CSSProperties doesn't include CSS custom properties — extend it.
type CSSVars = React.CSSProperties & { [k: `--${string}`]: string | number }

// ── Constants ──────────────────────────────────────────────────────────────────
const STONE_X = [95, 196, 296, 397, 498, 598, 699, 800] // center-x of each stone in the 980px canvas
const STONE_TOP = [405, 387, 405, 387, 405, 387, 405, 387] // top-y of each stone div
const BOB_DUR = ['3s', '3.4s', '3.2s', '3.5s', '3.1s', '3.3s', '3.6s', '3.2s']
const BOB_DELAY = ['0s', '.3s', '.15s', '.45s', '.2s', '.5s', '.1s', '.35s']
const LAST = 7 // index of the last stone

// ── Helpers ────────────────────────────────────────────────────────────────────
function parseLevels(items: GameItem[]): Level[] {
  return items
    .filter((it) => it.correctAnswer)
    .map((it) => {
      const seq = it.correctAnswer
        .split(',')
        .map((n) => parseInt(n.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0)
      return { name: it.question || 'Dãy số', seq, hint: it.hint ?? '' }
    })
    .filter((lv) => lv.seq.length === 8)
}

function buildChoices(seq: number[], target: number): { choices: number[]; correct: number } {
  const correct = seq[target]
  const localStep = seq[target] - seq[target - 1]

  // Build a diverse distractor pool; the shell never reuses content distractors.
  const pool: number[] = [
    correct - 1,
    correct + 1,
    correct + localStep,
    correct - localStep,
    correct + 2,
    correct - 2,
  ]
  // For geometric sequences, also try ratio-based distractors
  const ratio = seq[target - 1] > 0 ? Math.round(seq[target] / seq[target - 1]) : 2
  if (ratio >= 2 && ratio <= 10) {
    pool.push(correct * ratio, Math.round(correct / ratio) || 1)
  }

  const distract: number[] = []
  for (const v of pool) {
    if (v > 0 && v !== correct && !distract.includes(v)) distract.push(v)
    if (distract.length === 2) break
  }
  // Fallback distractors in case the pool is exhausted
  let extra = 1
  while (distract.length < 2) {
    const candidate = correct + extra * 3
    if (candidate !== correct && !distract.includes(candidate)) distract.push(candidate)
    extra++
  }

  const arr = [correct, distract[0], distract[1]]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return { choices: arr, correct }
}

function catPos(i: number): { left: number; top: number } {
  if (i > LAST) return { left: 884, top: 300 } // goal island
  return { left: STONE_X[i] - 37, top: STONE_TOP[i] - 62 }
}

function initState(levels: Level[], levelIndex: number, keepScore: number): GState {
  const lv = levels[levelIndex] ?? levels[0]
  const seq = lv.seq
  const { choices, correct } = buildChoices(seq, 3)
  return {
    levelIndex,
    levelName: lv.name,
    hint: lv.hint,
    seq,
    filledUpTo: 2,
    catIndex: 2,
    prevIndex: 2,
    targetIndex: 3,
    hearts: 3,
    status: 'playing',
    hopping: false,
    parity: 0,
    mood: 'neutral',
    wrongTile: -1,
    shake: false,
    floatVisible: false,
    choices,
    correct,
    score: keepScore,
    confettiKey: 0,
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Stone({
  x, top, text, isCurrent, bobDur, bobDelay,
}: {
  x: number; top: number; text: string; isCurrent: boolean; bobDur: string; bobDelay: string
}) {
  const left = x - 42 // stone width 84px → center at x
  return (
    <div style={{ position: 'absolute', left: left + 'px', top: top + 'px', width: '84px', height: '56px', animation: `cj-bob ${bobDur} ease-in-out infinite ${bobDelay}` }}>
      {/* shadow */}
      <div style={{ position: 'absolute', left: '8px', top: '42px', width: '68px', height: '18px', borderRadius: '50%', background: 'rgba(35,70,80,.22)' }} />
      {/* body */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50% 50% 48% 48%', background: '#6e6a62', boxShadow: '0 10px 14px rgba(0,0,0,.28)' }} />
      {/* surface */}
      <div style={{ position: 'absolute', inset: '4px 6px 13px 6px', borderRadius: '50%', background: '#948f85' }} />
      {/* glare */}
      <div style={{ position: 'absolute', left: '15px', top: '7px', width: '30px', height: '11px', borderRadius: '50%', background: 'rgba(255,255,255,.30)' }} />
      {/* label */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Baloo 2', cursive", fontSize: '27px', fontWeight: 800, color: '#2e2a24' }}>
        {text}
      </div>
      {/* pulse ring on the stone students must guess next */}
      {isCurrent && (
        <div style={{ position: 'absolute', inset: '-9px', borderRadius: '50%', border: '4px dashed #ef8354', animation: 'cj-pulse 1.1s ease-in-out infinite' }} />
      )}
    </div>
  )
}

function Cat({ left, top, dx, dy, hopping, parity, mood }: {
  left: number; top: number; dx: number; dy: number
  hopping: boolean; parity: number; mood: string
}) {
  const style: CSSVars = {
    position: 'absolute', left: left + 'px', top: top + 'px',
    width: '74px', height: '82px', zIndex: 5,
    '--dx': dx + 'px', '--dy': dy + 'px',
  }
  const hopAnim = hopping ? `cj-hop${parity ? '2' : '1'} 0.76s both` : 'none'
  return (
    <div style={style}>
      <div style={{ position: 'absolute', inset: 0, animation: hopAnim }}>
        <div style={{ position: 'absolute', inset: 0, animation: 'cj-catbob 2.4s ease-in-out infinite', filter: 'drop-shadow(0 7px 7px rgba(0,0,0,.22))' }}>
          {/* tail */}
          <div style={{ position: 'absolute', right: '-10px', bottom: '14px', width: '34px', height: '14px', background: '#e07a4b', borderRadius: '14px', transform: 'rotate(-26deg)' }} />
          {/* body */}
          <div style={{ position: 'absolute', left: '15px', bottom: 0, width: '48px', height: '44px', background: '#ef8354', borderRadius: '24px 24px 20px 20px' }} />
          {/* head */}
          <div style={{ position: 'absolute', left: '10px', top: '6px', width: '56px', height: '50px', background: '#ef8354', borderRadius: '50%' }} />
          {/* ears */}
          <div style={{ position: 'absolute', left: '12px', top: '-2px', width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderBottom: '20px solid #ef8354', transform: 'rotate(-18deg)' }} />
          <div style={{ position: 'absolute', left: '42px', top: '-2px', width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderBottom: '20px solid #ef8354', transform: 'rotate(18deg)' }} />
          {/* whiskers */}
          <div style={{ position: 'absolute', left: '-2px', top: '32px', width: '18px', height: '2px', background: '#cf7a55', borderRadius: '2px', transform: 'rotate(8deg)' }} />
          <div style={{ position: 'absolute', left: '-2px', top: '38px', width: '18px', height: '2px', background: '#cf7a55', borderRadius: '2px', transform: 'rotate(-6deg)' }} />
          <div style={{ position: 'absolute', right: '-2px', top: '32px', width: '18px', height: '2px', background: '#cf7a55', borderRadius: '2px', transform: 'rotate(-8deg)' }} />
          <div style={{ position: 'absolute', right: '-2px', top: '38px', width: '18px', height: '2px', background: '#cf7a55', borderRadius: '2px', transform: 'rotate(6deg)' }} />
          {/* eyes — swap based on mood */}
          {mood === 'neutral' && (
            <>
              <div style={{ position: 'absolute', left: '25px', top: '22px', width: '7px', height: '10px', background: '#3a2a22', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', left: '44px', top: '22px', width: '7px', height: '10px', background: '#3a2a22', borderRadius: '50%' }} />
            </>
          )}
          {mood === 'happy' && (
            <>
              <div style={{ position: 'absolute', left: '23px', top: '24px', width: '12px', height: '7px', border: '2.5px solid #3a2a22', borderBottom: 'none', borderRadius: '12px 12px 0 0' }} />
              <div style={{ position: 'absolute', left: '42px', top: '24px', width: '12px', height: '7px', border: '2.5px solid #3a2a22', borderBottom: 'none', borderRadius: '12px 12px 0 0' }} />
              <div style={{ position: 'absolute', left: '18px', top: '33px', width: '10px', height: '7px', borderRadius: '50%', background: '#ffb3a0', opacity: 0.8 }} />
              <div style={{ position: 'absolute', left: '49px', top: '33px', width: '10px', height: '7px', borderRadius: '50%', background: '#ffb3a0', opacity: 0.8 }} />
            </>
          )}
          {mood === 'sad' && (
            <>
              <div style={{ position: 'absolute', left: '23px', top: '26px', width: '12px', height: '7px', border: '2.5px solid #3a2a22', borderTop: 'none', borderRadius: '0 0 12px 12px' }} />
              <div style={{ position: 'absolute', left: '42px', top: '26px', width: '12px', height: '7px', border: '2.5px solid #3a2a22', borderTop: 'none', borderRadius: '0 0 12px 12px' }} />
            </>
          )}
          {/* nose */}
          <div style={{ position: 'absolute', left: '34px', top: '34px', width: '8px', height: '5px', background: '#b9472a', borderRadius: '50%' }} />
        </div>
      </div>
    </div>
  )
}

function Confetti({ k, active }: { k: number; active: boolean }) {
  if (!active) return null
  const colors = ['#ef8354', '#f6c453', '#82a35f', '#6fb6c8', '#caa657', '#ffffff']
  return (
    <div key={k} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 8 }}>
      {Array.from({ length: 44 }, (_, i) => {
        const seed = (i * 97 + k * 131) % 100
        const left = (seed / 100) * 960
        const size = 8 + (seed % 7)
        const delay = (seed % 12) / 24
        const dur = 1.5 + (seed % 9) / 6
        const rot = ((seed % 2) ? 1 : -1) * (240 + seed * 5) + 'deg'
        return (
          <div key={i} style={{
            position: 'absolute', left: left + 'px', top: '-24px',
            width: size + 'px', height: (size * 1.4) + 'px',
            background: colors[i % colors.length], borderRadius: '2px',
            opacity: 0,
            animation: `cj-confetti ${dur}s ease-in ${delay}s forwards`,
            '--rot': rot,
          } as CSSVars} />
        )
      })}
    </div>
  )
}

// ── Main shell ─────────────────────────────────────────────────────────────────
export function CatJumpShell({ game }: { game: Game; previewMode?: boolean; scene?: string }) {
  const levels = useMemo(() => parseLevels(game.items), [game.items])

  const [S, setS] = useState<GState>(() =>
    levels.length > 0
      ? initState(levels, 0, 0)
      : initState([{ name: 'Nhảy cách 2', seq: [2, 4, 6, 8, 10, 12, 14, 16], hint: 'Cộng thêm 2 mỗi bước' }], 0, 0)
  )
  const [scale, setScale] = useState(1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const after = (ms: number, fn: () => void) => {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
  }

  // Responsive scale: fit the 980px canvas into the shell's container width.
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current
      if (!el) return
      const w = el.clientWidth || 1010
      setScale(Math.max(0.3, Math.min(w / 1010, 1.0)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => {
      ro.disconnect()
      timers.current.forEach(clearTimeout)
    }
  }, [])

  // Re-init if the game's items change (e.g. teacher edits content).
  useEffect(() => {
    const fresh = parseLevels(game.items)
    if (fresh.length > 0) setS(initState(fresh, 0, 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.items])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const startLevel = (idx: number, keepScore: number) => {
    setS(initState(levels, idx, keepScore))
  }

  const choose = (i: number) => {
    if (S.status !== 'playing' || S.hopping) return
    if (S.choices[i] === S.correct) onCorrect(S)
    else onWrong(i, S)
  }

  const onCorrect = (s: GState) => {
    const target = s.targetIndex
    setS((prev) => ({
      ...prev,
      filledUpTo: target,
      prevIndex: prev.catIndex,
      catIndex: target,
      parity: prev.parity ^ 1,
      hopping: true,
      mood: 'happy',
      score: prev.score + 10,
      floatVisible: true,
    }))

    after(720, () => {
      setS((prev) => {
        const base = { ...prev, floatVisible: false, hopping: false, mood: 'neutral' as const }
        if (target < LAST) {
          const { choices, correct } = buildChoices(prev.seq, target + 1)
          return { ...base, targetIndex: target + 1, choices, correct }
        }
        return base
      })
      // Final hop: stone 7 → goal island
      if (target >= LAST) {
        after(140, () => {
          setS((prev) => ({
            ...prev,
            prevIndex: prev.catIndex,
            catIndex: 8,
            parity: prev.parity ^ 1,
            hopping: true,
            mood: 'happy',
          }))
          after(760, () => {
            setS((prev) => ({
              ...prev,
              hopping: false,
              status: 'levelcomplete',
              confettiKey: prev.confettiKey + 1,
            }))
          })
        })
      }
    })
  }

  const onWrong = (i: number, s: GState) => {
    const hearts = s.hearts - 1
    setS((prev) => ({ ...prev, wrongTile: i, shake: true, mood: 'sad', hearts }))
    after(420, () => setS((prev) => ({ ...prev, wrongTile: -1, shake: false, mood: 'neutral' })))
    if (hearts <= 0) {
      after(620, () => setS((prev) => ({ ...prev, status: 'gameover' })))
    }
  }

  const nextLevel = () => {
    if (S.levelIndex + 1 < levels.length) startLevel(S.levelIndex + 1, S.score)
    else setS((prev) => ({ ...prev, status: 'win', confettiKey: prev.confettiKey + 1 }))
  }

  // ── Derived render values ─────────────────────────────────────────────────────
  const cur = catPos(S.catIndex)
  const prev = catPos(S.prevIndex)
  const stoneText = (i: number) => (i <= S.filledUpTo ? String(S.seq[i]) : '?')
  const isTarget = (i: number) => S.targetIndex === i && S.status === 'playing'

  const starOn = '#f6c453', starOff = '#e3d7bf'
  let overlayTitle = '', overlaySub = '', overlayBtn = '', overlayAction = () => {}
  let showStars = false
  if (S.status === 'levelcomplete') {
    overlayTitle = 'Nhảy giỏi lắm!'
    overlaySub = `${S.levelName} — hoàn thành!`
    overlayBtn = S.levelIndex + 1 < levels.length ? 'Sông tiếp theo' : 'Kết thúc'
    overlayAction = nextLevel
    showStars = true
  } else if (S.status === 'gameover') {
    overlayTitle = 'Tõm!'
    overlaySub = 'Chú mèo rơi xuống nước rồi. Thử lại con sông này nhé.'
    overlayBtn = 'Thử lại'
    overlayAction = () => startLevel(S.levelIndex, S.score)
  } else if (S.status === 'win') {
    overlayTitle = 'Bạn đã qua hết các con sông!'
    overlaySub = `Điểm cuối ★ ${S.score}`
    overlayBtn = 'Chơi lại'
    overlayAction = () => startLevel(0, 0)
  }

  if (levels.length === 0) {
    return (
      <div className="cj">
        <style>{CSS}</style>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#9C8A78', fontWeight: 700, fontFamily: 'sans-serif' }}>
          Chưa có màn chơi nào — hãy tạo trò Mèo Nhảy để bắt đầu.
        </div>
      </div>
    )
  }

  return (
    <div className="cj" ref={wrapRef}>
      <style>{CSS}</style>

      {/* Outer wrapper sets the height to match the scaled canvas */}
      <div style={{ width: '100%', height: `${600 * scale + 30}px`, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>

        {/* Fixed-size 980×600 canvas, scaled to fit */}
        <div style={{ width: '980px', height: '600px', position: 'absolute', top: '10px', transformOrigin: 'top center', transform: `scale(${scale})` }}>
          <div style={{
            position: 'absolute', inset: 0,
            animation: S.shake ? 'cj-shake 0.42s ease' : 'none',
            borderRadius: '24px', overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(60,40,10,.28)',
            background: '#f3ead9',
          }}>

            {/* ── SKY ── */}
            <div style={{ position: 'absolute', left: '-20px', top: '-20px', right: '-20px', height: '268px', background: '#bfe0ea', borderRadius: '0 0 60px 60px', boxShadow: '0 8px 16px rgba(0,0,0,.06)' }} />
            {/* sun */}
            <div style={{ position: 'absolute', left: '52px', top: '44px', width: '62px', height: '62px', borderRadius: '50%', background: '#f6c453', boxShadow: '0 5px 10px rgba(0,0,0,.1)' }} />
            {/* clouds */}
            <div style={{ position: 'absolute', right: '120px', top: '48px', width: '92px', height: '30px', borderRadius: '16px', background: '#fff', boxShadow: '0 4px 7px rgba(0,0,0,.08)' }} />
            <div style={{ position: 'absolute', right: '150px', top: '34px', width: '54px', height: '26px', borderRadius: '14px', background: '#fff' }} />
            <div style={{ position: 'absolute', left: '300px', top: '74px', width: '78px', height: '24px', borderRadius: '14px', background: '#fff', opacity: 0.9 }} />
            {/* hills */}
            <div style={{ position: 'absolute', left: '-30px', top: '172px', width: '320px', height: '150px', borderRadius: '50%', background: '#a9cf86', boxShadow: 'inset 0 6px 0 rgba(255,255,255,.18)' }} />
            <div style={{ position: 'absolute', right: '-40px', top: '182px', width: '360px', height: '150px', borderRadius: '50%', background: '#9bc479' }} />

            {/* ── RIVER ── */}
            <div style={{ position: 'absolute', left: '-20px', top: '236px', right: '-20px', bottom: '-20px', background: '#6fb6c8', borderRadius: '60px 60px 0 0', boxShadow: 'inset 0 8px 16px rgba(0,0,0,.08)' }} />
            <div style={{ position: 'absolute', left: '70px', top: '300px', width: '120px', height: '9px', borderRadius: '6px', background: '#8fcdd9', animation: 'cj-shimmer 3s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', left: '520px', top: '340px', width: '150px', height: '9px', borderRadius: '6px', background: '#8fcdd9', animation: 'cj-shimmer 3.6s ease-in-out infinite .4s' }} />
            <div style={{ position: 'absolute', left: '300px', top: '520px', width: '180px', height: '9px', borderRadius: '6px', background: '#8fcdd9', animation: 'cj-shimmer 3.2s ease-in-out infinite .8s' }} />
            {/* reeds */}
            <div style={{ position: 'absolute', left: '18px', top: '250px', width: '9px', height: '60px', borderRadius: '6px', background: '#5f8f4e', transformOrigin: 'bottom', animation: 'cj-sway 4s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', left: '34px', top: '262px', width: '9px', height: '46px', borderRadius: '6px', background: '#6f9f5a', transformOrigin: 'bottom', animation: 'cj-sway 4.4s ease-in-out infinite .3s' }} />

            {/* ── GOAL ISLAND ── */}
            <div style={{ position: 'absolute', left: '856px', top: '352px', width: '140px', height: '120px' }}>
              <div style={{ position: 'absolute', left: 0, top: '36px', width: '140px', height: '78px', borderRadius: '50%', background: '#8aab6a', boxShadow: '0 12px 18px rgba(0,0,0,.2)' }} />
              <div style={{ position: 'absolute', left: '14px', top: '30px', width: '112px', height: '54px', borderRadius: '50%', background: '#9dbd7c' }} />
              {/* fish reward */}
              <div style={{ position: 'absolute', left: '40px', top: '30px', width: '62px', height: '38px', borderRadius: '20px 8px 20px 20px', background: '#ef8354', boxShadow: '0 5px 9px rgba(0,0,0,.18)' }} />
              <div style={{ position: 'absolute', left: '30px', top: '40px', width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderRight: '16px solid #ef8354' }} />
              <div style={{ position: 'absolute', left: '80px', top: '40px', width: '9px', height: '9px', borderRadius: '50%', background: '#3a2a22' }} />
              {/* flag */}
              <div style={{ position: 'absolute', left: '108px', top: '-2px', width: '6px', height: '46px', borderRadius: '3px', background: '#caa15a' }} />
              <div style={{ position: 'absolute', left: '84px', top: '-2px', width: '28px', height: '20px', borderRadius: '4px 8px 8px 4px', background: '#ef6f6f' }} />
            </div>

            {/* ── STONES ── */}
            {STONE_X.map((x, i) => (
              <Stone
                key={i}
                x={x}
                top={STONE_TOP[i]}
                text={stoneText(i)}
                isCurrent={isTarget(i)}
                bobDur={BOB_DUR[i]}
                bobDelay={BOB_DELAY[i]}
              />
            ))}

            {/* ── CAT ── */}
            <Cat
              left={cur.left}
              top={cur.top}
              dx={prev.left - cur.left}
              dy={prev.top - cur.top}
              hopping={S.hopping}
              parity={S.parity}
              mood={S.mood}
            />

            {/* ── +10 float ── */}
            {S.floatVisible && (
              <div style={{
                position: 'absolute',
                left: (cur.left + 16) + 'px',
                top: (cur.top - 26) + 'px',
                fontFamily: "'Baloo 2', cursive",
                fontSize: '26px', fontWeight: 800,
                color: '#ef8354', textShadow: '0 2px 0 #fff',
                zIndex: 7,
                animation: 'cj-floatUp 1s ease-out forwards',
              }}>+10</div>
            )}

            {/* ── HUD: level + progress ── */}
            <div style={{ position: 'absolute', left: '22px', top: '18px', padding: '10px 18px 12px', background: '#fffdf7', borderRadius: '18px', boxShadow: '0 5px 10px rgba(0,0,0,.12)', minWidth: '150px' }}>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: '19px', fontWeight: 800, color: '#5a3d12', lineHeight: 1 }}>Màn {S.levelIndex + 1}</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#c97b4a', marginTop: '3px' }}>{S.levelName}</div>
              {S.hint && <div style={{ fontSize: '11px', fontWeight: 600, color: '#8a7a5c', marginTop: '2px', fontStyle: 'italic' }}>Gợi ý: {S.hint}</div>}
              <div style={{ marginTop: '9px', width: '152px', height: '9px', borderRadius: '6px', background: '#ecdfc8', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: ((S.catIndex / 8) * 100) + '%', background: '#82a35f', borderRadius: '6px', transition: 'width .5s ease' }} />
              </div>
            </div>

            {/* ── HUD: score ── */}
            <div style={{ position: 'absolute', left: '50%', top: '22px', transform: 'translateX(-50%)', padding: '9px 20px', background: '#fffdf7', borderRadius: '18px', boxShadow: '0 5px 10px rgba(0,0,0,.12)', fontFamily: "'Baloo 2', cursive", fontSize: '21px', fontWeight: 800, color: '#5a3d12' }}>
              ★ {S.score}
            </div>

            {/* ── HUD: lives (cat-fish icons) ── */}
            <div style={{ position: 'absolute', right: '22px', top: '20px', display: 'flex', gap: '9px', padding: '11px 16px', background: '#fffdf7', borderRadius: '18px', boxShadow: '0 5px 10px rgba(0,0,0,.12)' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ position: 'relative', width: '30px', height: '22px' }}>
                  {i < S.hearts ? (
                    <>
                      <div style={{ position: 'absolute', left: '6px', top: '3px', width: '22px', height: '16px', borderRadius: '50%', background: '#ef8354' }} />
                      <div style={{ position: 'absolute', left: 0, top: '6px', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '9px solid #ef8354' }} />
                      <div style={{ position: 'absolute', left: '20px', top: '8px', width: '4px', height: '4px', borderRadius: '50%', background: '#fffdf7' }} />
                    </>
                  ) : (
                    <>
                      <div style={{ position: 'absolute', left: '6px', top: '3px', width: '22px', height: '16px', borderRadius: '50%', background: '#e3d7bf' }} />
                      <div style={{ position: 'absolute', left: 0, top: '6px', width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '9px solid #e3d7bf' }} />
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* ── QUESTION + CHOICES ── */}
            {S.status === 'playing' && !S.hopping && (
              <>
                <div style={{ position: 'absolute', left: '50%', top: '474px', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontFamily: "'Baloo 2', cursive", fontSize: '17px', fontWeight: 700, color: '#fffdf7', textShadow: '0 2px 4px rgba(0,0,0,.25)' }}>
                  Số nào tiếp theo?
                </div>
                <div style={{ position: 'absolute', left: '50%', top: '506px', transform: 'translateX(-50%)', display: 'flex', gap: '26px' }}>
                  {S.choices.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => choose(i)}
                      style={{
                        width: '104px', height: '66px',
                        border: 'none', cursor: 'pointer',
                        background: '#fffdf7', borderRadius: '18px',
                        boxShadow: '0 7px 0 #d9c39e, 0 10px 14px rgba(0,0,0,.16)',
                        fontFamily: "'Baloo 2', cursive", fontSize: '32px', fontWeight: 800, color: '#5a3d12',
                        animation: S.wrongTile === i ? 'cj-wrongflash 0.45s ease, cj-shake 0.4s ease' : 'none',
                      }}
                    >{c}</button>
                  ))}
                </div>
              </>
            )}

            {/* ── CONFETTI ── */}
            <Confetti k={S.confettiKey} active={S.status === 'levelcomplete' || S.status === 'win'} />

            {/* ── OVERLAY (level complete / game over / win) ── */}
            {S.status !== 'playing' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(40,28,10,.34)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9 }}>
                <div style={{ width: '360px', padding: '32px 30px 28px', background: '#fffdf7', borderRadius: '26px', boxShadow: '0 18px 40px rgba(0,0,0,.3)', textAlign: 'center', animation: 'cj-pop .4s cubic-bezier(.34,1.56,.64,1) both' }}>
                  <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: '30px', fontWeight: 800, color: '#5a3d12' }}>{overlayTitle}</div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: '#8a7a5c', marginTop: '6px' }}>{overlaySub}</div>
                  {showStars && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '20px 0 4px' }}>
                      <div style={{ fontSize: '38px', color: S.hearts >= 1 ? starOn : starOff }}>★</div>
                      <div style={{ fontSize: '46px', color: S.hearts >= 2 ? starOn : starOff, transform: 'translateY(-6px)' }}>★</div>
                      <div style={{ fontSize: '38px', color: S.hearts >= 3 ? starOn : starOff }}>★</div>
                    </div>
                  )}
                  <button
                    onClick={overlayAction}
                    style={{ marginTop: '22px', padding: '14px 40px', border: 'none', cursor: 'pointer', background: '#ef8354', borderRadius: '18px', boxShadow: '0 6px 0 #c9633a', fontFamily: "'Baloo 2', cursive", fontSize: '21px', fontWeight: 800, color: '#fffdf7' }}
                  >{overlayBtn}</button>
                </div>
              </div>
            )}

          </div>{/* end canvas */}
        </div>
      </div>
    </div>
  )
}

// ── Scoped stylesheet (all rules prefixed with .cj or cj-*) ───────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&display=swap');

.cj {
  position: relative;
  width: 100%;
  font-family: 'Baloo 2', cursive;
  background: #e8ddc7;
  border-radius: 14px;
  overflow: hidden;
}
.cj * { box-sizing: border-box; }

@keyframes cj-hop1 {
  0%   { transform: translate(var(--dx,0), var(--dy,0)); animation-timing-function: cubic-bezier(.2,.62,.35,1); }
  50%  { transform: translate(calc(var(--dx,0)*0.5), calc(var(--dy,0)*0.5 - 82px)) scale(1.03); animation-timing-function: cubic-bezier(.55,0,.75,.45); }
  100% { transform: translate(0,0); }
}
@keyframes cj-hop2 {
  0%   { transform: translate(var(--dx,0), var(--dy,0)); animation-timing-function: cubic-bezier(.2,.62,.35,1); }
  50%  { transform: translate(calc(var(--dx,0)*0.5), calc(var(--dy,0)*0.5 - 82px)) scale(1.03); animation-timing-function: cubic-bezier(.55,0,.75,.45); }
  100% { transform: translate(0,0); }
}
@keyframes cj-catbob   { 0%,100%{ transform:translateY(0);    } 50%{ transform:translateY(-3px); } }
@keyframes cj-bob      { 0%,100%{ transform:translateY(0);    } 50%{ transform:translateY(-4px); } }
@keyframes cj-shimmer  { 0%,100%{ opacity:.5;  transform:scaleX(1);    } 50%{ opacity:.9;  transform:scaleX(1.15); } }
@keyframes cj-pulse    { 0%,100%{ transform:scale(1);    opacity:.85; } 50%{ transform:scale(1.12); opacity:.35; } }
@keyframes cj-shake    { 0%,100%{ transform:translateX(0);    } 20%{ transform:translateX(-12px); } 40%{ transform:translateX(11px); } 60%{ transform:translateX(-8px); } 80%{ transform:translateX(6px); } }
@keyframes cj-wrongflash{ 0%,100%{ background:#fffdf7; } 45%{ background:#ffb09a; } }
@keyframes cj-pop      { 0%{ transform:scale(.6); opacity:0; } 60%{ transform:scale(1.06); opacity:1; } 100%{ transform:scale(1); opacity:1; } }
@keyframes cj-floatUp  { 0%{ transform:translateY(0); opacity:0; } 20%{ opacity:1; } 100%{ transform:translateY(-54px); opacity:0; } }
@keyframes cj-confetti { 0%{ opacity:1; transform:translateY(0) rotate(0); } 100%{ opacity:0; transform:translateY(540px) rotate(var(--rot,360deg)); } }
@keyframes cj-sway     { 0%,100%{ transform:rotate(-4deg); } 50%{ transform:rotate(4deg); } }
`
