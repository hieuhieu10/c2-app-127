'use client'

/**
 * Beat Forge Shell — music-based fraction puzzle.
 *
 * items[0]  → global config
 *   correctAnswer = time signature ("4/4" | "3/4" | "2/4" | "6/8")
 *   options       = [half, quarter, eighth, dottedHalf, dottedQuarter, tripletEighth]
 *                   (all supply counts as strings, indices 0–5)
 *
 * items[1..n] → one per lane
 *   correctAnswer = valid note arrangement, e.g. "d.1/4,1/4,t.1/8,t.1/8,t.1/8"
 *   hint          = nudge for filling this lane
 *
 * Internal unit: 24th-units (LCM of 8ths and triplet-3rds).
 *   1/2=12  1/4=6  1/8=3  d.1/2=18  d.1/4=9  t.1/8=2
 *
 * Student tasks:
 *   1. Pick an instrument for each empty lane
 *   2. Drag (or tap) note blocks from the palette onto lanes until every bar is full
 */

import { useEffect, useRef, useState } from 'react'
import type { Game } from '@/types/app'

// ── Constants ───────────────────────────────────────────────────────────────────

const INST_MAP: Record<string, { label: string; role: string; color: string; tint: string }> = {
  boom:  { label: 'Boom',  role: 'the heartbeat',  color: '#e08a6b', tint: '#eaa78e' },
  clap:  { label: 'Clap',  role: 'the backbeat',   color: '#d98aa6', tint: '#e6abbf' },
  tss:   { label: 'Tss',   role: 'fast hats',      color: '#8fb8d4', tint: '#b6d2e4' },
  bloop: { label: 'Bloop', role: 'sustained bass', color: '#9b8cc7', tint: '#bdb2dd' },
  yeah:  { label: 'Yeah!', role: 'vocal chop',     color: '#e0b35e', tint: '#ecca8a' },
  pluck: { label: 'Pluck', role: 'melody',         color: '#7bbf9e', tint: '#a6d6bf' },
}

// Bar capacity in 24th-units; beatU = grid-line spacing (also 24th-units).
const SIGS: Record<string, { cap24: number; beatU: number }> = {
  '4/4': { cap24: 24, beatU: 6 },
  '3/4': { cap24: 18, beatU: 6 },
  '2/4': { cap24: 12, beatU: 6 },
  '6/8': { cap24: 18, beatU: 9 },
}

// 24th-unit value for every note token recognised by the game.
const NOTE_24: Record<string, number> = {
  '1/2': 12,  '1/4': 6,  '1/8': 3,
  'd.1/2': 18, 'd.1/4': 9,
  't.1/8': 2,
}

const SCALE_FREQS = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]
const BASS_FREQS  = SCALE_FREQS.map(f => f / 4)

// ── Types ───────────────────────────────────────────────────────────────────────

interface Note {
  id: number
  /** Base note: n/d  (e.g. n=1, d=4 for quarter) */
  n: number
  d: number
  dot?: boolean      // dotted note (adds half the base value)
  triplet?: boolean  // triplet note (2/3 of base value)
}

interface LaneState { id: number; inst: string | null; notes: Note[] }

interface Supply {
  half: number; quarter: number; eighth: number
  dottedHalf: number; dottedQuarter: number; tripletEighth: number
}

interface PaletteItem {
  n: number; d: number
  dot?: boolean; triplet?: boolean
  /** Actual fraction numerator/denominator to display on the block */
  dispN: number; dispD: number
  name: string
  w: number    // palette tile width in px
  total: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

let _uid = 1
const nextId = () => _uid++

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b)
  while (b) { const t = b; b = a % b; a = t }
  return a || 1
}
function simplify(n: number, d: number) {
  if (n === 0) return { n: 0, d: 1 }
  const g = gcd(n, d); return { n: n / g, d: d / g }
}

/** 24th-unit value of a note. */
function note24(n: number, d: number, dot?: boolean, triplet?: boolean): number {
  const base = n * (24 / d)
  if (dot)     return base + base / 2       // e.g. d.1/4: 6 + 3 = 9
  if (triplet) return Math.round(base * 2 / 3)  // e.g. t.1/8: 3 × 2/3 = 2
  return base
}

/** Parse a backend correct_answer token ("d.1/4", "t.1/8", "1/4") into a Note. */
function tokenToNote(tok: string): Omit<Note, 'id'> {
  if (tok.startsWith('d.')) {
    const [ns, ds] = tok.slice(2).split('/')
    return { n: Number(ns), d: Number(ds), dot: true }
  }
  if (tok.startsWith('t.')) {
    const [ns, ds] = tok.slice(2).split('/')
    return { n: Number(ns), d: Number(ds), triplet: true }
  }
  const [ns, ds] = tok.split('/')
  return { n: Number(ns), d: Number(ds) }
}

