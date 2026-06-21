'use client'

import { useEffect, useReducer, useMemo, useRef, useState } from 'react'
import type { Game, GameItem } from '@/types/app'
import { createBattleshipAudio, type Sfx } from './audio'

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

interface Avatar { em: string; label: string; frames?: [string, string]; smooth?: boolean }
// Characters render as a looping 2-frame sprite (see CharSprite). Until the pixel art
// is ready, the emoji stands in as the placeholder. To use real sprites later, drop two
// PNG frames per animal in  FE/public/games/battleship/characters/  and add `frames`, e.g.:
//   { em: '🦁', label: 'SU TU',
//     frames: ['/games/battleship/characters/lion-1.png', '/games/battleship/characters/lion-2.png'] }
const char = (file: string): [string, string] => {
  const url = `/games/battleship/characters/${file}`
  return [url, url] // single static image → both frame slots point at it
}
const AVATARS: Avatar[] = [
  { em: '👒', label: 'LUFFY', smooth: true, frames: char('luffy.png') },
  { em: '🗡️', label: 'ZORO', smooth: true, frames: char('zoro.png') },
  { em: '🦌', label: 'CHOPPER', smooth: true, frames: char('chopper.png') },
  { em: '⚓', label: 'WHITEBEARD', smooth: true, frames: char('whitebeard.png') },
]

// ── Character special skills (usable once per match) ─────────────────────────
// Each captain carries one signature move that follows the player who picked
// them. Attack skills strike a multi-cell pattern on the enemy grid; the revive
// skill restores one of the caster's own destroyed ships.
type SkillId = 'luffy_line' | 'zoro_zigzag' | 'chopper_revive' | 'whitebeard_square'
interface Skill { id: SkillId; name: string; desc: string; kind: 'attack' | 'revive'; needsOrient?: boolean }
// Keyed by the AVATARS `label` so the skill is tied to the chosen captain.
const SKILLS: Record<string, Skill> = {
  LUFFY:      { id: 'luffy_line',        name: 'GUM-GUM GATLING', desc: 'Fire 4 cells in a straight line (H/V)', kind: 'attack', needsOrient: true },
  ZORO:       { id: 'zoro_zigzag',       name: 'ONIGIRI SLASH',   desc: 'Fire 4 cells in a zig-zag line',        kind: 'attack' },
  CHOPPER:    { id: 'chopper_revive',    name: 'RUMBLE BALL',     desc: 'Revive one destroyed ship',             kind: 'revive' },
  WHITEBEARD: { id: 'whitebeard_square', name: 'GURA GURA',       desc: 'Fire a 2x2 square of cells',            kind: 'attack' },
}
const skillFor = (av: Avatar | null): Skill | null => (av ? SKILLS[av.label] ?? null : null)

// The 4-cell footprint each attack skill strikes, anchored at (r, c).
//  • luffy_line      — straight line of 4 (orientation H or V)
//  • zoro_zigzag     — staircase: down-right, up-right, down-right (spans 4 cols, 2 rows)
//  • whitebeard_square — 2x2 block
function skillCells(id: SkillId, r: number, c: number, orient: 'H' | 'V'): [number, number][] {
  switch (id) {
    case 'luffy_line':
      return Array.from({ length: 4 }, (_, i) => (orient === 'H' ? [r, c + i] : [r + i, c]) as [number, number])
    case 'whitebeard_square':
      return [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]]
    case 'zoro_zigzag':
      return [[r, c], [r + 1, c + 1], [r, c + 2], [r + 1, c + 3]]
    default:
      return []
  }
}

const cellsInBounds = (cells: [number, number][]): boolean =>
  cells.every(([r, c]) => r >= 0 && r < G && c >= 0 && c < G)

// ── Types ──────────────────────────────────────────────────────────────────
type Phase =
  | 'char_select' | 'placement_p1' | 'pl_switch' | 'placement_p2'
  | 'game_start' | 'battle' | 'game_over'
type BattleSub = 'trivia' | 'result' | 'targeting' | 'miss' | 'revive'

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
  // Cells currently playing a bomb animation (one for a normal shot, several for
  // a skill). The per-cell hit/miss/sunk class is derived from grid state.
  anim: { pi: number; cells: [number, number][] } | null
  sunkShips: { pi: number; ids: string[] } | null
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
  // Special-skill state (once per match, per player).
  skillUsed: [boolean, boolean]
  skillActive: SkillId | null   // an attack skill is currently aiming on the enemy grid
  skOrient: 'H' | 'V'           // line orientation for Luffy's GUM-GUM GATLING
  skHvr: [number, number][]     // hovered skill footprint preview
  skOk: boolean                 // is the hovered footprint fully on-grid?
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
    anim: null,
    sunkShips: null,
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
    skillUsed: [false, false],
    skillActive: null,
    skOrient: 'H',
    skHvr: [],
    skOk: true,
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

// ── Preview seeding (review harness only) ───────────────────────────────────
// Deploys a player's whole fleet at fixed positions so a scene can be reviewed
// without placing ships by hand.
function placeFleet(p: Player) {
  const layout: [number, number][] = [[0, 0], [2, 0], [4, 0]] // top-left of each ship, horizontal
  SHIP_DEFS.forEach((def, i) => {
    const cells = shipCells(layout[i][0], layout[i][1], def.length, 'H')
    cells.forEach(([r, c]) => { p.grid[r][c].shipId = def.id })
    p.ships.push({ id: def.id, name: def.name, length: def.length, cells, sunk: false })
  })
}

// Builds a ready-made State for a named scene so /preview can jump straight to it.
function initScene(questions: BQ[], scene: string): State {
  const S = initState(questions)
  if (scene === 'select') return S
  S.players[0].av = AVATARS[0] // 🦁
  S.players[1].av = AVATARS[3] // 🐺
  if (scene === 'placement') { S.phase = 'placement_p1'; S.selShip = 0; return S }
  placeFleet(S.players[0]); placeFleet(S.players[1])
  if (scene === 'battle') {
    S.cur = 0; S.phase = 'battle'; S.battleSub = 'trivia'
    S.players[1].grid[0][0].hit = true // ship cell → shows an X on the enemy grid
    S.players[1].grid[5][5].hit = true // water     → shows a ~ miss
    S.hits = [1, 0]
    S.q = S.questions[0]; S.qIdx = 1; S.opts = shuffle(S.q.options)
    return S
  }
  if (scene === 'gameover') {
    S.players[1].ships.forEach((s) => { s.sunk = true; s.cells.forEach(([r, c]) => { S.players[1].grid[r][c].hit = true }) })
    S.winner = 0; S.hits = [9, 4]; S.phase = 'game_over'
    return S
  }
  return S
}

