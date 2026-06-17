'use client'

import { useEffect, useReducer, useMemo, useRef } from 'react'
import type { Game, GameItem } from '@/types/app'

/**
 * Trivia Battleship — fully inline, native-React game shell.
 *
 * A 2-player hot-seat game played entirely in the browser from `game.items`
 * (no iframe, no BE_Web game id). Ported from the static vanilla-JS game; the
 * retro 8-bit look is preserved via a scoped <style> block.
 */

// ── Constants ──────────────────────────────────────────────────────────────
const G = 6

interface ShipDef { id: string; name: string; length: number }
const SHIP_DEFS: ShipDef[] = [
  { id: 'patrol', name: 'TAU TUAN TRA', length: 2 },
  { id: 'submarine', name: 'TAU NGAM', length: 3 },
  { id: 'battleship', name: 'THIET GIAC HAM', length: 4 },
]

interface Avatar { em: string; label: string }
const AVATARS: Avatar[] = [
  { em: '🦁', label: 'SU TU' },
  { em: '🐯', label: 'HO' },
  { em: '🦊', label: 'CAO' },
  { em: '🐺', label: 'SOI' },
  { em: '🦅', label: 'DAI BANG' },
  { em: '🐉', label: 'RONG' },
]

// ── Types ──────────────────────────────────────────────────────────────────
type Phase =
  | 'char_select' | 'placement_p1' | 'pl_switch' | 'placement_p2'
  | 'game_start' | 'battle' | 'pass_device' | 'game_over'
type BattleSub = 'trivia' | 'result' | 'targeting' | 'miss'

interface Cell { shipId: string | null; hit: boolean }
interface Ship { id: string; name: string; length: number; cells: [number, number][]; sunk: boolean }
interface Player { id: number; name: string; av: Avatar | null; grid: Cell[][]; ships: Ship[] }
interface BQ { question: string; correct_answer: string; options: string[]; hint?: string; explanation?: string }
interface Switch { msg: string; sub: string; next: Phase; btn: string }

interface State {
  questions: BQ[]
  qIdx: number
  players: [Player, Player]
  cur: 0 | 1
  phase: Phase
  battleSub: BattleSub
  lastBombAnim: { pi: number; r: number; c: number } | null
  sunkShip: { pi: number; id: string } | null
  sunkNote: string | null
  q: BQ | null
  opts: string[]
  result: 'correct' | 'wrong' | null
  winner: 0 | 1 | null
  selShip: number
  orient: 'H' | 'V'
  hvr: [number, number][]
  hvrOk: boolean
  hits: [number, number]
  sw: Switch | null
}

// ── Pure helpers ───────────────────────────────────────────────────────────
function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

function makeGrid(): Cell[][] {
  return Array.from({ length: G }, () => Array.from({ length: G }, () => ({ shipId: null, hit: false })))
}

function itemsToQuestions(items: GameItem[]): BQ[] {
  return items
    .filter((it) => it.question && it.correctAnswer)
    .map((it) => {
      const base = it.options && it.options.length ? it.options : []
      const options = base.includes(it.correctAnswer) ? base : [it.correctAnswer, ...base]
      return { question: it.question, correct_answer: it.correctAnswer, options, hint: it.hint, explanation: it.explanation }
    })
}

function initState(questions: BQ[]): State {
  return {
    questions: shuffle(questions),
    qIdx: 0,
    players: [
      { id: 1, name: 'PLAYER 1', av: null, grid: makeGrid(), ships: [] },
      { id: 2, name: 'PLAYER 2', av: null, grid: makeGrid(), ships: [] },
    ],
    cur: 0,
    phase: 'char_select',
    battleSub: 'trivia',
    lastBombAnim: null,
    sunkShip: null,
    sunkNote: null,
    q: null,
    opts: [],
    result: null,
    winner: null,
    selShip: 0,
    orient: 'H',
    hvr: [],
    hvrOk: true,
    hits: [0, 0],
    sw: null,
  }
}

function shipCells(r: number, c: number, len: number, orient: 'H' | 'V'): [number, number][] {
  return Array.from({ length: len }, (_, i) => (orient === 'H' ? [r, c + i] : [r + i, c]) as [number, number])
}