function noteKey(nt: Note): string {
  if (nt.dot)     return `d.${nt.n}/${nt.d}`
  if (nt.triplet) return `t.${nt.n}/${nt.d}`
  return `${nt.n}/${nt.d}`
}

function parseGame(game: Game): { timeSig: string; supply: Supply; numLanes: number; hints: string[] } {
  const cfg   = game.items[0]
  const timeSig = cfg?.correctAnswer ?? '4/4'
  const opts    = cfg?.options ?? []
  const supply: Supply = {
    half:          parseInt(opts[0] ?? '0', 10),
    quarter:       parseInt(opts[1] ?? '0', 10),
    eighth:        parseInt(opts[2] ?? '0', 10),
    dottedHalf:    parseInt(opts[3] ?? '0', 10),
    dottedQuarter: parseInt(opts[4] ?? '0', 10),
    tripletEighth: parseInt(opts[5] ?? '0', 10),
  }
  const laneItems = game.items.slice(1)
  return {
    timeSig,
    supply,
    numLanes: Math.max(laneItems.length, 2),
    hints: laneItems.map(it => it.hint ?? ''),
  }
}

// ── Audio engine ─────────────────────────────────────────────────────────────────

type AudioRefs = { ctx: AudioContext | null; master: GainNode | null; noiseBuf: AudioBuffer | null }

function ensureCtx(audio: AudioRefs) {
  if (audio.ctx) return
  const AC = (window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)!
  const ctx    = new AC()
  const master = ctx.createGain()
  master.gain.value = 0.8
  if (ctx.createDynamicsCompressor) {
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp); comp.connect(ctx.destination)
  } else { master.connect(ctx.destination) }
  const len = Math.floor(ctx.sampleRate * 0.4)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d   = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  audio.ctx = ctx; audio.master = master; audio.noiseBuf = buf
}

function playKick(a: AudioRefs, t: number) {
  if (!a.ctx || !a.master) return
  const o = a.ctx.createOscillator(), g = a.ctx.createGain()
  o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1)
  g.gain.setValueAtTime(1.0, t);      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
  o.connect(g).connect(a.master); o.start(t); o.stop(t + 0.22)
}
function playClap(a: AudioRefs, t: number) {
  if (!a.ctx || !a.master || !a.noiseBuf) return
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.013
    const src = a.ctx.createBufferSource(); src.buffer = a.noiseBuf
    const bp  = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.2
    const g   = a.ctx.createGain(); g.gain.setValueAtTime(0.5, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + 0.05)
    src.connect(bp).connect(g).connect(a.master); src.start(tt); src.stop(tt + 0.06)
  }
}
function playHat(a: AudioRefs, t: number) {
  if (!a.ctx || !a.master || !a.noiseBuf) return
  const src = a.ctx.createBufferSource(); src.buffer = a.noiseBuf
  const hp  = a.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000
  const g   = a.ctx.createGain(); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
  src.connect(hp).connect(g).connect(a.master); src.start(t); src.stop(t + 0.05)
}
function playBloop(a: AudioRefs, t: number, freq: number, dur: number) {
  if (!a.ctx || !a.master) return
  const o1 = a.ctx.createOscillator(), o2 = a.ctx.createOscillator()
  const g  = a.ctx.createGain(), lp = a.ctx.createBiquadFilter()
  o1.type = 'triangle'; o2.type = 'sine'
  o1.frequency.value = freq; o2.frequency.value = freq
  lp.type = 'lowpass'; lp.frequency.value = 660
  const peak = 0.36
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.02)
  g.gain.setValueAtTime(peak, t + Math.max(dur - 0.07, 0.03))
  g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.02)
  o1.connect(lp); o2.connect(lp); lp.connect(g).connect(a.master)
  o1.start(t); o2.start(t); o1.stop(t + dur + 0.06); o2.stop(t + dur + 0.06)
}
function playPluck(a: AudioRefs, t: number, freq: number) {
  if (!a.ctx || !a.master) return
  const o1 = a.ctx.createOscillator(), o2 = a.ctx.createOscillator()
  const g  = a.ctx.createGain(), lp = a.ctx.createBiquadFilter()
  o1.type = 'triangle'; o2.type = 'sine'
  o1.frequency.value = freq; o2.frequency.value = freq * 2.01
  lp.type = 'lowpass'; lp.frequency.value = 3200
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.34, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.34)
  o1.connect(lp); o2.connect(g); lp.connect(g).connect(a.master)
  o1.start(t); o2.start(t); o1.stop(t + 0.38); o2.stop(t + 0.38)
}
function playYeah(a: AudioRefs, t: number) {
  if (!a.ctx || !a.master) return
  const o = a.ctx.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(190, t); o.frequency.linearRampToValueAtTime(320, t + 0.13)
  const f1 = a.ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 800;  f1.Q.value = 6
  const f2 = a.ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 9
  const mix = a.ctx.createGain(), g = a.ctx.createGain()
  o.connect(f1).connect(mix); o.connect(f2).connect(mix); mix.connect(g).connect(a.master)
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  o.start(t); o.stop(t + 0.24)
}