// ── Character sprite ─────────────────────────────────────────────────────────
// Renders a character as a looping 2-frame sprite. With `av.frames` set it flips
// between the two pixel-art images (frame 1 / frame 2); without them, the emoji is
// shown as a placeholder that bobs so the two-frame loop is visible.
function CharSprite({ av, size = 'md' }: { av: Avatar | null; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!av) return <div className={`csprite ${size} empty`} aria-hidden>?</div>
  if (av.frames) {
    return (
      <div className={`csprite ${size}${av.smooth ? ' smooth' : ''}`} role="img" aria-label={av.label}>
        <span className="frame f1" style={{ backgroundImage: `url('${av.frames[0]}')` }} />
        <span className="frame f2" style={{ backgroundImage: `url('${av.frames[1]}')` }} />
      </div>
    )
  }
  return (
    <div className={`csprite ${size} ph`} role="img" aria-label={av.label}>
      <span className="frame f1">{av.em}</span>
      <span className="frame f2">{av.em}</span>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export function BattleshipShell({ game, scene }: { game: Game; previewMode?: boolean; scene?: string }) {
  const questions = useMemo(() => itemsToQuestions(game.items), [game.items])
  const [, render] = useReducer((x: number) => x + 1, 0)
  const st = useRef<State | null>(null)
  if (st.current === null) st.current = scene ? initScene(questions, scene) : initState(questions)
  const S = st.current

  const timeouts = useRef<number[]>([])
  const after = (ms: number, fn: () => void) => {
    const id = window.setTimeout(fn, ms)
    timeouts.current.push(id)
  }
  useEffect(() => () => { timeouts.current.forEach((id) => clearTimeout(id)) }, [])

  // ── Audio: synthesized 8-bit SFX + looping background music ──
  // The engine builds its AudioContext lazily on first use; browsers block
  // autoplay, so music only kicks in after a real user gesture (ensureAudio).
  const audioRef = useRef<ReturnType<typeof createBattleshipAudio> | null>(null)
  if (audioRef.current === null && typeof window !== 'undefined') audioRef.current = createBattleshipAudio('/games/battleship/battleship.mp3')
  const audio = audioRef.current
  const musicStarted = useRef(false)
  const [muted, setMuted] = useState(false)
  useEffect(() => () => { audioRef.current?.dispose() }, [])

  const sfx = (name: Sfx) => audio?.play(name)
  // Resume the context and start the loop on the player's first interaction.
  const ensureAudio = () => {
    if (!audio) return
    audio.unlock()
    if (!musicStarted.current && !audio.muted) { audio.startMusic(); musicStarted.current = true }
  }
  const toggleMute = () => {
    if (!audio) return
    const m = audio.toggleMuted()
    setMuted(m)
    if (!m) { audio.unlock(); if (!musicStarted.current) { audio.startMusic(); musicStarted.current = true } }
  }

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

  // Resolves a torpedo strike over one or more enemy cells. A normal shot passes
  // a single cell; a skill passes its whole footprint. Landing at least one hit
  // keeps the turn (a fresh question is drawn); a clean miss passes the turn.
  const resolveAttack = (cells: [number, number][]) => {
    const opI = oppI()
    const grid = S.players[opI].grid
    let newHits = 0
    const sunkIds: string[] = []
    for (const [r, c] of cells) {
      if (r < 0 || r >= G || c < 0 || c >= G) continue
      const cell = grid[r][c]
      if (cell.hit) continue
      cell.hit = true
      if (cell.shipId) {
        newHits++
        const ship = S.players[opI].ships.find((s) => s.id === cell.shipId)!
        if (!ship.sunk && ship.cells.every(([rr, cc]) => grid[rr][cc].hit)) {
          ship.sunk = true
          sunkIds.push(ship.id)
        }
      }
    }
    S.hits[S.cur] += newHits
    S.anim = { pi: opI, cells }
    S.sunkShips = sunkIds.length ? { pi: opI, ids: sunkIds } : null
    const animDur = sunkIds.length ? 750 : 500

    // Torpedo whistle now; the impact lands a beat later, in sync with the bomb
    // animation (explosion on a hit/sink, a soft splash on a clean miss).
    sfx('fire')
    const impact: Sfx = sunkIds.length ? 'sunk' : newHits > 0 ? 'hit' : 'miss'
    after(200, () => sfx(impact))

    if (checkWin(S, S.cur)) {
      S.winner = S.cur
      render()
      after(animDur, () => { S.anim = null; S.sunkShips = null; S.phase = 'game_over'; sfx('win'); render() })
    } else if (newHits > 0) {
      drawQ()
      if (sunkIds.length) S.sunkNote = S.players[opI].ships.find((s) => s.id === sunkIds[sunkIds.length - 1])!.name
      S.battleSub = 'trivia'
      render()
      after(animDur, () => { S.anim = null; S.sunkShips = null; render() })
    } else {
      S.battleSub = 'miss'
      render()
      after(450, () => { S.anim = null; render() })
      after(1600, () => { nextTurn() })
    }
  }

  const fireBomb = (r: number, c: number) => {
    if (S.players[oppI()].grid[r][c].hit) return
    resolveAttack([[r, c]])
  }

  // Aim + fire the active attack skill from the hovered anchor cell.
  const fireSkill = (r: number, c: number) => {
    if (!S.skillActive) return
    const cells = skillCells(S.skillActive, r, c, S.skOrient)
    if (!cellsInBounds(cells)) return
    S.skillUsed[S.cur] = true
    S.skillActive = null
    S.skHvr = []
    resolveAttack(cells)
  }

  // Chopper's RUMBLE BALL: restore one of the caster's own destroyed ships, then
  // the earned shot still stands — proceed to a normal torpedo.
  const reviveShip = (shipId: string) => {
    const me = S.players[S.cur]
    const ship = me.ships.find((s) => s.id === shipId)
    if (!ship || !ship.sunk) return
    ship.sunk = false
    ship.cells.forEach(([r, c]) => { me.grid[r][c].hit = false })
    S.skillUsed[S.cur] = true
    S.battleSub = 'targeting'
    sfx('skill')
    render()
  }

  // ── Event handlers ──
  const selAvatar = (pi: number, ai: number) => { ensureAudio(); S.players[pi].av = AVATARS[ai]; sfx('select'); render() }
  const startPlacement = () => {
    if (!S.players[0].av || !S.players[1].av) return
    ensureAudio()
    S.selShip = 0; S.orient = 'H'; S.hvr = []; S.phase = 'placement_p1'; sfx('click'); render()
  }
  const selShip = (pi: number, si: number) => {
    if (!S.players[pi].ships.find((s) => s.id === SHIP_DEFS[si].id)) { S.selShip = si; sfx('click'); render() }
  }
  const setOrient = (or: 'H' | 'V') => { S.orient = or; S.hvr = []; sfx('click'); render() }
  const onPlace = (pi: number, r: number, c: number) => {
    if (S.players[pi].ships.find((s) => s.id === SHIP_DEFS[S.selShip]?.id)) return
    const before = S.players[pi].ships.length
    placeShip(pi, r, c)
    if (S.players[pi].ships.length > before) sfx('place')
    render()
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
    sfx('click')
    if (pi === 0) {
      S.sw = { msg: 'PASS TO P2!', sub: 'Player 1 — look away from the screen!', next: 'placement_p2', btn: "PLAYER 2 — I'M READY" }
      S.selShip = 0; S.orient = 'H'; S.hvr = []; S.phase = 'pl_switch'
    } else {
      S.phase = 'game_start'
    }
    render()
  }
  const switchOk = (next: Phase) => { sfx('click'); S.phase = next; S.hvr = []; render() }
  const begin = () => { ensureAudio(); S.cur = 0; S.phase = 'battle'; S.battleSub = 'trivia'; drawQ(); sfx('click'); render() }
  const answer = (opt: string) => {
    S.result = opt === S.q!.correct_answer ? 'correct' : 'wrong'
    sfx(S.result === 'correct' ? 'correct' : 'wrong')
    S.battleSub = 'result'; render()
  }
  const bomb = () => { sfx('click'); S.skillActive = null; S.skHvr = []; S.battleSub = 'targeting'; render() }
  // Activate the current player's signature skill from the correct-answer card.
  // Attack skills enter aim mode on the enemy grid; the revive skill opens a list.
  const useSkill = () => {
    const sk = skillFor(cur().av)
    if (!sk || S.skillUsed[S.cur]) return
    sfx('skill')
    if (sk.kind === 'revive') {
      S.battleSub = 'revive'
    } else {
      S.skillActive = sk.id; S.skOrient = 'H'; S.skHvr = []; S.battleSub = 'targeting'
    }
    render()
  }
  const cancelSkill = () => { sfx('click'); S.skillActive = null; S.skHvr = []; S.battleSub = 'result'; render() }
  const setSkOrient = (or: 'H' | 'V') => { sfx('click'); S.skOrient = or; S.skHvr = []; render() }
  const onSkillHover = (r: number, c: number) => {
    if (!S.skillActive) return
    const cells = skillCells(S.skillActive, r, c, S.skOrient)
    const ok = cellsInBounds(cells)
    if (JSON.stringify(cells) !== JSON.stringify(S.skHvr) || ok !== S.skOk) {
      S.skHvr = cells; S.skOk = ok; render()
    }
  }
  const clearSkillHover = () => { if (S.skHvr.length) { S.skHvr = []; render() } }
  // Turn switches immediately — no pass-device splash. Flip the current player and
  // draw their question so the next turn's trivia is shown straight away.
  const nextTurn = () => { S.sunkNote = null; S.cur = oppI(); drawQ(); S.phase = 'battle'; S.battleSub = 'trivia'; render() }
  const endTurn = () => { sfx('click'); nextTurn() }
  const resetGame = () => { sfx('click'); st.current = initState(questions); render() }

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
    const an = S.anim
    const sk = S.sunkShips
    const skillAiming = mode === 'atk' && !!S.skillActive && S.battleSub === 'targeting'
    const out: React.ReactNode[] = []
    for (let r = 0; r < G; r++) {
      for (let c = 0; c < G; c++) {
        const cell = grid[r][c]
        const isAnim = !!an && an.pi === pi && an.cells.some(([ar, ac]) => ar === r && ac === c)
        const isSunkCell = !!sk && sk.pi === pi && !!cell.shipId && sk.ids.includes(cell.shipId)
        const inSkill = skillAiming && S.skHvr.some(([hr, hc]) => hr === r && hc === c)
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
            if (inSkill) cls += S.skOk ? ' skprv' : ' skbad'
            out.push(
              skillAiming
                ? <div key={key} className={cls} onClick={() => fireSkill(r, c)} onMouseEnter={() => onSkillHover(r, c)} />
                : <div key={key} className={cls} onClick={() => fireBomb(r, c)} />,
            )
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
          <p className="vt-text">Opponent&apos;s turn next...</p>
        </div>
      )
    }
    if (S.battleSub === 'targeting') {
      if (S.skillActive) {
        const sk = skillFor(cur().av)!
        return (
          <div className="tbox skill-box">
            <div className="skill-title">★ {sk.name} ★</div>
            <div className="target-hint">&gt;&gt; PICK A TARGET — HITS UP TO 4 CELLS &lt;&lt;</div>
            {sk.needsOrient ? (
              <div className="ort">
                <button className={`ob ${S.skOrient === 'H' ? 'on' : ''}`} onClick={() => setSkOrient('H')}>HORIZ</button>
                <button className={`ob ${S.skOrient === 'V' ? 'on' : ''}`} onClick={() => setSkOrient('V')}>VERT</button>
              </div>
            ) : null}
            <button className="btn sec" onClick={cancelSkill}>&gt; CANCEL</button>
          </div>
        )
      }
      return <>{sunkBanner}<div className="target-hint">&gt;&gt; SELECT TARGET ON ENEMY GRID &lt;&lt;</div></>
    }
    if (S.battleSub === 'revive') {
      const me = cur()
      const sunk = me.ships.filter((s) => s.sunk)
      return (
        <div className="tbox skill-box">
          <div className="skill-title">★ RUMBLE BALL — REVIVE ★</div>
          {sunk.length === 0 ? (
            <p className="vt-text">No destroyed ships to revive.</p>
          ) : (
            <div className="revive-list">
              {sunk.map((s) => (
                <button key={s.id} className="opt" onClick={() => reviveShip(s.id)}>
                  <strong>↻</strong> {s.name} ({s.length})
                </button>
              ))}
            </div>
          )}
          <button className="btn sec" onClick={cancelSkill}>&gt; CANCEL</button>
        </div>
      )
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
      const sk = skillFor(cur().av)
      const skillReady = ok && !!sk && !S.skillUsed[S.cur]
      const canRevive = sk?.kind !== 'revive' || cur().ships.some((s) => s.sunk)
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
          {ok ? (
            <div className="action-row">
              <button className="btn ok" onClick={bomb}>&gt; FIRE TORPEDO!</button>
              {skillReady ? (
                <button className="btn skill" onClick={useSkill} disabled={!canRevive} title={sk!.desc}>
                  ★ {sk!.name}{canRevive ? '' : ' (NO SHIPS)'}
                </button>
              ) : null}
            </div>
          ) : (
            <button className="btn sec" onClick={endTurn}>&gt; END TURN</button>
          )}
        </div>
      )
    }
    return null
  }

  const screen = () => {
    switch (S.phase) {
      case 'char_select': {
        const both = !!S.players[0].av && !!S.players[1].av
        const side = (pi: 0 | 1, team: 'p1' | 'p2') => {
          const p = S.players[pi]
          return (
            <div className={`cs-side ${team}`}>
              <div className="cs-banner">{p.name}</div>
              <div className="cs-portrait"><CharSprite av={p.av} size="xl" /></div>
              <div className="cs-charname">{p.av ? p.av.label : '— SELECT —'}</div>
              {(() => {
                const sk = skillFor(p.av)
                return sk ? (
                  <div className="cs-skill">
                    <span className="cs-skill-name">★ {sk.name}</span>
                    <span className="cs-skill-desc">{sk.desc}</span>
                  </div>
                ) : <div className="cs-skill" />
              })()}
              <div className="av-grid">
                {AVATARS.map((av, i) => (
                  <button key={av.em} className={`av-btn ${p.av && p.av.em === av.em ? 'chosen' : ''}`} onClick={() => selAvatar(pi, i)}>
                    <span className="em">{av.em}</span><span>{av.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        }
        return (
          <div className="screen cs">
            <div className="cs-title">⚓ CHOOSE YOUR CAPTAIN</div>
            <div className="vs-stage">
              {side(0, 'p1')}
              <div className="vs-badge"><span>VS</span></div>
              {side(1, 'p2')}
            </div>
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
                      {done ? <span style={{ marginLeft: 'auto', color: 'var(--ok)' }}>OK</span> : null}
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
        const psk = skillFor(p.av)
        return (
          <div className="screen battle">
            {/* Ocean photo is the global .bsw background; .battle-bg is a soft scrim. */}
            <div className="battle-bg" aria-hidden />
            <div className="tbar">
              <span>{p.name}&apos;S TURN</span>
              {psk ? (
                <span className={`skill-chip${S.skillUsed[S.cur] ? ' used' : ''}`}>
                  {S.skillUsed[S.cur] ? 'SKILL USED' : `SKILL: ${psk.name}`}
                </span>
              ) : null}
              <span className="ml">HITS: {S.hits[S.cur]}</span>
            </div>
            <div className="battle-arena">
              <div className={`arena-char p1 ${S.cur === 0 ? 'active' : 'dim'}`}>
                <CharSprite av={S.players[0].av} size="lg" />
                <div className="arena-name">{S.players[0].name}</div>
              </div>
              <div className="gw">
                <div className="glbl">{op.name} — ENEMY GRID &nbsp;[{free} CELLS LEFT]</div>
                <div
                  className={`grid${isTargeting ? ' targeting' : ''}`}
                  onMouseLeave={S.skillActive ? clearSkillHover : undefined}
                >{renderCells(opI, 'atk')}</div>
              </div>
              <div className={`arena-char p2 ${S.cur === 1 ? 'active' : 'dim'}`}>
                <CharSprite av={S.players[1].av} size="lg" />
                <div className="arena-name">{S.players[1].name}</div>
              </div>
            </div>
            <div className="battle-action">{battleAction()}</div>
          </div>
        )
      }
      case 'game_over': {
        const w = S.players[S.winner!]
        return (
          <div className="screen battle">
            <div className="battle-bg" aria-hidden />
            <div className="px-title blink">GAME OVER</div>
            <div className="battle-arena">
              <div className={`arena-char p1 ${S.winner === 0 ? 'active' : 'dim'}`}>
                <CharSprite av={S.players[0].av} size="lg" />
                <div className="arena-name">{S.players[0].name}{S.winner === 0 ? ' ★' : ''}</div>
              </div>
              <div className="result-center">
                <div className="px-head">{w.name}<br />WINS!</div>
                <div className="stat-row">
                  <div className="stat-box"><div className="v">{S.hits[0]}</div><div className="l">{S.players[0].name} — HITS</div></div>
                  <div className="stat-box"><div className="v">{S.hits[1]}</div><div className="l">{S.players[1].name} — HITS</div></div>
                </div>
                <button className="btn" onClick={resetGame}>&gt; PLAY AGAIN [R]</button>
              </div>
              <div className={`arena-char p2 ${S.winner === 1 ? 'active' : 'dim'}`}>
                <CharSprite av={S.players[1].av} size="lg" />
                <div className="arena-name">{S.players[1].name}{S.winner === 1 ? ' ★' : ''}</div>
              </div>
            </div>
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
      <button
        className="mute-btn"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <div className="bsw-app">{screen()}</div>
    </div>
  )
}

// ── Scoped retro stylesheet (ported from battleship.css, scoped under .bsw) ──
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
.bsw {
  /* Vinik24-inspired soft pastel theme (light blue sea). --ink is the shared soft
     "almost-black" outline/shadow; --inv is the shared light tint for text on colour. */
  --ink:#39304a; --bg:#c7d4e0; --sf1:#eef0e8; --sf2:#dae0e9; --water:#aacce4; --water-hi:#c7ddf0;
  --accent:#416aa3; --accent2:#68aca9; --text:#3a3148; --inv:#f5f3ec; --dim:#6f6776; --hit:#9a4f50;
  --miss-bg:#41699f; --ship:#be955c; --ok:#557064; --ok-br:#6eaa78; --bad:#9a4f50; --yellow:#b07d3c;
  --gold:#be955c; --plum:#8b5580; --rose:#c38890; --bd:#7d93ab; --px:4px;
  position:relative; overflow:hidden; border-radius:14px;
  background:#bcdff2 url('/games/battleship/back.jpg') center/cover no-repeat;
  color:var(--text); font-family:'VT323','Courier New',monospace; font-size:18px;
  image-rendering:pixelated; display:flex; align-items:flex-start; justify-content:center;
  padding:1.25rem .75rem; min-height:520px;
}
.bsw *, .bsw *::before, .bsw *::after { box-sizing:border-box; margin:0; padding:0; }
.bsw::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(57,48,74,.06) 3px,rgba(57,48,74,.06) 4px); pointer-events:none; z-index:50; }
.bsw-app { width:100%; max-width:860px; position:relative; z-index:1; }

/* Sound on/off toggle — pinned to the top-right above the scanline overlay. */
.bsw .mute-btn { position:absolute; top:.6rem; right:.6rem; z-index:60; width:40px; height:40px; display:flex; align-items:center; justify-content:center; font-size:1.05rem; line-height:1; background:var(--sf1); border:3px solid var(--ink); box-shadow:2px 2px 0 var(--ink); cursor:pointer; user-select:none; }
.bsw .mute-btn:hover { background:var(--sf2); }
.bsw .mute-btn:active { transform:translate(2px,2px); box-shadow:none; }

@keyframes bs-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
@keyframes bs-appear { from{opacity:0} to{opacity:1} }
@keyframes bs-bomb-hit { 0%{background:#fbf3df} 25%{background:#e7c07e} 50%{background:#d29368} 75%{background:#b06a62} 100%{background:var(--hit)} }
@keyframes bs-bomb-miss { 0%{background:#d9e8f3} 40%{background:#9dbdd7} 70%{background:#5f86b3} 100%{background:var(--miss-bg)} }
@keyframes bs-bomb-sunk { 0%{background:#fbf3df} 17%{background:#c87f6a} 33%{background:#e7c07e} 50%{background:#c87f6a} 67%{background:#5b3f50} 83%{background:#b06a66} 100%{background:#4a3346} }
@media (prefers-reduced-motion: reduce) { .bsw .cell.anim-hit, .bsw .cell.anim-miss, .bsw .cell.anim-sunk { animation:none !important; } }
.bsw .cell.anim-hit { animation:bs-bomb-hit .5s steps(4) forwards; }
.bsw .cell.anim-miss { animation:bs-bomb-miss .45s steps(3) forwards; }
.bsw .cell.anim-sunk { animation:bs-bomb-sunk .7s steps(6) forwards; }
.bsw .blink { animation:bs-blink 1s step-start infinite; }
.bsw .screen { animation:bs-appear .05s step-start; display:flex; flex-direction:column; align-items:center; gap:1rem; }

.bsw .px-title { font-family:'Press Start 2P',monospace; font-size:1.4rem; color:var(--accent); text-align:center; text-shadow:3px 3px 0 var(--ink),0 0 24px rgba(65,106,163,.25); line-height:1.9; }
.bsw .px-head { font-family:'Press Start 2P',monospace; font-size:.7rem; color:var(--yellow); text-align:center; text-shadow:2px 2px 0 var(--ink); line-height:2; }
.bsw .px-label { font-family:'Press Start 2P',monospace; font-size:.5rem; color:var(--accent); text-shadow:1px 1px 0 rgba(255,255,255,.5); }
.bsw .vt-text { font-family:'VT323',monospace; font-size:1.1rem; color:var(--dim); text-align:center; }

.bsw .btn { font-family:'Press Start 2P',monospace; font-size:.52rem; letter-spacing:.5px; line-height:2; padding:.6rem 1.35rem; background:var(--accent); color:var(--inv); border:var(--px) solid var(--ink); box-shadow:var(--px) var(--px) 0 var(--ink), inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 rgba(0,0,0,.22), inset var(--px) var(--px) 0 rgba(255,255,255,.28); cursor:pointer; display:inline-block; text-shadow:1px 1px 0 rgba(0,0,0,.3); }
.bsw .btn:hover:not(:disabled) { background:#4f7cb8; color:#fff; }
.bsw .btn:active:not(:disabled) { transform:translate(var(--px),var(--px)); box-shadow:1px 1px 0 var(--ink), inset var(--px) var(--px) 0 rgba(0,0,0,.22), inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 rgba(255,255,255,.28); }
.bsw .btn:disabled { opacity:.4; cursor:not-allowed; }
.bsw .btn.ok { background:var(--ok-br); border-color:var(--ink); color:#fff; box-shadow:var(--px) var(--px) 0 var(--ink), inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 rgba(0,0,0,.22), inset var(--px) var(--px) 0 rgba(255,255,255,.25); }
.bsw .btn.ok:hover:not(:disabled) { background:#7eb888; }
.bsw .btn.sec { background:var(--sf1); border-color:var(--dim); color:var(--dim); text-shadow:1px 1px 0 rgba(255,255,255,.5); }
.bsw .btn.sec:hover:not(:disabled) { border-color:var(--text); color:var(--text); }

/* ════════════════ CHARACTER SELECT — VS FACE-OFF ════════════════
   Two big captains face each other (blue team vs orange team) with a VS badge
   on the seam. The portraits are CharSprite at the new "xl" size, so the One
   Piece character art drops in by setting "frames" on the AVATARS entries.
*/
.bsw .screen.cs { gap:1.1rem; width:100%; }
.bsw .cs-title { font-family:'Press Start 2P',monospace; font-size:1rem; color:var(--accent); text-align:center; text-shadow:3px 3px 0 var(--ink),0 0 20px rgba(65,106,163,.25); line-height:1.6; }
.bsw .vs-stage { display:flex; align-items:stretch; justify-content:center; width:100%; }
.bsw .cs-side { flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center; gap:.7rem; padding:.9rem .7rem 1rem; border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 var(--ink); }
.bsw .cs-side.p1 { background:linear-gradient(180deg,#cfe1f3 0,#bcd4ec 70%,#aecae4 100%); border-color:#5f86b3; }
.bsw .cs-side.p2 { background:linear-gradient(180deg,#f3ddc8 0,#edccb0 70%,#e6bf9d 100%); border-color:#c69a6a; }
.bsw .cs-banner { width:100%; font-family:'Press Start 2P',monospace; font-size:.55rem; text-align:center; padding:.5rem; color:#fff; text-shadow:2px 2px 0 var(--ink); border:3px solid var(--ink); }
.bsw .cs-side.p1 .cs-banner { background:#416aa3; box-shadow:inset 0 0 0 2px #9dbdd7; }
.bsw .cs-side.p2 .cs-banner { background:#c8895c; box-shadow:inset 0 0 0 2px #f0c79e; }
.bsw .cs-portrait { width:100%; min-height:210px; display:flex; align-items:flex-end; justify-content:center; padding:.4rem; overflow:hidden; }
.bsw .cs-side.p1 .cs-portrait { background:radial-gradient(circle at 50% 35%,rgba(65,106,163,.22),transparent 70%); }
.bsw .cs-side.p2 .cs-portrait { background:radial-gradient(circle at 50% 35%,rgba(194,141,117,.28),transparent 70%); transform:scaleX(-1); } /* p2 faces inward toward VS */
.bsw .cs-charname { font-family:'Press Start 2P',monospace; font-size:.5rem; text-shadow:1px 1px 0 rgba(255,255,255,.55); min-height:1.1em; }
.bsw .cs-side.p1 .cs-charname { color:#3a5f96; }
.bsw .cs-side.p2 .cs-charname { color:#9a6a3f; }
.bsw .vs-badge { align-self:center; flex:none; width:60px; height:60px; margin:0 -16px; z-index:3; display:flex; align-items:center; justify-content:center; background:var(--ink); border:var(--px) solid var(--gold); transform:rotate(45deg); box-shadow:var(--px) var(--px) 0 var(--ink),0 0 16px rgba(190,149,92,.45); }
.bsw .vs-badge span { display:block; transform:rotate(-45deg); font-family:'Press Start 2P',monospace; font-size:.8rem; color:#fff; text-shadow:2px 2px 0 rgba(0,0,0,.5); }
.bsw .av-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.35rem; }
.bsw .av-btn { background:var(--sf2); border:3px solid var(--bd); box-shadow:2px 2px 0 var(--ink); padding:.35rem .2rem; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:.1rem; color:var(--dim); font-family:'VT323',monospace; font-size:.85rem; min-height:44px; min-width:44px; }
.bsw .av-btn .em { font-size:1.6rem; line-height:1.1; }
.bsw .av-btn:hover { border-color:var(--accent); color:var(--accent); }
.bsw .av-btn.chosen { border-color:var(--ok-br); background:#dcebd9; color:var(--ok); box-shadow:2px 2px 0 var(--ink); }
.bsw .av-btn:active { transform:translate(2px,2px); box-shadow:none; }

/* ════════════════ CHARACTER SPRITE (2-frame) ════════════════
   Each character is a 2-frame looping sprite. With "frames" set on its AVATARS
   entry, .f1/.f2 cross-fade between the two pixel-art PNGs; otherwise the emoji
   placeholder bobs so you can see the two-frame loop. Frame size scales with the
   .sm/.md/.lg modifier — the pixel art should be square and drawn to "contain".
*/
@keyframes bs-frameA { 0%,49.9%{opacity:1} 50%,100%{opacity:0} }
@keyframes bs-frameB { 0%,49.9%{opacity:0} 50%,100%{opacity:1} }
@keyframes bs-idle-bob { 0%,49.9%{transform:translateY(0)} 50%,100%{transform:translateY(-3px)} }
.bsw .csprite { position:relative; display:inline-block; vertical-align:middle; flex:none; image-rendering:pixelated; }
.bsw .csprite .frame { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; line-height:1; background-position:center; background-repeat:no-repeat; background-size:contain; image-rendering:pixelated; }
.bsw .csprite .frame.f1 { animation:bs-frameA .7s steps(1,end) infinite; }
.bsw .csprite .frame.f2 { animation:bs-frameB .7s steps(1,end) infinite; }
.bsw .csprite.ph { animation:bs-idle-bob .7s steps(1,end) infinite; }
.bsw .csprite.smooth, .bsw .csprite.smooth .frame { image-rendering:auto; } /* non-pixel art (e.g. anime render) */
.bsw .csprite.sm { width:34px; height:34px; }
.bsw .csprite.sm .frame { font-size:1.5rem; }
.bsw .csprite.md { width:68px; height:68px; }
.bsw .csprite.md .frame { font-size:3.2rem; }
.bsw .csprite.lg { width:104px; height:104px; }
.bsw .csprite.lg .frame { font-size:5rem; }
.bsw .csprite.xl { width:180px; height:180px; }
.bsw .csprite.xl .frame { font-size:8.5rem; }
.bsw .csprite.empty { display:inline-flex; align-items:center; justify-content:center; font-family:'Press Start 2P',monospace; font-size:2.2rem; color:var(--dim); }
@media (prefers-reduced-motion: reduce) {
  .bsw .csprite.ph, .bsw .csprite .frame { animation:none !important; }
  .bsw .csprite .frame.f2 { opacity:0; }
}

.bsw .pl-row { display:flex; gap:1.5rem; align-items:flex-start; flex-wrap:wrap; justify-content:center; }
.bsw .inv { background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 var(--ink); padding:1rem; display:flex; flex-direction:column; gap:.55rem; min-width:185px; }
.bsw .ship-row { display:flex; align-items:center; gap:.5rem; padding:.4rem .5rem; border:2px solid transparent; cursor:pointer; font-family:'VT323',monospace; font-size:.95rem; color:var(--dim); min-height:44px; }
.bsw .ship-row.sel { border-color:var(--accent); background:var(--sf2); color:var(--text); }
.bsw .ship-row.done { opacity:.4; cursor:default; }
.bsw .sdots { display:flex; gap:2px; }
.bsw .sd { width:10px; height:10px; background:var(--ship); }
.bsw .sd.on { background:var(--accent); }
.bsw .ort { display:flex; gap:.4rem; margin-top:.2rem; }
.bsw .ob { font-family:'Press Start 2P',monospace; font-size:.42rem; padding:.4rem .65rem; background:var(--sf2); border:2px solid var(--bd); color:var(--dim); cursor:pointer; box-shadow:2px 2px 0 var(--ink); min-height:44px; display:flex; align-items:center; }
.bsw .ob:hover { color:var(--text); border-color:var(--accent); }
.bsw .ob.on { background:#d4e0ee; border-color:var(--accent); color:var(--accent); }
.bsw .ob:active { transform:translate(2px,2px); box-shadow:none; }

.bsw .gw { display:flex; flex-direction:column; align-items:center; gap:.45rem; }
.bsw .glbl { font-family:'Press Start 2P',monospace; font-size:.42rem; color:var(--dim); text-align:center; text-shadow:1px 1px 0 rgba(255,255,255,.5); }
.bsw .grid { display:grid; grid-template-columns:repeat(6,1fr); gap:2px; background:var(--ink); padding:4px; border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 var(--ink); }
.bsw .cell { width:52px; height:52px; background:var(--water); display:flex; align-items:center; justify-content:center; cursor:pointer; font-family:'Press Start 2P',monospace; font-size:.6rem; color:var(--inv); user-select:none; position:relative; }
.bsw .cell:hover:not(.nc) { background:var(--water-hi); }
.bsw .cell.nc { cursor:default; }
.bsw .cell.shp { background:var(--ship); }
.bsw .cell.hit { background:var(--hit); }
.bsw .cell.hit::after { content:'X'; font-family:'Press Start 2P',monospace; font-size:.6rem; color:var(--inv); }
.bsw .cell.mss { background:var(--miss-bg); border:2px solid #9dbdd7; }
.bsw .cell.mss::after { content:'~'; font-family:'VT323',monospace; font-size:1.4rem; color:#cfe0ef; }
.bsw .cell.snk { background:#5b3138; }
.bsw .cell.snk::after { content:'X'; font-family:'Press Start 2P',monospace; font-size:.55rem; color:var(--rose); }
.bsw .cell.prv { background:rgba(124,161,192,.55); border:2px solid var(--accent); }
.bsw .cell.bad { background:rgba(154,79,80,.5); border:2px solid var(--bad); }
.bsw .grid.targeting { border-color:var(--accent); box-shadow:var(--px) var(--px) 0 var(--ink),0 0 12px rgba(65,106,163,.35); }
.bsw .grid.targeting .cell:hover:not(.nc) { background:#bcd6ea; box-shadow:inset 0 0 0 2px var(--accent); }

/* ════════════════ IN-BATTLE BACKGROUND ════════════════
   The ocean photo (source: assets/img/back.jpg) is applied globally on ".bsw"
   (background:url('/games/battleship/back.jpg')). ".battle-bg" is now just a
   soft scrim over that photo on the battle / game-over screens so the
   transparent character sprites and title stay legible. To change the photo,
   edit the "background:" line on ".bsw" near the top of this stylesheet.
*/
.bsw .screen.battle { position:relative; width:100%; padding:1rem; border-radius:8px; overflow:hidden; }
.bsw .screen.battle > *:not(.battle-bg) { position:relative; z-index:1; }
.bsw .battle-bg {
  position:absolute; inset:0; z-index:0; pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,.14) 0,rgba(255,255,255,.04) 45%,rgba(57,48,74,.18) 100%);
}

.bsw .tbar { display:flex; align-items:center; gap:.6rem; background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 var(--ink); padding:.5rem 1rem; font-family:'Press Start 2P',monospace; font-size:.5rem; color:var(--yellow); width:100%; }
.bsw .tbar .em { font-size:1.5rem; line-height:1; }
.bsw .tbar .ml { margin-left:auto; color:var(--accent); font-size:.45rem; }

/* ════════════════ BATTLE / RESULT ARENA ════════════════
   Both captains flank the centre (the enemy grid in battle, the score in the
   result). The current player (battle) / winner (result) is lit; the other is
   dimmed. P2 is mirrored so the two face inward, VS-style.
*/
.bsw .battle-arena { display:flex; align-items:center; justify-content:center; gap:.6rem; width:100%; }
.bsw .arena-char { flex:none; display:flex; flex-direction:column; align-items:center; gap:.4rem; transition:opacity .2s; }
.bsw .arena-char .csprite { width:120px; height:230px; }
.bsw .arena-char .csprite .frame { background-position:center bottom; }
.bsw .arena-char.p2 .csprite { transform:scaleX(-1); }
.bsw .arena-char.dim { opacity:.45; filter:grayscale(.6); }
.bsw .arena-char.active .csprite { filter:drop-shadow(0 0 7px rgba(65,106,163,.5)); }
.bsw .arena-char.p2.active .csprite { filter:drop-shadow(0 0 7px rgba(190,149,92,.6)); }
.bsw .arena-name { font-family:'Press Start 2P',monospace; font-size:.42rem; text-shadow:1px 1px 0 rgba(255,255,255,.5); text-align:center; }
.bsw .arena-char.p1 .arena-name { color:#3a5f96; }
.bsw .arena-char.p2 .arena-name { color:#9a6a3f; }
.bsw .result-center { flex:1 1 auto; max-width:360px; display:flex; flex-direction:column; align-items:center; gap:1rem; }
/* Reserve a constant footprint for the trivia/result/targeting area so the grid
   and characters above never move when the question + answer cards disappear. */
.bsw .battle-action { width:100%; min-height:340px; display:flex; flex-direction:column; align-items:center; }

.bsw .tbox { background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 var(--ink), inset 0 0 0 2px rgba(57,48,74,.12); padding:1.25rem; width:100%; display:flex; flex-direction:column; gap:.75rem; }
.bsw .tq { font-family:'VT323',monospace; font-size:1.35rem; line-height:1.55; color:var(--text); text-align:center; }
.bsw .opts { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; }
.bsw .opt { padding:.6rem .8rem; background:#f4d6de; border:2px solid var(--rose); box-shadow:2px 2px 0 var(--ink); color:var(--text); font-family:'VT323',monospace; font-size:1.1rem; cursor:pointer; text-align:left; line-height:1.4; position:relative; min-height:44px; }
.bsw .opt::before { content:'\\25BA  '; color:#a84e63; visibility:hidden; }
.bsw .opt:hover:not(:disabled) { border-color:#a84e63; background:#eec2cd; }
.bsw .opt:hover:not(:disabled)::before { visibility:visible; animation:bs-blink .5s step-start infinite; }
.bsw .opt.rev { border-color:var(--ok-br); background:#dfeede; }
.bsw .opt:disabled { cursor:not-allowed; }
.bsw .hint { font-family:'VT323',monospace; font-size:1rem; color:var(--dim); background:var(--sf2); border:2px solid var(--bd); padding:.45rem .8rem; text-align:center; }
.bsw .expl { font-family:'VT323',monospace; font-size:1.05rem; color:var(--dim); background:var(--sf2); border:2px solid var(--bd); padding:.55rem .9rem; text-align:center; line-height:1.5; }
.bsw .rbanner { font-family:'Press Start 2P',monospace; font-size:.75rem; text-align:center; padding:.55rem; text-shadow:2px 2px 0 var(--ink); }
.bsw .rbanner.ok { color:var(--ok-br); }
.bsw .rbanner.bad { color:var(--bad); animation:bs-blink .8s step-start infinite; }

.bsw .sunk-note { font-family:'Press Start 2P',monospace; font-size:.52rem; color:var(--hit); text-align:center; text-shadow:1px 1px 0 rgba(255,255,255,.4); padding:.4rem .6rem; border:2px solid var(--hit); background:#f1dede; animation:bs-blink .4s step-start infinite; }
.bsw .target-hint { font-family:'Press Start 2P',monospace; font-size:.48rem; color:var(--accent); text-align:center; text-shadow:1px 1px 0 rgba(255,255,255,.5); padding:.5rem; animation:bs-blink .8s step-start infinite; }

/* ════════════════ CHARACTER SPECIAL SKILLS ════════════════
   The plum accent (--plum) marks everything skill-related: the result-card skill
   button, the aim panel, the enemy-grid footprint preview, and the turn-bar chip.
*/
.bsw .action-row { display:flex; gap:.55rem; flex-wrap:wrap; justify-content:center; }
.bsw .btn.skill { background:var(--plum); border-color:var(--ink); color:#fff; box-shadow:var(--px) var(--px) 0 var(--ink), inset calc(-1 * var(--px)) calc(-1 * var(--px)) 0 rgba(0,0,0,.22), inset var(--px) var(--px) 0 rgba(255,255,255,.22); }
.bsw .btn.skill:hover:not(:disabled) { background:#9d6592; color:#fff; }
.bsw .skill-box { gap:.7rem; align-items:center; text-align:center; }
.bsw .skill-title { font-family:'Press Start 2P',monospace; font-size:.6rem; color:var(--plum); text-shadow:1px 1px 0 var(--ink); }
.bsw .revive-list { display:flex; flex-direction:column; gap:.5rem; width:100%; }
.bsw .cell.skprv { background:rgba(139,85,128,.6); box-shadow:inset 0 0 0 2px var(--plum); }
.bsw .cell.skbad { background:rgba(154,79,80,.5); box-shadow:inset 0 0 0 2px var(--bad); }
.bsw .skill-chip { font-family:'Press Start 2P',monospace; font-size:.4rem; line-height:1.4; color:#fff; background:var(--plum); border:2px solid var(--ink); padding:.3rem .45rem; margin-left:.6rem; }
.bsw .skill-chip.used { background:var(--sf2); color:var(--dim); border-color:var(--bd); }
.bsw .cs-skill { display:flex; flex-direction:column; align-items:center; gap:.15rem; min-height:3.1em; }
.bsw .cs-skill-name { font-family:'Press Start 2P',monospace; font-size:.4rem; color:var(--plum); text-shadow:1px 1px 0 rgba(255,255,255,.5); }
.bsw .cs-skill-desc { font-family:'VT323',monospace; font-size:.85rem; color:var(--dim); text-align:center; line-height:1.1; max-width:170px; }

.bsw .splash { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:50vh; gap:1.75rem; text-align:center; }
.bsw .spav { font-size:5rem; line-height:1; }
.bsw .px-divider { width:100%; height:4px; background:repeating-linear-gradient(90deg,var(--bd) 0,var(--bd) 4px,transparent 4px,transparent 8px); opacity:.5; }

.bsw .winner-em { font-size:5rem; line-height:1; }
.bsw .stat-row { display:grid; grid-template-columns:1fr 1fr; gap:.9rem; width:100%; max-width:380px; }
.bsw .stat-box { background:var(--sf1); border:var(--px) solid var(--bd); box-shadow:var(--px) var(--px) 0 var(--ink); padding:.9rem; text-align:center; }
.bsw .stat-box .v { font-family:'Press Start 2P',monospace; font-size:1.5rem; color:var(--accent); text-shadow:2px 2px 0 var(--ink); }
.bsw .stat-box .l { font-family:'VT323',monospace; font-size:1rem; color:var(--dim); margin-top:.3rem; }

@media (max-width:600px) {
  .bsw .cell { width:40px; height:40px; font-size:.48rem; }
  .bsw .opts { grid-template-columns:1fr; }
  .bsw .arena-char .csprite { width:64px; height:128px; }
  .bsw .battle-arena { gap:.3rem; }
  .bsw .battle-action { min-height:420px; } /* options stack 1-col on mobile → taller */
  .bsw .vs-stage { flex-direction:column; }
  .bsw .vs-badge { margin:-16px auto; }
  .bsw .cs-side.p2 .cs-portrait { transform:none; }
  .bsw .csprite.xl { width:140px; height:140px; }
  .bsw .csprite.xl .frame { font-size:6.5rem; }
  .bsw .pl-row { flex-direction:column; }
  .bsw .px-title { font-size:.9rem; }
  .bsw .tbox { padding:.85rem; }
}
`