function validPlacement(S: State, pi: number, cells: [number, number][]): boolean {
  const grid = S.players[pi].grid
  for (const [r, c] of cells) {
    if (r < 0 || r >= G || c < 0 || c >= G) return false
    if (grid[r][c].shipId) return false
  }
  return true
}

function checkWin(S: State, atkI: number): boolean {
  return S.players[atkI === 0 ? 1 : 0].ships.every((s) => s.sunk)
}

// ── Component ──────────────────────────────────────────────────────────────
export function BattleshipShell({ game }: { game: Game; previewMode?: boolean }) {
  const questions = useMemo(() => itemsToQuestions(game.items), [game.items])
  const [, render] = useReducer((x: number) => x + 1, 0)
  const st = useRef<State | null>(null)
  if (st.current === null) st.current = initState(questions)
  const S = st.current

  const timeouts = useRef<number[]>([])
  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timeouts.current.push(id)
  }
  useEffect(() => () => { timeouts.current.forEach((id) => clearTimeout(id)) }, [])

  const oppI = () => (S.cur === 0 ? 1 : 0) as 0 | 1

  // ── Mutations (mirror of the original imperative game) ──
  const drawQ = () => {
    if (S.qIdx >= S.questions.length) { S.questions = shuffle(S.questions); S.qIdx = 0 }
    const q = S.questions[S.qIdx++]
    S.q = q
    S.opts = shuffle(q.options)
    S.result = null
    S.sunkNote = null
  }

  const placeShip = (pi: number, r: number, c: number) => {
    const p = S.players[pi]
    const def = SHIP_DEFS[S.selShip]
    if (!def || p.ships.find((s) => s.id === def.id)) return
    const cells = shipCells(r, c, def.length, S.orient)
    if (!validPlacement(S, pi, cells)) return
    cells.forEach(([rr, cc]) => { p.grid[rr][cc].shipId = def.id })
    p.ships.push({ id: def.id, name: def.name, length: def.length, cells, sunk: false })
    const placed = new Set(p.ships.map((s) => s.id))
    const next = SHIP_DEFS.findIndex((s, i) => i > S.selShip && !placed.has(s.id))
    if (next >= 0) S.selShip = next
    S.hvr = []
  }

  const fireBomb = (r: number, c: number) => {
    const opI = oppI()
    const cell = S.players[opI].grid[r][c]
    if (cell.hit) return
    cell.hit = true

    if (cell.shipId) {
      const ship = S.players[opI].ships.find((s) => s.id === cell.shipId)!
      const justSunk = ship.cells.every(([rr, cc]) => S.players[opI].grid[rr][cc].hit)
      if (justSunk) ship.sunk = true
      S.hits[S.cur]++
      S.lastBombAnim = { pi: opI, r, c }
      S.sunkShip = justSunk ? { pi: opI, id: ship.id } : null
      const animDur = justSunk ? 750 : 500

      if (checkWin(S, S.cur)) {
        S.winner = S.cur
        render()
        after(animDur, () => { S.lastBombAnim = null; S.sunkShip = null; S.phase = 'game_over'; render() })
      } else {
        drawQ()
        if (justSunk) S.sunkNote = ship.name
        S.battleSub = 'trivia'
        render()
        after(animDur, () => { S.lastBombAnim = null; S.sunkShip = null; render() })
      }
    } else {
      S.lastBombAnim = { pi: opI, r, c }
      S.sunkShip = null
      S.battleSub = 'miss'
      render()
      after(450, () => { S.lastBombAnim = null; render() })
      after(3000, () => { S.cur = oppI(); S.phase = 'pass_device'; render() })
    }
  }

  // ── Event handlers ──
  const selAvatar = (pi: number, ai: number) => { S.players[pi].av = AVATARS[ai]; render() }
  const startPlacement = () => {
    if (!S.players[0].av || !S.players[1].av) return
    S.selShip = 0; S.orient = 'H'; S.hvr = []; S.phase = 'placement_p1'; render()
  }
  const selShip = (pi: number, si: number) => {
    if (!S.players[pi].ships.find((s) => s.id === SHIP_DEFS[si].id)) { S.selShip = si; render() }
  }
  const setOrient = (or: 'H' | 'V') => { S.orient = or; S.hvr = []; render() }
  const onPlace = (pi: number, r: number, c: number) => {
    if (S.players[pi].ships.find((s) => s.id === SHIP_DEFS[S.selShip]?.id)) return
    placeShip(pi, r, c); render()
  }
  const onHover = (pi: number, r: number, c: number) => {
    const def = SHIP_DEFS[S.selShip]
    const placedIds = new Set(S.players[pi].ships.map((s) => s.id))
    if (!def || placedIds.has(def.id)) { if (S.hvr.length) { S.hvr = []; render() } return }
    const cells = shipCells(r, c, def.length, S.orient)
    const ok = validPlacement(S, pi, cells)
    if (JSON.stringify(cells) !== JSON.stringify(S.hvr) || ok !== S.hvrOk) {
      S.hvr = cells; S.hvrOk = ok; render()
    }
  }
  const clearHover = () => { if (S.hvr.length) { S.hvr = []; render() } }
  const donePlacement = (pi: number) => {
    if (S.players[pi].ships.length < SHIP_DEFS.length) return
    if (pi === 0) {
      S.sw = { msg: 'PASS TO P2!', sub: 'Player 1 — look away from the screen!', next: 'placement_p2', btn: "PLAYER 2 — I'M READY" }
      S.selShip = 0; S.orient = 'H'; S.hvr = []; S.phase = 'pl_switch'
    } else {
      S.phase = 'game_start'
    }
    render()
  }
  const switchOk = (next: Phase) => { S.phase = next; S.hvr = []; render() }
  const begin = () => { S.cur = 0; S.phase = 'battle'; S.battleSub = 'trivia'; drawQ(); render() }
  const answer = (opt: string) => {
    S.result = opt === S.q!.correct_answer ? 'correct' : 'wrong'
    S.battleSub = 'result'; render()
  }
  const bomb = () => { S.battleSub = 'targeting'; render() }
  const endTurn = () => { S.sunkNote = null; S.cur = oppI(); S.phase = 'pass_device'; render() }
  const ready = () => { drawQ(); S.phase = 'battle'; S.battleSub = 'trivia'; render() }
  const resetGame = () => { st.current = initState(questions); render() }

  if (questions.length === 0) {
    return (
      <div className="bsw"><style>{CSS}</style><div className="bsw-app"><div className="screen"><p className="vt-text">Chưa có câu hỏi nào để chơi.</p></div></div></div>
    )
  }

  // ── Render helpers ──
  const cur = () => S.players[S.cur]
  const opp = () => S.players[oppI()]

  const renderCells = (pi: number, mode: 'pl' | 'atk') => {
    const grid = S.players[pi].grid
    const lba = S.lastBombAnim
    const sk = S.sunkShip
    const out: React.ReactNode[] = []
    for (let r = 0; r < G; r++) {
      for (let c = 0; c < G; c++) {
        const cell = grid[r][c]
        const isAnim = !!lba && lba.pi === pi && lba.r === r && lba.c === c
        const isSunkCell = !!sk && sk.pi === pi && cell.shipId === sk.id
        let cls = 'cell'
        const key = r * G + c

        if (mode === 'pl') {
          if (cell.shipId) cls += ' shp nc'
          else if (S.hvr.some(([hr, hc]) => hr === r && hc === c)) cls += S.hvrOk ? ' prv' : ' bad'
          out.push(
            <div key={key} className={cls} onClick={() => onPlace(pi, r, c)} onMouseEnter={() => onHover(pi, r, c)} />,
          )
        } else {
          if (cell.hit) {
            if (cell.shipId) {
              const ship = S.players[pi].ships.find((s) => s.id === cell.shipId)
              if (isSunkCell) cls += ' anim-sunk nc'
              else if (isAnim) cls += ' anim-hit nc'
              else if (ship?.sunk) cls += ' snk nc'
              else cls += ' hit nc'
            } else {
              cls += isAnim ? ' anim-miss nc' : ' mss nc'
            }
            out.push(<div key={key} className={cls} />)
          } else if (S.battleSub === 'targeting') {
            out.push(<div key={key} className={cls} onClick={() => fireBomb(r, c)} />)
          } else {
            out.push(<div key={key} className={`${cls} nc`} />)
          }
        }
      }
    }
    return out
  }

  const sunkBanner = S.sunkNote ? <div className="sunk-note">-- {S.sunkNote} DESTROYED! --</div> : null

  const battleAction = () => {
    if (S.battleSub === 'miss') {
      return (
        <div className="tbox">
          <div className="rbanner bad">[ MISS! ]</div>
          <p className="vt-text">Passing turn in 3 seconds...</p>
        </div>
      )
    }
    if (S.battleSub === 'targeting') {
      return <>{sunkBanner}<div className="target-hint">&gt;&gt; SELECT TARGET ON ENEMY GRID &lt;&lt;</div></>
    }
    if (S.battleSub === 'trivia' && S.q) {
      return (
        <div className="tbox">
          {sunkBanner}
          <div className="tq">{S.q.question}</div>
          <div className="px-divider" />
          <div className="opts">
            {S.opts.map((o, i) => (
              <button key={o} className="opt" onClick={() => answer(o)}>
                <strong>[{['A', 'B', 'C', 'D'][i]}]</strong> {o}
              </button>
            ))}
          </div>
          {S.q.hint ? <div className="hint">HINT: {S.q.hint}</div> : null}
        </div>
      )
    }
    if (S.battleSub === 'result' && S.q) {
      const ok = S.result === 'correct'
      return (
        <div className="tbox">
          {sunkBanner}
          <div className={`rbanner ${ok ? 'ok' : 'bad'}`}>{ok ? '[ CORRECT! ]' : '[ WRONG! ]'}</div>
          <div className="opts">
            {S.opts.map((o) => (
              <button key={o} className={`opt ${o === S.q!.correct_answer ? 'rev' : ''}`} disabled>{o}</button>
            ))}
          </div>
          {S.q.explanation ? <div className="expl">INFO: {S.q.explanation}</div> : null}
          {ok
            ? <button className="btn ok" onClick={bomb}>&gt; FIRE TORPEDO!</button>
            : <button className="btn sec" onClick={endTurn}>&gt; END TURN</button>}
        </div>
      )
    }
    return null
  }

  const screen = () => {
    switch (S.phase) {
      case 'char_select': {
        const both = !!S.players[0].av && !!S.players[1].av
        return (
          <div className="screen">
            <div className="px-title">⚓ TRIVIA<br />BATTLESHIP</div>
            <p className="vt-text blink">— SELECT YOUR CHARACTER —</p>
            <div className="cs-row">{[0, 1].map((pi) => {
              const p = S.players[pi]
              return (
                <div key={pi} className="pcard">
                  <div className="px-label">▶ {p.name}</div>
                  <div className="av-big">{p.av ? p.av.em : '?'}</div>
                  <div className="av-grid">
                    {AVATARS.map((av, i) => (
                      <button key={av.em} className={`av-btn ${p.av && p.av.em === av.em ? 'chosen' : ''}`} onClick={() => selAvatar(pi, i)}>
                        <span className="em">{av.em}</span><span>{av.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}</div>
            <button className="btn" onClick={startPlacement} disabled={!both}>{both ? '> START GAME' : '— SELECT BOTH —'}</button>
          </div>
        )
      }
      case 'placement_p1':
      case 'placement_p2': {
        const pi = S.phase === 'placement_p1' ? 0 : 1
        const p = S.players[pi]
        const placed = new Set(p.ships.map((s) => s.id))
        const allDone = placed.size === SHIP_DEFS.length
        return (
          <div className="screen">
            <div className="px-head">{p.av ? p.av.em : ''} {p.name} — DEPLOY FLEET</div>
            <p className="vt-text">Place your ships. Don&apos;t let the enemy see!</p>
            <div className="pl-row">
              <div className="inv">
                <div className="px-label">YOUR FLEET</div>
                <div style={{ height: 4, background: 'repeating-linear-gradient(90deg,var(--bd) 0,var(--bd) 4px,transparent 4px,transparent 8px)', opacity: .5, margin: '4px 0' }} />
                {SHIP_DEFS.map((s, i) => {
                  const done = placed.has(s.id)
                  const sel = !done && S.selShip === i
                  return (
                    <div key={s.id} className={`ship-row ${sel ? 'sel' : ''} ${done ? 'done' : ''}`} onClick={() => !done && selShip(pi, i)}>
                      <div className="sdots">{Array.from({ length: s.length }, (_, k) => <div key={k} className={sel ? 'sd on' : 'sd'} />)}</div>
                      <span>{s.name} ({s.length})</span>
                      {done ? <span style={{ marginLeft: 'auto', color: '#00CC00' }}>OK</span> : null}
                    </div>
                  )
                })}
                <div style={{ marginTop: '.5rem' }}>
                  <div className="px-label" style={{ marginBottom: '.35rem' }}>DIRECTION:</div>
                  <div className="ort">
                    <button className={`ob ${S.orient === 'H' ? 'on' : ''}`} onClick={() => setOrient('H')}>HORIZ</button>
                    <button className={`ob ${S.orient === 'V' ? 'on' : ''}`} onClick={() => setOrient('V')}>VERT</button>
                  </div>
                </div>
                {allDone ? <button className="btn ok" onClick={() => donePlacement(pi)} style={{ marginTop: '.65rem' }}>&gt; DONE [OK]</button> : null}
              </div>
              <div className="gw">
                <div className="glbl">{p.name} GRID</div>
                <div className="grid" onMouseLeave={clearHover}>{renderCells(pi, 'pl')}</div>
              </div>
            </div>
          </div>
        )
      }
      case 'pl_switch':
        return (
          <div className="splash screen">
            <div className="spav">🙈</div>
            <div className="px-title blink">{S.sw?.msg}</div>
            <p className="vt-text">{S.sw?.sub}</p>
            <button className="btn" onClick={() => switchOk(S.sw!.next)}>&gt; {S.sw?.btn}</button>
          </div>
        )
      case 'game_start': {
        const p = S.players[0]
        return (
          <div className="splash screen">
            <div className="spav">⚓</div>
            <div className="px-title blink">BATTLE START!</div>
            <p className="vt-text">{p.av ? p.av.em : ''} {p.name} goes first.</p>
            <button className="btn ok" onClick={begin}>&gt; PRESS START</button>
          </div>
        )
      }
      case 'battle': {
        const p = cur()
        const op = opp()
        const opI = oppI()
        const isTargeting = S.battleSub === 'targeting'
        const free = S.players[opI].grid.flat().filter((c) => !c.hit).length
        return (
          <div className="screen">
            <div className="tbar">
              <span className="em">{p.av ? p.av.em : ''}</span>
              <span>{p.name}&apos;S TURN</span>
              <span className="ml">HITS: {S.hits[S.cur]}</span>
            </div>
            <div className="gw">
              <div className="glbl">{op.name} — ENEMY GRID &nbsp;[{free} CELLS LEFT]</div>
              <div className={`grid${isTargeting ? ' targeting' : ''}`}>{renderCells(opI, 'atk')}</div>
            </div>
            {battleAction()}
          </div>
        )
      }
      case 'pass_device': {
        const p = cur()
        return (
          <div className="splash screen">
            <div className="spav">{p.av ? p.av.em : '?'}</div>
            <div className="px-title blink">P{p.id} TURN!</div>
            <p className="vt-text">Hand the device to {p.name}.<br />Enemy must not look!</p>
            <button className="btn" onClick={ready}>&gt; PRESS START ▶</button>
          </div>
        )
      }
      case 'game_over': {
        const w = S.players[S.winner!]
        const l = S.players[S.winner === 0 ? 1 : 0]
        return (
          <div className="screen">
            <div className="px-title blink">GAME OVER</div>
            <div className="winner-em">{w.av ? w.av.em : '?'}</div>
            <div className="px-head">{w.name}<br />WINS!</div>
            <div className="stat-row">
              <div className="stat-box"><div className="v">{S.hits[S.winner!]}</div><div className="l">{w.name} — HITS</div></div>
              <div className="stat-box"><div className="v">{S.hits[S.winner === 0 ? 1 : 0]}</div><div className="l">{l.name} — HITS</div></div>
            </div>
            <button className="btn" onClick={resetGame}>&gt; PLAY AGAIN [R]</button>
          </div>
        )
      }
      default:
        return null
    }
  }

  return (
    <div className="bsw">
      <style>{CSS}</style>
      <div className="bsw-app">{screen()}</div>
    </div>
  )
}

// ── Scoped retro stylesheet (ported from battleship.css, scoped under .bsw) ──
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
.bsw {
  --bg:#050510; --sf1:#0A0A22; --sf2:#12123A; --water:#0808AA; --accent:#00CCFF; --text:#FCFCFC;
  --dim:#6666AA; --hit:#CC0000; --miss-bg:#0000AA; --ship:#888888; --ok:#00CC00; --bad:#DD0000;
  --yellow:#CCCC00; --bd:#4444BB; --px:4px;
  position:relative; overflow:hidden; border-radius:14px;
  background:var(--bg);
  background-image:linear-gradient(rgba(0,0,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,255,.04) 1px,transparent 1px);
  background-size:8px 8px;
  color:var(--text); font-family:'VT323','Courier New',monospace; font-size:18px;
  image-rendering:pixelated; display:flex; align-items:flex-start; justify-content:center;
  padding:1.25rem .75rem; min-height:520px;
}
.bsw *, .bsw *::before, .bsw *::after { box-sizing:border-box; margin:0; padding:0; }
.bsw::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(0,0,0,.12) 3px,rgba(0,0,0,.12) 4px); pointer-events:none; z-index:50; }
.bsw-app { width:100%; max-width:860px; position:relative; z-index:1; }

@keyframes bs-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@keyframes bs-appear { from{opacity:0} to{opacity:1} }
@keyframes bs-bomb-hit { 0%{background:#FFFFFF} 25%{background:#FFFF44} 50%{background:#FF6600} 75%{background:#CC2200} 100%{background:var(--hit)} }
@keyframes bs-bomb-miss { 0%{background:#AAEEFF} 40%{background:#5599FF} 70%{background:#2244BB} 100%{background:var(--miss-bg)} }
@keyframes bs-bomb-sunk { 0%{background:#FFFFFF} 17%{background:#FF4444} 33%{background:#FFFF00} 50%{background:#FF4444} 67%{background:#110000} 83%{background:#FF2222} 100%{background:#550000} }
@media (prefers-reduced-motion: reduce) { .bsw .cell.anim-hit, .bsw .cell.anim-miss, .bsw .cell.anim-sunk { animation:none !important; } }
.bsw .cell.anim-hit { animation:bs-bomb-hit .5s steps(4) forwards; }
.bsw .cell.anim-miss { animation:bs-bomb-miss .45s steps(3) forwards; }
.bsw .cell.anim-sunk { animation:bs-bomb-sunk .7s steps(6) forwards; }
.bsw .blink { animation:bs-blink 1s step-start infinite; }
.bsw .screen { animation:bs-appear .05s step-start; display:flex; flex-direction:column; align-items:center; gap:1rem; }

.bsw .px-title { font-family:'Press Start 2P',monospace; font-size:1.4rem; color:var(--accent); text-align:center; text-shadow:3px 3px 0 #000,0 0 24px rgba(0,200,255,.3); line-height:1.9; }
.bsw .px-head { font-family:'Press Start 2P',monospace; font-size:.7rem; color:var(--yellow); text-align:center; text-shadow:2px 2px 0 #000; line-height:2; }
.bsw .px-label { font-family:'Press Start 2P',monospace; font-size:.5rem; color:var(--accent); text-shadow:1px 1px 0 #000; }
.bsw .vt-text { font-family:'VT323',monospace; font-size:1.1rem; color:var(--dim); text-align:center; }

.bsw .btn { font-family:'Press Start 2P',monospace; font-size:.52rem; letter-spacing:.5px; line-height:2; padding:.6rem 1.35rem; background:var(--sf2); color:var(--text); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000, inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 rgba(0,0,0,.6), inset var(--px) var(--px) 0 rgba(255,255,255,.08); cursor:pointer; display:inline-block; text-shadow:1px 1px 0 #000; }
.bsw .btn:hover:not(:disabled) { background:var(--bd); color:var(--accent); }
.bsw .btn:active:not(:disabled) { transform:translate(var(--px),var(--px)); box-shadow:1px 1px 0 #000, inset var(--px) var(--px) 0 rgba(0,0,0,.6), inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 rgba(255,255,255,.08); }
.bsw .btn:disabled { opacity:.35; cursor:not-allowed; }
.bsw .btn.ok { background:#004400; border-color:var(--ok); color:var(--ok); box-shadow:var(--px) var(--px) 0 #000, inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 rgba(0,0,0,.6); }
.bsw .btn.ok:hover:not(:disabled) { background:#006600; }
.bsw .btn.sec { background:var(--sf1); border-color:var(--dim); color:var(--dim); }
.bsw .btn.sec:hover:not(:disabled) { border-color:var(--text); color:var(--text); }

.bsw .cs-row { display:grid; grid-template-columns:1fr 1fr; gap:1rem; width:100%; }
.bsw .pcard { background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000; padding:1rem; display:flex; flex-direction:column; align-items:center; gap:.8rem; }
.bsw .av-big { font-size:3.2rem; min-height:4rem; display:flex; align-items:center; justify-content:center; background:var(--sf2); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000; padding:.25rem .75rem; min-width:100px; }
.bsw .av-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.35rem; }
.bsw .av-btn { background:var(--sf2); border:3px solid var(--dim); box-shadow:2px 2px 0 #000; padding:.35rem .2rem; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:.1rem; color:var(--dim); font-family:'VT323',monospace; font-size:.85rem; min-height:44px; min-width:44px; }
.bsw .av-btn .em { font-size:1.6rem; line-height:1.1; }
.bsw .av-btn:hover { border-color:var(--accent); color:var(--accent); }
.bsw .av-btn.chosen { border-color:var(--ok); background:#002200; color:var(--ok); box-shadow:2px 2px 0 #000; }
.bsw .av-btn:active { transform:translate(2px,2px); box-shadow:none; }

.bsw .pl-row { display:flex; gap:1.5rem; align-items:flex-start; flex-wrap:wrap; justify-content:center; }
.bsw .inv { background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000; padding:1rem; display:flex; flex-direction:column; gap:.55rem; min-width:185px; }
.bsw .ship-row { display:flex; align-items:center; gap:.5rem; padding:.4rem .5rem; border:2px solid transparent; cursor:pointer; font-family:'VT323',monospace; font-size:.95rem; color:var(--dim); min-height:44px; }
.bsw .ship-row.sel { border-color:var(--accent); background:var(--sf2); color:var(--text); }
.bsw .ship-row.done { opacity:.4; cursor:default; }
.bsw .sdots { display:flex; gap:2px; }
.bsw .sd { width:10px; height:10px; background:var(--ship); }
.bsw .sd.on { background:var(--accent); }
.bsw .ort { display:flex; gap:.4rem; margin-top:.2rem; }
.bsw .ob { font-family:'Press Start 2P',monospace; font-size:.42rem; padding:.4rem .65rem; background:var(--sf2); border:2px solid var(--bd); color:var(--dim); cursor:pointer; box-shadow:2px 2px 0 #000; min-height:44px; display:flex; align-items:center; }
.bsw .ob:hover { color:var(--text); border-color:var(--accent); }
.bsw .ob.on { background:#001A44; border-color:var(--accent); color:var(--accent); }
.bsw .ob:active { transform:translate(2px,2px); box-shadow:none; }

.bsw .gw { display:flex; flex-direction:column; align-items:center; gap:.45rem; }
.bsw .glbl { font-family:'Press Start 2P',monospace; font-size:.42rem; color:var(--dim); text-align:center; text-shadow:1px 1px 0 #000; }
.bsw .grid { display:grid; grid-template-columns:repeat(6,1fr); gap:2px; background:#000; padding:4px; border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000; }
.bsw .cell { width:52px; height:52px; background:var(--water); display:flex; align-items:center; justify-content:center; cursor:pointer; font-family:'Press Start 2P',monospace; font-size:.6rem; color:var(--text); user-select:none; position:relative; }
.bsw .cell:hover:not(.nc) { background:#2222DD; }
.bsw .cell.nc { cursor:default; }
.bsw .cell.shp { background:#666666; }
.bsw .cell.hit { background:var(--hit); }
.bsw .cell.hit::after { content:'X'; font-family:'Press Start 2P',monospace; font-size:.6rem; color:#FCFCFC; }
.bsw .cell.mss { background:#0000AA; border:2px solid #5555FF; }
.bsw .cell.mss::after { content:'~'; font-family:'VT323',monospace; font-size:1.4rem; color:#8888FF; }
.bsw .cell.snk { background:#550000; }
.bsw .cell.snk::after { content:'X'; font-family:'Press Start 2P',monospace; font-size:.55rem; color:#FF4444; }
.bsw .cell.prv { background:rgba(0,150,255,.45); border:2px solid var(--accent); }
.bsw .cell.bad { background:rgba(200,0,0,.45); border:2px solid var(--bad); }
.bsw .grid.targeting { border-color:var(--accent); box-shadow:var(--px) var(--px) 0 #000,0 0 12px rgba(0,200,255,.3); }
.bsw .grid.targeting .cell:hover:not(.nc) { background:#3333EE; box-shadow:inset 0 0 0 2px var(--accent); }

.bsw .tbar { display:flex; align-items:center; gap:.6rem; background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000; padding:.5rem 1rem; font-family:'Press Start 2P',monospace; font-size:.5rem; color:var(--yellow); width:100%; }
.bsw .tbar .em { font-size:1.5rem; line-height:1; }
.bsw .tbar .ml { margin-left:auto; color:var(--accent); font-size:.45rem; }

.bsw .tbox { background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000, inset 0 0 0 2px #000; padding:1.25rem; width:100%; display:flex; flex-direction:column; gap:.75rem; }
.bsw .tq { font-family:'VT323',monospace; font-size:1.35rem; line-height:1.55; color:var(--text); text-align:center; }
.bsw .opts { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; }
.bsw .opt { padding:.6rem .8rem; background:var(--sf2); border:2px solid var(--bd); box-shadow:2px 2px 0 #000; color:var(--text); font-family:'VT323',monospace; font-size:1.1rem; cursor:pointer; text-align:left; line-height:1.4; position:relative; min-height:44px; }
.bsw .opt::before { content:'\\25BA  '; color:var(--accent); visibility:hidden; }
.bsw .opt:hover:not(:disabled) { border-color:var(--accent); background:#08083A; }
.bsw .opt:hover:not(:disabled)::before { visibility:visible; animation:bs-blink .5s step-start infinite; }
.bsw .opt.rev { border-color:var(--ok); background:#002200; }
.bsw .opt:disabled { cursor:not-allowed; }
.bsw .hint { font-family:'VT323',monospace; font-size:1rem; color:var(--dim); background:var(--sf2); border:2px solid var(--bd); padding:.45rem .8rem; text-align:center; }
.bsw .expl { font-family:'VT323',monospace; font-size:1.05rem; color:var(--dim); background:var(--sf2); border:2px solid var(--bd); padding:.55rem .9rem; text-align:center; line-height:1.5; }
.bsw .rbanner { font-family:'Press Start 2P',monospace; font-size:.75rem; text-align:center; padding:.55rem; text-shadow:2px 2px 0 #000; }
.bsw .rbanner.ok { color:#00FF00; }
.bsw .rbanner.bad { color:#FF0000; animation:bs-blink .8s step-start infinite; }

.bsw .sunk-note { font-family:'Press Start 2P',monospace; font-size:.52rem; color:#FF4444; text-align:center; text-shadow:2px 2px 0 #000; padding:.4rem .6rem; border:2px solid #550000; background:#1A0000; animation:bs-blink .4s step-start infinite; }
.bsw .target-hint { font-family:'Press Start 2P',monospace; font-size:.48rem; color:var(--accent); text-align:center; text-shadow:2px 2px 0 #000; padding:.5rem; animation:bs-blink .8s step-start infinite; }

.bsw .splash { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:50vh; gap:1.75rem; text-align:center; }
.bsw .spav { font-size:5rem; line-height:1; }
.bsw .px-divider { width:100%; height:4px; background:repeating-linear-gradient(90deg,var(--bd) 0,var(--bd) 4px,transparent 4px,transparent 8px); opacity:.5; }

.bsw .winner-em { font-size:5rem; line-height:1; }
.bsw .stat-row { display:grid; grid-template-columns:1fr 1fr; gap:.9rem; width:100%; max-width:380px; }
.bsw .stat-box { background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 #000; padding:.9rem; text-align:center; }
.bsw .stat-box .v { font-family:'Press Start 2P',monospace; font-size:1.5rem; color:var(--accent); text-shadow:2px 2px 0 #000; }
.bsw .stat-box .l { font-family:'VT323',monospace; font-size:1rem; color:var(--dim); margin-top:.3rem; }

@media (max-width:600px) {
  .bsw .cell { width:40px; height:40px; font-size:.48rem; }
  .bsw .opts { grid-template-columns:1fr; }
  .bsw .cs-row { grid-template-columns:1fr; }
  .bsw .pl-row { flex-direction:column; }
  .bsw .px-title { font-size:.9rem; }
  .bsw .tbox { padding:.85rem; }
}
`