function scheduleMeasure(a: AudioRefs, lanes: LaneState[], timeSig: string, bpm: number, startT: number) {
  if (!a.ctx) return
  const { cap24 } = SIGS[timeSig] ?? SIGS['4/4']
  const wholeSec = (60 / bpm) * 4  // duration of one whole note

  lanes.forEach(L => {
    if (!L.inst) return
    let cum24 = 0, sIdx = 0
    for (const nt of L.notes) {
      const len24  = note24(nt.n, nt.d, nt.dot, nt.triplet)
      const pos24  = cum24; cum24 += len24
      if (pos24 >= cap24) break
      const t   = startT + (pos24 / 24) * wholeSec
      const nd  = (Math.min(len24, cap24 - pos24) / 24) * wholeSec
      if      (L.inst === 'boom')  playKick(a, t)
      else if (L.inst === 'clap')  playClap(a, t)
      else if (L.inst === 'tss')   playHat(a, t)
      else if (L.inst === 'yeah')  playYeah(a, t)
      else if (L.inst === 'bloop') { playBloop(a, t, BASS_FREQS[sIdx % BASS_FREQS.length], Math.max(nd, 0.1)); sIdx++ }
      else if (L.inst === 'pluck') { playPluck(a, t, SCALE_FREQS[sIdx % SCALE_FREQS.length]); sIdx++ }
    }
  })
}

// ── Main Shell ──────────────────────────────────────────────────────────────────

export function BeatForgeShell({ game }: { game: Game; previewMode?: boolean; scene?: string }) {
  const { timeSig, supply: initSupply, numLanes, hints } = parseGame(game)
  const { cap24, beatU } = SIGS[timeSig] ?? SIGS['4/4']

  // ── State ────────────────────────────────────────────────────────────────────
  const [lanes, setLanes]           = useState<LaneState[]>(() =>
    Array.from({ length: numLanes }, (_, i) => ({ id: i, inst: null, notes: [] }))
  )
  const [bpm,            setBpm]            = useState(96)
  const [playing,        setPlaying]        = useState(false)
  const [selected,       setSelected]       = useState(0)
  const [instPickerFor,  setInstPickerFor]  = useState<number | null>(null)
  const [won,            setWon]            = useState(false)
  const [dragFrac,       setDragFrac]       = useState<{ n: number; d: number; dot?: boolean; triplet?: boolean } | null>(null)

  const lanesRef   = useRef(lanes);   lanesRef.current   = lanes
  const playingRef = useRef(playing); playingRef.current = playing
  const bpmRef     = useRef(bpm);     bpmRef.current     = bpm

  const audioRef       = useRef<AudioRefs>({ ctx: null, master: null, noiseBuf: null })
  const tickRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const rafRef         = useRef<number | null>(null)
  const nextMeasureRef = useRef(0)
  const playStartRef   = useRef(0)
  const measureLenRef  = useRef(0)
  const phRefs         = useRef<Record<number, HTMLDivElement | null>>({})

  // ── Supply accounting ────────────────────────────────────────────────────────

  function usedCounts(): Record<string, number> {
    const m: Record<string, number> = {}
    lanes.forEach(L => L.notes.forEach(nt => {
      const k = noteKey(nt); m[k] = (m[k] || 0) + 1
    }))
    return m
  }

  function remaining(n: number, d: number, dot?: boolean, triplet?: boolean): number {
    const used = usedCounts()
    const k    = dot ? `d.${n}/${d}` : triplet ? `t.${n}/${d}` : `${n}/${d}`
    let total: number
    if (dot && d === 2)      total = initSupply.dottedHalf
    else if (dot && d === 4) total = initSupply.dottedQuarter
    else if (triplet)        total = initSupply.tripletEighth
    else if (d === 2)        total = initSupply.half
    else if (d === 4)        total = initSupply.quarter
    else                     total = initSupply.eighth
    return total - (used[k] || 0)
  }

  function laneTotal24(lane: LaneState): number {
    return lane.notes.reduce((s, nt) => s + note24(nt.n, nt.d, nt.dot, nt.triplet), 0)
  }

  // ── Win check ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (won) return
    if (lanes.every(L => L.inst !== null && laneTotal24(L) === cap24)) setWon(true)
  }, [lanes]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio ────────────────────────────────────────────────────────────────────
  const recalcMeasureLen = () => {
    const { cap24: c } = SIGS[timeSig] ?? SIGS['4/4']
    measureLenRef.current = (c / 24) * ((60 / bpmRef.current) * 4)
  }

  const scheduleLoop = () => {
    const a = audioRef.current
    if (!a.ctx) return
    while (nextMeasureRef.current < a.ctx.currentTime + 0.12) {
      scheduleMeasure(a, lanesRef.current, timeSig, bpmRef.current, nextMeasureRef.current)
      nextMeasureRef.current += measureLenRef.current
    }
  }

  const startRaf = () => {
    if (rafRef.current) return
    const loop = () => {
      if (!playingRef.current) { rafRef.current = null; return }
      rafRef.current = requestAnimationFrame(loop)
      const a = audioRef.current
      if (!a.ctx) return
      let pos = ((a.ctx.currentTime - playStartRef.current) % measureLenRef.current) / measureLenRef.current
      if (pos < 0) pos = 0
      Object.values(phRefs.current).forEach(el => { if (el) el.style.left = (pos * 100) + '%' })
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  const stopAudio = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
    if (rafRef.current)  { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    Object.values(phRefs.current).forEach(el => { if (el) el.style.left = '0%' })
  }

  const toggle = () => {
    if (playing) { stopAudio(); setPlaying(false); return }
    const a = audioRef.current
    ensureCtx(a)
    if (a.ctx?.state === 'suspended') a.ctx.resume()
    recalcMeasureLen()
    nextMeasureRef.current = (a.ctx?.currentTime ?? 0) + 0.08
    playStartRef.current   = nextMeasureRef.current
    setPlaying(true)
    tickRef.current = setInterval(scheduleLoop, 25)
    scheduleLoop()
    startRaf()
  }

  useEffect(() => {
    return () => {
      stopAudio()
      const a = audioRef.current
      if (a.ctx && a.ctx.state !== 'closed') a.ctx.close()
    }
  }, [])

  // ── Note management ──────────────────────────────────────────────────────────
  const addNote = (laneId: number, n: number, d: number, dot?: boolean, triplet?: boolean) => {
    if (remaining(n, d, dot, triplet) <= 0) return
    setLanes(prev => prev.map(L =>
      L.id === laneId ? { ...L, notes: [...L.notes, { id: nextId(), n, d, dot, triplet }] } : L
    ))
  }

  const removeNote = (laneId: number, noteId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setLanes(prev => prev.map(L =>
      L.id === laneId ? { ...L, notes: L.notes.filter(nt => nt.id !== noteId) } : L
    ))
  }

  const clearLane = (laneId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setLanes(prev => prev.map(L => L.id === laneId ? { ...L, notes: [] } : L))
  }

  const setInst = (laneId: number, inst: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setLanes(prev => prev.map(L => L.id === laneId ? { ...L, inst } : L))
    setInstPickerFor(null)
  }

  // ── Palette ──────────────────────────────────────────────────────────────────
  // dispN/dispD show the actual fraction value (e.g. dotted quarter → 3/8).
  const allPalette: PaletteItem[] = [
    { n:1, d:2, dispN:1, dispD:2,  name:'half',        w:184, total: initSupply.half },
    { n:1, d:4, dispN:1, dispD:4,  name:'quarter',     w:104, total: initSupply.quarter },
    { n:1, d:8, dispN:1, dispD:8,  name:'eighth',      w: 60, total: initSupply.eighth },
    { n:1, d:2, dot:true, dispN:3, dispD:4,  name:'dot ½',  w:220, total: initSupply.dottedHalf },
    { n:1, d:4, dot:true, dispN:3, dispD:8,  name:'dot ¼',  w:136, total: initSupply.dottedQuarter },
    { n:1, d:8, triplet:true, dispN:1, dispD:12, name:'triplet ⅛', w: 48, total: initSupply.tripletEighth },
  ]
  const palette = allPalette.filter(p => p.total > 0)

  const target    = simplify(cap24, 24)
  const targetLbl = target.d === 1 ? `${target.n} whole` : `${target.n}/${target.d}`

  // ── Guard ────────────────────────────────────────────────────────────────────
  if (game.items.length < 2) {
    return (
      <div className="bf">
        <style>{CSS}</style>
        <div style={{ padding:'2rem', textAlign:'center', color:'#9b8cc7', fontWeight:700, fontFamily:'sans-serif' }}>
          No Beat Forge puzzle yet — generate a game to start playing.
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="bf">
      <style>{CSS}</style>

      {/* ── TOP BAR ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px', flexWrap:'wrap', padding:'13px 22px', background:'#fbf7ee', border:'2px solid #3a3326', borderRadius:'18px', boxShadow:'0 3px 0 #3a3326' }}>
        <div style={{ display:'flex', flexDirection:'column', lineHeight:1, flex:'0 0 auto' }}>
          <span style={{ fontWeight:800, fontSize:'25px', color:'#3a3326', letterSpacing:'-0.6px' }}>Beat Forge</span>
          <span style={{ fontFamily:"'Patrick Hand',cursive", fontSize:'13px', color:'#9b8cc7', marginTop:'3px' }}>fill every bar · make a beat</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:'0 0 auto' }}>
          <span style={{ fontWeight:700, fontSize:'22px', color:'#3a3326', background:'#fffdf7', border:'2px solid #3a3326', borderRadius:'10px', padding:'6px 18px' }}>{timeSig}</span>
          <span style={{ fontSize:'11px', fontWeight:600, color:'#a89c84', letterSpacing:'0.4px' }}>TIME · fill to {targetLbl}</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'14px', flex:'0 0 auto' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
            <input
              type="range" min={70} max={140} value={bpm}
              onChange={e => { setBpm(+e.target.value); bpmRef.current = +e.target.value; recalcMeasureLen() }}
              style={{ width:'84px' }}
            />
            <span style={{ fontSize:'10px', fontWeight:600, color:'#a89c84', letterSpacing:'0.4px' }}>{bpm} BPM</span>
          </div>
          <button
            onClick={toggle}
            style={{ display:'flex', alignItems:'center', gap:'8px', fontFamily:"'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:'15px', color:'#3a3326', background:'#7bbf9e', border:'2px solid #3a3326', borderRadius:'999px', padding:'9px 19px', cursor:'pointer', boxShadow:'0 3px 0 #3a3326' }}
          >
            {playing ? '■ Stop' : '▶ Play'}
          </button>
        </div>
      </div>

      {/* ── LANES ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:'11px' }}>
        {lanes.map((lane, laneIdx) => {
          const total24 = laneTotal24(lane)
          const sum     = simplify(total24, 24)
          const full    = total24 === cap24
          const over    = total24 > cap24
          const empty   = lane.notes.length === 0
          const meta    = lane.inst ? INST_MAP[lane.inst] : { label:'?', role:'', color:'#bcb29c', tint:'#e8e0d0' }
          const isSel   = selected === lane.id
          const hint    = hints[laneIdx] ?? ''

          let helper = '', hue = '#bcb29c', showFrac2 = false, fNum = 0, fDen = 1
          if (empty)      { helper = 'drag note blocks here →'; hue = '#bcb29c' }
          else if (over)  { const o = simplify(total24 - cap24, 24); helper = 'over by'; hue = '#c8553d'; showFrac2 = true; fNum = o.n; fDen = o.d }
          else if (full)  { helper = 'full — sounds clean!'; hue = meta.color }
          else            { const r = simplify(cap24 - total24, 24); helper = 'needs'; hue = meta.color; showFrac2 = true; fNum = r.n; fDen = r.d }

          const sumHue = empty ? '#bcb29c' : over ? '#c8553d' : meta.color

          const gridLines: number[] = []
          for (let u = beatU; u < cap24; u += beatU) gridLines.push(u / cap24)

          return (
            <div
              key={lane.id}
              onClick={() => { setSelected(lane.id); setInstPickerFor(null) }}
              style={{ background:'#fbf7ee', border:`2px solid ${isSel ? meta.color : '#e3dccb'}`, borderRadius:'16px', padding:'11px 16px', boxShadow:`0 2px 0 ${isSel ? meta.color : '#e3dccb'}`, cursor:'pointer', transition:'border-color .15s, box-shadow .15s' }}
            >
              <div style={{ display:'flex', alignItems:'stretch', gap:'16px' }}>

                {/* Instrument picker trigger */}
                <div style={{ width:'120px', flex:'0 0 auto', display:'flex', flexDirection:'column', justifyContent:'center', gap:'8px' }}>
                  <button
                    onClick={e => { e.stopPropagation(); setInstPickerFor(instPickerFor === lane.id ? null : lane.id) }}
                    style={{ alignSelf:'flex-start', fontWeight:800, fontSize:'15px', color:'#3a3326', background:meta.tint, border:'2px solid #3a3326', borderRadius:'9px', padding:'4px 12px', transform:'rotate(-2.5deg)', boxShadow:'0 2px 0 #3a3326', cursor:'pointer' }}
                  >
                    {lane.inst ? meta.label : '+ pick ▾'}
                  </button>
                  {lane.inst && (
                    <button
                      onClick={e => clearLane(lane.id, e)}
                      style={{ fontFamily:"'Patrick Hand',cursive", fontSize:'13px', color:'#a89c84', background:'transparent', border:'none', cursor:'pointer', padding:'0', textAlign:'left' }}
                    >↺ clear</button>
                  )}
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (dragFrac) addNote(lane.id, dragFrac.n, dragFrac.d, dragFrac.dot, dragFrac.triplet) }}
                  style={{ position:'relative', flex:'1 1 auto', height:'88px', background:'#fffdf7', border:'2px solid #e3dccb', borderRadius:'12px', overflow:'hidden', boxShadow:'inset 0 2px 6px rgba(58,51,38,0.05)' }}
                >
                  {gridLines.map((pos, i) => (
                    <div key={i} style={{ position:'absolute', left:(pos*100)+'%', top:0, bottom:0, width:'1px', background:'#e3dccb' }} />
                  ))}

                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'stretch' }}>
                    {lane.notes.map(nt => {
                      const pct   = (note24(nt.n, nt.d, nt.dot, nt.triplet) / cap24) * 100
                      const disp  = simplify(note24(nt.n, nt.d, nt.dot, nt.triplet), 24)
                      const accent = nt.dot ? '#9b8cc7' : nt.triplet ? '#e08a6b' : undefined
                      return (
                        <div
                          key={nt.id}
                          onClick={e => removeNote(lane.id, nt.id, e)}
                          title="click to remove"
                          style={{ position:'relative', width:pct+'%', height:'100%', boxSizing:'border-box', background:meta.tint, border:'2px solid rgba(58,51,38,0.22)', borderRadius:'9px', display:'flex', alignItems:'center', justifyContent:'center', flex:'0 0 auto', cursor:'pointer' }}
                        >
                          <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', lineHeight:0.82, fontWeight:800, fontSize:'18px', color:'#3a3326' }}>
                            <span>{disp.n}</span>
                            <span style={{ height:'2px', width:'120%', background:'#3a3326', borderRadius:'2px' }} />
                            <span>{disp.d}</span>
                          </span>
                          {nt.dot && (
                            <span style={{ position:'absolute', top:'4px', right:'5px', fontSize:'14px', fontWeight:900, color: accent, lineHeight:1 }}>·</span>
                          )}
                          {nt.triplet && (
                            <span style={{ position:'absolute', top:'3px', right:'4px', fontSize:'10px', fontWeight:700, color: accent, lineHeight:1 }}>T</span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {empty && (
                    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Patrick Hand',cursive", color:'#bcb29c', fontSize:'16px', pointerEvents:'none' }}>
                      drag note blocks here →
                    </div>
                  )}

                  {/* Playhead */}
                  <div
                    ref={el => { phRefs.current[lane.id] = el }}
                    style={{ position:'absolute', left:'0%', top:0, bottom:0, width:'2px', background:'#9b8cc7', pointerEvents:'none', zIndex:5 }}
                  >
                    <div style={{ position:'absolute', top:'-4px', left:'-4px', width:'10px', height:'10px', borderRadius:'50%', background:'#9b8cc7', border:'1.5px solid #fffdf7' }} />
                  </div>
                </div>

                {/* Sum display */}
                <div style={{ width:'150px', flex:'0 0 auto', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'flex-end', gap:'5px' }}>
                  <div style={{ color:sumHue, display:'flex', alignItems:'center', gap:'4px' }}>
                    {sum.d === 1
                      ? <span style={{ fontWeight:800, fontSize:'28px', lineHeight:1 }}>{sum.n}</span>
                      : <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', lineHeight:0.82, fontWeight:800, fontSize:'18px' }}>
                          <span>{sum.n}</span>
                          <span style={{ height:'2px', width:'130%', background:'currentColor', borderRadius:'2px' }} />
                          <span>{sum.d}</span>
                        </span>
                    }
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#bcb29c', marginLeft:'3px', display:'inline-flex', alignItems:'center', gap:'3px' }}>
                      /&nbsp;
                      {target.d === 1
                        ? <span>{target.n}</span>
                        : <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', lineHeight:0.78 }}>
                            <span>{target.n}</span><span style={{ height:'1.5px', width:'120%', background:'currentColor' }} /><span>{target.d}</span>
                          </span>
                      }
                    </span>
                  </div>

                  <div style={{ color:hue, display:'flex', alignItems:'center', gap:'5px', fontFamily:"'Patrick Hand',cursive", fontSize:'14px' }}>
                    <span>{helper}</span>
                    {showFrac2 && (
                      <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', lineHeight:0.78, fontWeight:700, fontSize:'12px' }}>
                        <span>{fNum}</span>
                        <span style={{ height:'1.5px', width:'120%', background:'currentColor', borderRadius:'2px' }} />
                        <span>{fDen}</span>
                      </span>
                    )}
                  </div>

                  {full && (
                    <div style={{ fontWeight:800, fontSize:'13px', color:'#fffdf7', background:meta.color, border:'2px solid #3a3326', borderRadius:'8px', padding:'3px 10px', transform:'rotate(-7deg)', boxShadow:'0 2px 0 #3a3326', animation:'bf-pop .35s ease-out' }}>FULL ✓</div>
                  )}
                </div>

              </div>

              {/* Instrument picker popup */}
              {instPickerFor === lane.id && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ display:'flex', gap:'8px', flexWrap:'wrap', padding:'10px 0 2px 136px' }}
                >
                  {Object.entries(INST_MAP).map(([key, m]) => (
                    <button
                      key={key}
                      onClick={e => setInst(lane.id, key, e)}
                      style={{ display:'flex', alignItems:'center', gap:'8px', fontFamily:"'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:'13px', color:'#3a3326', background:lane.inst === key ? m.tint : '#fffdf7', border:`2px solid ${lane.inst === key ? m.color : '#3a3326'}`, borderRadius:'10px', padding:'7px 12px', cursor:'pointer', boxShadow:'0 2px 0 #d8cfbe' }}
                    >
                      <span style={{ width:'10px', height:'10px', borderRadius:'50%', background:m.color, border:'1.5px solid #3a3326', display:'inline-block' }} />
                      <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', lineHeight:1.05 }}>
                        <span>{m.label}</span>
                        <span style={{ fontFamily:"'Patrick Hand',cursive", fontSize:'10px', fontWeight:400, color:'#a89c84' }}>{m.role}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Lane hint */}
              {hint && isSel && !full && (
                <div style={{ paddingTop:'8px', paddingLeft:'136px', fontFamily:"'Patrick Hand',cursive", fontSize:'13px', color:'#9b8cc7' }}>
                  💡 {hint}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── NOTE BLOCKS PALETTE ── */}
      <div style={{ display:'flex', alignItems:'center', gap:'20px', padding:'15px 22px', background:'#fbf7ee', border:'2px solid #3a3326', borderRadius:'18px', boxShadow:'0 3px 0 #3a3326', flexWrap:'wrap' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'3px', width:'130px', flex:'0 0 auto' }}>
          <span style={{ fontWeight:700, fontSize:'16px', color:'#3a3326' }}>Note blocks</span>
          <span style={{ fontFamily:"'Patrick Hand',cursive", fontSize:'13px', color:'#7c7363', lineHeight:1.15 }}>drag onto a track — or tap a track, then a block</span>
        </div>

        <div style={{ display:'flex', alignItems:'flex-end', gap:'12px', flex:'1 1 auto', flexWrap:'wrap' }}>
          {palette.map(p => {
            const rem      = remaining(p.n, p.d, p.dot, p.triplet)
            const disabled = rem <= 0
            const accent   = p.dot ? '#9b8cc7' : p.triplet ? '#e08a6b' : '#9b8cc7'
            return (
              <div
                key={`${p.dot ? 'd.' : p.triplet ? 't.' : ''}${p.n}/${p.d}`}
                draggable={!disabled}
                onDragStart={e => {
                  if (disabled) { e.preventDefault(); return }
                  setDragFrac({ n: p.n, d: p.d, dot: p.dot, triplet: p.triplet })
                  try { e.dataTransfer.setData('text/plain', p.name); e.dataTransfer.effectAllowed = 'copy' } catch (_) {}
                }}
                onDragEnd={() => setDragFrac(null)}
                onClick={() => { if (!disabled) addNote(selected, p.n, p.d, p.dot, p.triplet) }}
                style={{ position:'relative', width:p.w+'px', height:'86px', flex:'0 0 auto', background:'#fffdf7', border:'2px solid #3a3326', borderRadius:'11px', boxShadow:'0 3px 0 #d8cfbe', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'2px', cursor:disabled ? 'not-allowed' : 'grab', overflow:'hidden', opacity:disabled ? 0.42 : 1, filter:disabled ? 'grayscale(0.4)' : 'none' }}
              >
                <span style={{ position:'absolute', top:0, left:0, right:0, height:'6px', background: accent, borderRadius:'9px 9px 0 0' }} />
                {/* Note type badge for dotted/triplet */}
                {p.dot && (
                  <span style={{ position:'absolute', top:'8px', right:'6px', fontSize:'11px', fontWeight:800, color: accent, lineHeight:1 }}>·</span>
                )}
                {p.triplet && (
                  <span style={{ position:'absolute', top:'7px', right:'5px', fontSize:'10px', fontWeight:700, color: accent, lineHeight:1 }}>T</span>
                )}
                {/* Fraction display (actual value) */}
                <span style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', lineHeight:0.82, fontWeight:800, fontSize:'21px', color:'#3a3326' }}>
                  <span>{p.dispN}</span>
                  <span style={{ height:'2px', width:'130%', background:'#3a3326', borderRadius:'2px' }} />
                  <span>{p.dispD}</span>
                </span>
                <span style={{ fontFamily:"'Patrick Hand',cursive", fontSize:'12px', color:'#7c7363', marginTop:'1px' }}>{p.name}</span>
                <span style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:'11px', color:disabled ? '#c8553d' : accent }}>
                  {rem} left
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'3px', flex:'0 0 auto' }}>
          <span style={{ fontFamily:"'Patrick Hand',cursive", fontSize:'13px', color:'#a89c84' }}>adding to</span>
          <span style={{ fontWeight:700, fontSize:'17px', color: lanes[selected]?.inst ? INST_MAP[lanes[selected].inst!].color : '#bcb29c' }}>
            {lanes[selected]?.inst ? INST_MAP[lanes[selected].inst!].label : `Lane ${selected + 1}`}
          </span>
        </div>
      </div>

      {/* ── LEGEND for dotted / triplet ── */}
      {(initSupply.dottedHalf > 0 || initSupply.dottedQuarter > 0 || initSupply.tripletEighth > 0) && (
        <div style={{ display:'flex', gap:'18px', flexWrap:'wrap', padding:'10px 18px', background:'#fffdf7', border:'1.5px solid #e3dccb', borderRadius:'12px', fontSize:'12px', color:'#7c7363', fontFamily:"'Patrick Hand',cursive" }}>
          {(initSupply.dottedHalf > 0 || initSupply.dottedQuarter > 0) && (
            <span><strong style={{ color:'#9b8cc7' }}>·</strong> = dotted note — adds half its own value. Dotted ¼ = ¼ + ⅛ = <strong>3/8</strong>.</span>
          )}
          {initSupply.tripletEighth > 0 && (
            <span><strong style={{ color:'#e08a6b' }}>T</strong> = triplet eighth — three fit in one quarter. Each = <strong>1/12</strong> of a whole note.</span>
          )}
        </div>
      )}

      {/* ── WIN OVERLAY ── */}
      {won && (
        <div
          onClick={() => setWon(false)}
          style={{ position:'fixed', inset:0, background:'rgba(45,40,30,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'24px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'#fbf7ee', border:'2px solid #3a3326', borderRadius:'22px', boxShadow:'0 12px 0 rgba(0,0,0,0.18)', padding:'32px', width:'420px', maxWidth:'100%', display:'flex', flexDirection:'column', gap:'18px', textAlign:'center' }}
          >
            <span style={{ fontSize:'52px', lineHeight:1 }}>🎵</span>
            <span style={{ fontWeight:800, fontSize:'26px', color:'#3a3326' }}>Beat complete!</span>
            <span style={{ fontFamily:"'Patrick Hand',cursive", fontSize:'16px', color:'#7c7363', lineHeight:1.4 }}>
              You filled all {numLanes} bars in <strong>{timeSig}</strong> time using every note block.
              Press Play to hear your beat!
            </span>
            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <button
                onClick={toggle}
                style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:'15px', color:'#3a3326', background:'#7bbf9e', border:'2px solid #3a3326', borderRadius:'999px', padding:'10px 22px', cursor:'pointer', boxShadow:'0 3px 0 #3a3326' }}
              >
                {playing ? '■ Stop' : '▶ Play my beat'}
              </button>
              <button
                onClick={() => setWon(false)}
                style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontWeight:700, fontSize:'15px', color:'#3a3326', background:'#e3dccb', border:'2px solid #3a3326', borderRadius:'999px', padding:'10px 22px', cursor:'pointer', boxShadow:'0 3px 0 #3a3326' }}
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── Scoped CSS ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Patrick+Hand&display=swap');

.bf {
  font-family: 'Bricolage Grotesque', sans-serif;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px 24px 30px;
  background-color: #f4efe1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bf * { box-sizing: border-box; }

input[type=range] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 999px; background: #e3dccb; outline: none; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #9b8cc7; border: 2px solid #3a3326; cursor: pointer; }
input[type=range]::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #9b8cc7; border: 2px solid #3a3326; cursor: pointer; }

@keyframes bf-pop {
  0%   { transform: scale(0.4) rotate(-7deg); opacity: 0; }
  60%  { transform: scale(1.15) rotate(-7deg); }
  100% { transform: scale(1) rotate(-7deg); opacity: 1; }
}
`
