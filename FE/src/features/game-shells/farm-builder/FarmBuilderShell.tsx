'use client'

import { useMemo, useReducer } from 'react'
import type { ShellProps } from '../registry'

// ── Grid ──────────────────────────────────────────────────────────────────────
const COLS = 9, ROWS = 7, CELL = 58, PAD = 22
const BOARD_W = 566, BOARD_H = 450
const px = (c: number) => PAD + c * CELL   // SVG x for grid column c
const py = (r: number) => PAD + r * CELL   // SVG y for grid row r

// Shapes that require vertex/diagonal mode instead of fence-edge mode
const ADVANCED = new Set(['hình bình hành', 'hình thoi', 'hình thang'])

// ── Problem parsing ───────────────────────────────────────────────────────────
interface Problem {
  shapeType: string
  constraint: 'diện tích' | 'chu vi'
  value: number
  hint: string
  explanation: string
}

function parseProblem(item: {
  options?: string[]; correctAnswer?: string; hint?: string; explanation?: string
} | null): Problem {
  // BE_Web path: options = [shapeType, constraint, str(value)]
  // Chat-preview path: options = [correctAnswer] (questionsToGame puts the full string there)
  const opts = item?.options ?? []
  let shapeType: string, constraint: string, value: number
  if (opts.length >= 3 && !opts[0].includes('|')) {
    shapeType = opts[0]; constraint = opts[1]; value = parseInt(opts[2], 10) || 12
  } else {
    const parts = (item?.correctAnswer ?? opts[0] ?? '').split('|')
    shapeType  = parts[0] ?? 'hình chữ nhật'
    constraint = parts[1] ?? 'diện tích'
    value      = parseInt(parts[2] ?? '12', 10) || 12
  }
  return {
    shapeType, constraint: constraint as Problem['constraint'],
    value, hint: item?.hint ?? '', explanation: item?.explanation ?? '',
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
interface FBState {
  hSet:      Set<string>
  vSet:      Set<string>
  vertices:  [number, number][]   // vertex mode: [row, col] grid corners
  problemIdx: number
  allDone:   boolean
}

type FBAction =
  | { type: 'toggleH';      r: number; c: number }
  | { type: 'toggleV';      r: number; c: number }
  | { type: 'toggleVertex'; r: number; c: number }
  | { type: 'clear' }
  | { type: 'next'; total: number }
  | { type: 'restart' }

const initState = (): FBState => ({
  hSet: new Set(), vSet: new Set(), vertices: [], problemIdx: 0, allDone: false,
})

function reducer(s: FBState, a: FBAction): FBState {
  switch (a.type) {
    case 'toggleH': {
      const k = `${a.r}:${a.c}`, n = new Set(s.hSet)
      n.has(k) ? n.delete(k) : n.add(k); return { ...s, hSet: n }
    }
    case 'toggleV': {
      const k = `${a.r}:${a.c}`, n = new Set(s.vSet)
      n.has(k) ? n.delete(k) : n.add(k); return { ...s, vSet: n }
    }
    case 'toggleVertex': {
      const idx = s.vertices.findIndex(([r, c]) => r === a.r && c === a.c)
      if (idx >= 0) return { ...s, vertices: s.vertices.slice(0, idx) }
      if (s.vertices.length >= 4) return s                        // max 4 for a quadrilateral
      return { ...s, vertices: [...s.vertices, [a.r, a.c]] }
    }
    case 'clear':   return { ...s, hSet: new Set(), vSet: new Set(), vertices: [] }
    case 'next': {
      const next = s.problemIdx + 1
      return { hSet: new Set(), vSet: new Set(), vertices: [], problemIdx: next, allDone: next >= a.total }
    }
    case 'restart': return initState()
  }
}

// ── Edge-mode (fence) logic ───────────────────────────────────────────────────
interface EdgeItem { key: string; x: number; y: number; r: number; c: number }
interface PostItem { key: string; left: number; top: number }
interface CellItem { key: string; left: number; top: number }

interface EdgeDerived {
  fieldCells: CellItem[]; hGhost: EdgeItem[]; hPlaced: EdgeItem[]
  vGhost: EdgeItem[]; vPlaced: EdgeItem[]; posts: PostItem[]
  area: number; perimeter: number; boundaryCount: number
  bbW: number; bbH: number; isRect: boolean; isSquare: boolean; solved: boolean
}

function deriveEdge(hSet: Set<string>, vSet: Set<string>, prob: Problem): EdgeDerived {
  const hH = (r: number, c: number) => hSet.has(`${r}:${c}`)
  const vH = (r: number, c: number) => vSet.has(`${r}:${c}`)

  const outside: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false))
  const q: [number, number][] = []
  const seed = (r: number, c: number) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !outside[r][c]) {
      outside[r][c] = true; q.push([r, c])
    }
  }
  for (let c = 0; c < COLS; c++) { if (!hH(0, c)) seed(0, c); if (!hH(ROWS, c)) seed(ROWS - 1, c) }
  for (let r = 0; r < ROWS; r++) { if (!vH(r, 0)) seed(r, 0); if (!vH(r, COLS)) seed(r, COLS - 1) }
  while (q.length) {
    const [r, c] = q.pop()!
    if (r > 0      && !hH(r, c))     seed(r - 1, c)
    if (r < ROWS-1 && !hH(r+1, c))   seed(r + 1, c)
    if (c > 0      && !vH(r, c))     seed(r, c - 1)
    if (c < COLS-1 && !vH(r, c+1))   seed(r, c + 1)
  }
  const inside = (r: number, c: number) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && !outside[r][c]

  let area = 0, minR = ROWS, maxR = -1, minC = COLS, maxC = -1
  const bH = new Set<string>(), bV = new Set<string>()
  const fieldCells: CellItem[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!inside(r, c)) continue
      area++; fieldCells.push({ key: `f${r}_${c}`, left: PAD+c*CELL, top: PAD+r*CELL })
      minR=Math.min(minR,r); maxR=Math.max(maxR,r); minC=Math.min(minC,c); maxC=Math.max(maxC,c)
      if (!inside(r-1,c)) bH.add(`${r}:${c}`);    if (!inside(r+1,c)) bH.add(`${r+1}:${c}`)
      if (!inside(r,c-1)) bV.add(`${r}:${c}`);    if (!inside(r,c+1)) bV.add(`${r}:${c+1}`)
    }
  }
  const perimeter     = hSet.size + vSet.size
  const boundaryCount = bH.size + bV.size
  const tidy          = boundaryCount > 0 && perimeter === boundaryCount
  const bbW           = area > 0 ? maxC - minC + 1 : 0
  const bbH           = area > 0 ? maxR - minR + 1 : 0
  const isRect        = area > 0 && area === bbW * bbH
  const isSquare      = isRect && bbW === bbH
  const shapeOk       = prob.shapeType === 'hình vuông' ? isSquare : isRect
  const constraintMet = prob.constraint === 'diện tích' ? area === prob.value : perimeter === prob.value
  const solved        = tidy && shapeOk && constraintMet

  const hGhost: EdgeItem[] = [], hPlaced: EdgeItem[] = []
  for (let r = 0; r <= ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const e: EdgeItem = { key:`h${r}_${c}`, x:PAD+c*CELL, y:PAD+r*CELL, r, c }
      ;(hSet.has(`${r}:${c}`) ? hPlaced : hGhost).push(e)
    }
  const vGhost: EdgeItem[] = [], vPlaced: EdgeItem[] = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS; c++) {
      const e: EdgeItem = { key:`v${r}_${c}`, x:PAD+c*CELL, y:PAD+r*CELL, r, c }
      ;(vSet.has(`${r}:${c}`) ? vPlaced : vGhost).push(e)
    }
  const pset = new Set<string>()
  hSet.forEach(k => { const [r,c]=k.split(':').map(Number); pset.add(`${r}:${c}`); pset.add(`${r}:${c+1}`) })
  vSet.forEach(k => { const [r,c]=k.split(':').map(Number); pset.add(`${r}:${c}`); pset.add(`${r+1}:${c}`) })
  const posts: PostItem[] = [...pset].map(k => {
    const [r,c]=k.split(':').map(Number); return { key:`p${k}`, left:PAD+c*CELL-8, top:PAD+r*CELL-8 }
  })
  return { fieldCells, hGhost, hPlaced, vGhost, vPlaced, posts, area, perimeter, boundaryCount, bbW, bbH, isRect, isSquare, solved }
}

function edgeStars(prob: Problem, area: number, perimeter: number): number {
  if (prob.shapeType === 'hình vuông') return 3
  if (prob.constraint === 'diện tích') {
    const sr = Math.floor(Math.sqrt(area))
    const minP = 2 * (sr + Math.ceil(area / sr))
    return perimeter <= minP ? 3 : perimeter <= minP + 4 ? 2 : 1
  }
  const s = prob.value / 2, maxSide = Math.floor(s / 2)
  const maxArea = maxSide * (s - maxSide)
  return area >= maxArea ? 3 : area >= maxArea - 4 ? 2 : 1
}

// ── Vertex-mode (diagonal) logic ──────────────────────────────────────────────
type V2 = [number, number]

function shoelaceArea(v: V2[]): number {
  if (v.length < 3) return 0
  let sum = 0
  for (let i = 0; i < v.length; i++) {
    const [r0, c0] = v[i], [r1, c1] = v[(i+1) % v.length]
    sum += c0 * r1 - c1 * r0   // Shoelace: x·y' − x'·y  (x=col, y=row)
  }
  return Math.abs(sum) / 2
}

function classifyQuad(v: V2[]): string | null {
  if (v.length !== 4) return null
  const sides: V2[] = v.map((p, i) => {
    const n = v[(i+1) % 4]; return [n[0]-p[0], n[1]-p[1]]
  })
  const cross  = ([a,b]: V2, [c,d]: V2) => a*d - b*c
  const dot    = ([a,b]: V2, [c,d]: V2) => a*c + b*d
  const len2   = ([a,b]: V2) => a*a + b*b
  const p02    = cross(sides[0], sides[2]) === 0
  const p13    = cross(sides[1], sides[3]) === 0
  const ls     = sides.map(len2)
  const allEq  = ls[0]===ls[1] && ls[1]===ls[2] && ls[2]===ls[3]
  // Right angle at vertex i: the incoming and outgoing edges are perpendicular
  const allRight = [0,1,2,3].every(i => dot(sides[(i+3)%4], sides[i]) === 0)
  if (p02 && p13) {
    if (allEq && allRight) return 'hình vuông'
    if (allRight)          return 'hình chữ nhật'
    if (allEq)             return 'hình thoi'
    return 'hình bình hành'
  }
  if (p02 || p13) return 'hình thang'
  return null   // irregular quadrilateral
}

// Accept the detected shape for the target — a rhombus IS a parallelogram, etc.
function shapeMatchesTarget(detected: string | null, target: string): boolean {
  if (!detected) return false
  if (detected === target) return true
  if (target === 'hình bình hành') return detected === 'hình thoi'   // rhombus ⊂ parallelogram
  if (target === 'hình thoi')      return detected === 'hình vuông'   // square ⊂ rhombus
  return false
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function diffLabel(idx: number) { return ['Dễ', 'Trung bình', 'Khó'][idx] ?? 'Khó' }
function diffColor(idx: number) { return ['#3f7d2e', '#b07d3f', '#c0682a'][idx] ?? '#c0682a' }
const CONF = ['#f7c52d', '#5aa02e', '#e8643a', '#3aa0d8', '#fff']

// ── Shell ─────────────────────────────────────────────────────────────────────
export function FarmBuilderShell({ game }: ShellProps) {
  const items = game.items
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  const item = items[Math.min(state.problemIdx, items.length - 1)] ?? null
  const prob = useMemo(() => parseProblem(item), [item])
  const isAdv = ADVANCED.has(prob.shapeType)

  // Edge-mode derivation (memoised, skipped in vertex mode)
  const ed = useMemo(
    () => isAdv ? null : deriveEdge(state.hSet, state.vSet, prob),
    [isAdv, state.hSet, state.vSet, prob],
  )

  // Vertex-mode derivation
  const verts     = state.vertices
  const vtArea    = useMemo(() => shoelaceArea(verts),             [verts])
  const vtShape   = useMemo(() => classifyQuad(verts as V2[]),     [verts])
  const vtClosed  = verts.length === 4
  const vtAreaInt = vtArea % 1 === 0 ? vtArea : parseFloat(vtArea.toFixed(1))
  const vtSolved  = vtClosed && shapeMatchesTarget(vtShape, prob.shapeType) && Math.abs(vtArea - prob.value) < 0.01

  // Unified solved flag
  const solved    = isAdv ? vtSolved : (ed?.solved ?? false)
  const hasNext   = state.problemIdx < items.length - 1

  // ── Stars ────────────────────────────────────────────────────────────────────
  const starN = !solved ? 0 : isAdv ? 3 : edgeStars(prob, ed!.area, ed!.perimeter)
  const praise = starN === 3 ? 'Chuẩn xác tuyệt đối!' : starN === 2 ? 'Rất tốt!' : 'Hoàn thành!'

  // ── Status message ───────────────────────────────────────────────────────────
  const constraintUnit = prob.constraint === 'diện tích' ? 'ô vuông' : 'đoạn rào'
  let statusText = '', statusColor = '#5b6b3a', statusBg = '#f3f6e6', statusBorder = '#cfdca0'

  if (isAdv) {
    // Vertex mode feedback
    if (vtClosed && !solved) {
      const areaOk    = Math.abs(vtArea - prob.value) < 0.01
      const shapeOk   = shapeMatchesTarget(vtShape, prob.shapeType)
      if (!shapeOk) {
        const detected = vtShape ? `Bạn vẽ ${vtShape}` : 'Hình không hợp lệ'
        statusText = `${detected} — cần ${prob.shapeType}. Nhấn điểm để xóa và thử lại.`
        statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
      } else if (!areaOk) {
        const diff = prob.value - vtArea
        statusText = diff > 0
          ? `Diện tích còn thiếu ${diff} ô (${vtAreaInt} / ${prob.value}).`
          : `Diện tích thừa ${-diff} ô (${vtAreaInt} / ${prob.value}).`
        if (diff < 0) { statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a' }
      }
    }
  } else {
    // Edge mode feedback
    const { area, perimeter, boundaryCount, isRect, isSquare, bbW, bbH } = ed!
    const placedCount = state.hSet.size + state.vSet.size
    if (placedCount > 0 && !solved) {
      if (area === 0) {
        statusText = 'Hãy khép kín vòng rào để quây ô ruộng!'
        statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
      } else if (placedCount > boundaryCount) {
        statusText = 'Có các đoạn rào thừa bên trong — hãy dọn gọn lại.'
        statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
      } else if (!isRect) {
        statusText = 'Các góc cần vuông — hãy tạo hình chữ nhật!'
        statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
      } else if (prob.shapeType === 'hình vuông' && !isSquare) {
        statusText = `Hình chữ nhật ${bbW}×${bbH} — nhưng cần hình VUÔNG. Hãy làm chiều dài = chiều rộng!`
        statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
      } else if (prob.constraint === 'diện tích' && area !== prob.value) {
        const diff = prob.value - area
        statusText = diff > 0 ? `Thiếu ${diff} ô (${area}/${prob.value}).` : `Thừa ${-diff} ô (${area}/${prob.value}).`
        if (diff < 0) { statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a' }
      } else if (prob.constraint === 'chu vi' && perimeter !== prob.value) {
        const diff = prob.value - perimeter
        statusText = diff > 0 ? `Thiếu ${diff} đoạn rào (${perimeter}/${prob.value}).` : `Thừa ${-diff} đoạn (${perimeter}/${prob.value}).`
        if (diff < 0) { statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a' }
      }
    }
  }

  // Live display values for side panel
  const currentVal = isAdv
    ? vtAreaInt
    : (prob.constraint === 'diện tích' ? ed!.area : ed!.perimeter)
  const targetColor = currentVal === prob.value ? '#3f7d2e' : currentVal > prob.value ? '#c0682a' : '#7a5a33'

  // ── All-done ──────────────────────────────────────────────────────────────
  if (state.allDone) {
    return (
      <div className="fb"><style>{CSS}</style><div className="fb-sun"/>
        <div className="fb-done">
          <div style={{fontSize:64,lineHeight:1}}>🏆</div>
          <div className="fb-vi" style={{fontSize:22,fontWeight:900,color:'#4a6b2a'}}>Xuất sắc!</div>
          <div className="fb-vi" style={{fontSize:16,fontWeight:600,color:'#6a6a52'}}>
            Bạn đã hoàn thành cả {items.length} bài tập!
          </div>
          <button className="fb-btn-next" onClick={() => dispatch({type:'restart'})}>Chơi lại từ đầu</button>
        </div>
      </div>
    )
  }

  // ── Shape status chip (edge mode) ─────────────────────────────────────────
  const { isRect: eRect, isSquare: eSq, area: eArea, bbW: eBW, bbH: eBH } = ed ?? {}
  const edgeShapeClass = !ed || eArea === 0 ? 'empty'
    : (prob.shapeType === 'hình vuông' ? eSq : eRect) ? 'ok' : 'bad'
  const edgeShapeLabel = !ed || eArea === 0 ? '—'
    : (prob.shapeType === 'hình vuông' ? eSq : eRect)
      ? `✓ ${prob.shapeType}`
      : `✗ Chưa phải ${prob.shapeType}`

  // ── Vertex-mode status chip ───────────────────────────────────────────────
  const vtShapeClass = !vtClosed ? 'empty'
    : shapeMatchesTarget(vtShape, prob.shapeType) ? 'ok' : 'bad'
  const vtShapeLabel = !vtClosed
    ? `${verts.length}/4 đỉnh`
    : shapeMatchesTarget(vtShape, prob.shapeType)
      ? `✓ ${vtShape ?? prob.shapeType}`
      : `✗ ${vtShape ?? 'Tứ giác bất kỳ'}`

  return (
    <div className="fb"><style>{CSS}</style><div className="fb-sun"/>

      {/* ── Title + badge ── */}
      <div className="fb-title-block">
        <h1 className="fb-vi" style={{fontSize:26,fontWeight:900,color:'#4a6b2a',textShadow:'0 2px 0 #fff,0 4px 0 rgba(74,107,42,.2)',margin:0}}>
          Xây Dựng Trang Trại
        </h1>
        <div className="fb-problem-badge">
          <span className="fb-shape-tag">{prob.shapeType.toUpperCase()}</span>
          <span className="fb-constraint-tag">
            {prob.constraint === 'diện tích' ? '📐' : '📏'}&nbsp;
            {prob.constraint} = <b>{prob.value}</b> {constraintUnit}
          </span>
          {isAdv && <span className="fb-mode-tag">Chế độ đỉnh</span>}
          {items.length > 1 && (
            <span className="fb-diff-tag" style={{
              background: diffColor(state.problemIdx)+'22',
              color: diffColor(state.problemIdx),
              border: `2px solid ${diffColor(state.problemIdx)}44`,
            }}>
              {diffLabel(state.problemIdx)} · Bài {state.problemIdx+1}/{items.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Main: board + panel ── */}
      <div className="fb-main">

        {/* Board */}
        <div className="fb-board" style={{width:BOARD_W, height:BOARD_H}}>
          <div className="fb-grid"/>

          {/* ─── EDGE MODE content ─── */}
          {!isAdv && ed && (
            <>
              {ed.fieldCells.map(({key,left,top}) => (
                <div key={key} className="fb-soil" style={{position:'absolute',zIndex:2,left,top,width:CELL,height:CELL}}/>
              ))}
              {ed.hGhost.map(({key,x,y,r,c}) => (
                <div key={key} className="fb-ghost-h"
                  style={{position:'absolute',zIndex:5,cursor:'pointer',left:x,top:y-9,width:CELL,height:18}}
                  onClick={() => dispatch({type:'toggleH',r,c})}/>
              ))}
              {ed.vGhost.map(({key,x,y,r,c}) => (
                <div key={key} className="fb-ghost-v"
                  style={{position:'absolute',zIndex:5,cursor:'pointer',left:x-9,top:y,width:18,height:CELL}}
                  onClick={() => dispatch({type:'toggleV',r,c})}/>
              ))}
              {ed.hPlaced.map(({key,x,y,r,c}) => (
                <div key={key} className="fb-fence-h"
                  style={{position:'absolute',zIndex:6,cursor:'pointer',left:x,top:y-7,width:CELL,height:14}}
                  onClick={() => dispatch({type:'toggleH',r,c})}/>
              ))}
              {ed.vPlaced.map(({key,x,y,r,c}) => (
                <div key={key} className="fb-fence-v"
                  style={{position:'absolute',zIndex:6,cursor:'pointer',left:x-7,top:y,width:14,height:CELL}}
                  onClick={() => dispatch({type:'toggleV',r,c})}/>
              ))}
              {ed.posts.map(({key,left,top}) => (
                <div key={key} className="fb-post" style={{position:'absolute',zIndex:8,left,top,width:16,height:16}}/>
              ))}
            </>
          )}

          {/* ─── VERTEX MODE content (SVG overlay) ─── */}
          {isAdv && (
            <svg style={{position:'absolute',inset:0,width:BOARD_W,height:BOARD_H,zIndex:10,overflow:'visible'}}>
              {/* Polygon fill */}
              {vtClosed && (
                <polygon
                  points={verts.map(([r,c]) => `${px(c)},${py(r)}`).join(' ')}
                  fill="rgba(169,115,47,0.38)"
                  stroke="none"
                />
              )}
              {/* Lines between vertices */}
              {verts.map(([r,c], i) => {
                const showLine = vtClosed || i < verts.length - 1
                if (!showLine) return null
                const [nr, nc] = verts[(i+1) % verts.length]
                return (
                  <line key={`ln${i}`}
                    x1={px(c)} y1={py(r)} x2={px(nc)} y2={py(nr)}
                    stroke="#c89154" strokeWidth={6} strokeLinecap="round"
                  />
                )
              })}
              {/* All grid corner posts (clickable) */}
              {Array.from({length: ROWS+1}, (_, r) =>
                Array.from({length: COLS+1}, (_, c) => {
                  const vIdx = verts.findIndex(([vr,vc]) => vr===r && vc===c)
                  const isV  = vIdx >= 0
                  return (
                    <g key={`pt${r}_${c}`} style={{cursor:'pointer'}}
                       onClick={() => dispatch({type:'toggleVertex',r,c})}>
                      {/* Large hit zone */}
                      <circle cx={px(c)} cy={py(r)} r={14} fill="transparent"/>
                      {/* Visible dot */}
                      <circle cx={px(c)} cy={py(r)}
                        r={isV ? 8 : 4}
                        fill={isV ? '#bb863f' : 'rgba(94,60,30,0.22)'}
                        stroke={isV ? '#5e3c1e' : 'rgba(94,60,30,0.35)'}
                        strokeWidth={isV ? 2 : 1}
                      />
                      {/* Vertex number */}
                      {isV && (
                        <text x={px(c)} y={py(r)-12}
                          textAnchor="middle" fontSize={12}
                          fontFamily="'Baloo 2',sans-serif" fontWeight="bold"
                          fill="#4a3010">{vIdx+1}</text>
                      )}
                    </g>
                  )
                })
              )}
            </svg>
          )}

          {/* Win overlay (both modes) */}
          {solved && (
            <div className="fb-win-overlay">
              {Array.from({length:14},(_,i) => (
                <div key={`cf${i}`} style={{
                  position:'absolute',zIndex:19,
                  left:8+(i*37)%540, top:-20, width:11, height:11,
                  background:CONF[i%5], borderRadius:2,
                  animation:`fb-fall ${1.4+(i%4)*0.3}s ${(i%6)*0.12}s ease-in forwards`,
                }}/>
              ))}
              <div className="fb-win-card">
                <div className="fb-stars">
                  {[0,1,2].map(i => (
                    <span key={i} style={{
                      fontSize:40, lineHeight:1, display:'inline-block',
                      color: i < starN ? '#f7c52d' : '#dfd3b0',
                      animation: i < starN ? `fb-twinkle 1.2s ${i*0.15}s ease-in-out infinite` : 'none',
                    }}>★</span>
                  ))}
                </div>
                <div className="fb-vi" style={{fontSize:17,fontWeight:900,color:'#4a6b2a'}}>{praise}</div>
                {isAdv ? (
                  <div style={{fontSize:14,fontWeight:700,color:'#7a6a4a',marginTop:6}}>
                    {vtShape} · Diện tích: {vtAreaInt} ô vuông
                  </div>
                ) : (
                  <div style={{fontSize:14,fontWeight:700,color:'#7a6a4a',marginTop:6}}>
                    {eBW}×{eBH} = {eArea} ô · Chu vi: {ed!.perimeter} đoạn
                  </div>
                )}
                {prob.explanation && (
                  <div className="fb-explanation">{prob.explanation}</div>
                )}
                <div className="fb-win-btns">
                  <button className="fb-btn-again" onClick={() => dispatch({type:'clear'})}>Vẽ lại</button>
                  {hasNext && (
                    <button className="fb-btn-next" onClick={() => dispatch({type:'next',total:items.length})}>
                      Bài tiếp →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        <div className="fb-panel">

          {/* Mission */}
          <div className="fb-mission">
            <div className="fb-label">YÊU CẦU</div>
            <div className="fb-shape-display">
              <div className={`fb-shape-icon ${prob.shapeType === 'hình vuông' ? 'square' : isAdv ? 'para' : 'rect'}`}/>
              <div>
                <div className="fb-vi" style={{fontSize:15,fontWeight:800,color:'#4a6b2a'}}>{prob.shapeType}</div>
                <div className="fb-vi" style={{fontSize:17,fontWeight:700,color:'#5a5a3c',marginTop:3}}>
                  {prob.constraint} = <b style={{color:'#c0682a'}}>{prob.value}</b> {constraintUnit}
                </div>
              </div>
            </div>
          </div>

          {/* Live stat */}
          <div className="fb-stat-solo">
            <div className="fb-label">{prob.constraint === 'diện tích' ? 'DIỆN TÍCH' : 'CHU VI'}</div>
            <div className="fb-stat-val" style={{color:targetColor}}>
              {currentVal}<span style={{fontSize:13,color:'#bbb'}}>/{prob.value}</span>
            </div>
            <div className="fb-stat-unit">{constraintUnit}</div>
          </div>

          {/* Dimensions (edge mode only) */}
          {!isAdv && (
            <div className="fb-stat-solo" style={{padding:'8px 12px'}}>
              <div className="fb-label">KÍCH THƯỚC</div>
              <div className="fb-vi" style={{fontSize:16,fontWeight:700,color:'#7a5a33',textAlign:'center',paddingTop:4}}>
                {eArea && eArea > 0 && eRect ? `${eBW}×${eBH}` : '—'}
              </div>
              <div className="fb-stat-unit">rộng × cao</div>
            </div>
          )}

          {/* Shape status chip */}
          <div className={`fb-shape-status ${isAdv ? vtShapeClass : edgeShapeClass}`}>
            {isAdv ? vtShapeLabel : edgeShapeLabel}
          </div>

          {/* Dynamic feedback */}
          {statusText && (
            <div className="fb-status" style={{background:statusBg,borderColor:statusBorder,color:statusColor}}>
              {statusText}
            </div>
          )}

          {/* Hint from AI */}
          {prob.hint && <div className="fb-hint-box">{prob.hint}</div>}

          {/* Mode tip */}
          {isAdv && (
            <div className="fb-mode-tip">
              💡 Nhấp vào <b>điểm góc</b> để đặt đỉnh (tối đa 4). Nhấp lại để xóa từ đỉnh đó.
            </div>
          )}

          <button className="fb-clear-btn" onClick={() => dispatch({type:'clear'})}>
            {isAdv ? 'Xóa các điểm' : 'Xóa hàng rào'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800;900&display=swap');

@keyframes fb-pop     {0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);}100%{transform:scale(1);opacity:1;}}
@keyframes fb-twinkle {0%,100%{transform:scale(1) rotate(0);}50%{transform:scale(1.25) rotate(8deg);}}
@keyframes fb-fall    {0%{transform:translateY(-20px) rotate(0);opacity:1;}100%{transform:translateY(360px) rotate(220deg);opacity:0;}}
@keyframes fb-bob     {0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}

.fb{min-height:100%;width:100%;display:flex;flex-direction:column;align-items:center;gap:18px;
  padding:28px 20px 48px;font-family:'Baloo 2',system-ui,sans-serif;
  background:linear-gradient(180deg,#bfe6f2 0%,#dcefcb 52%,#bfe08f 100%);
  position:relative;overflow-x:auto;box-sizing:border-box;}
.fb *,.fb *::before,.fb *::after{box-sizing:border-box;}
.fb-vi{font-family:'Baloo 2',system-ui,sans-serif;}

.fb-sun{position:absolute;top:24px;right:48px;width:64px;height:64px;border-radius:50%;
  background:radial-gradient(circle at 38% 36%,#ffe98a,#ffd23f 60%,#f6b32b);
  box-shadow:0 0 0 6px rgba(255,221,99,.35),0 0 34px rgba(255,200,60,.45);
  animation:fb-bob 4s ease-in-out infinite;pointer-events:none;}

.fb-title-block{text-align:center;z-index:1;position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;}
.fb-problem-badge{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;}
.fb-shape-tag{font-family:'Baloo 2',sans-serif;font-size:11px;font-weight:900;letter-spacing:1.5px;
  padding:5px 14px;background:#4a6b2a;color:#fff;border-radius:20px;}
.fb-constraint-tag{font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:700;color:#4a6b2a;
  background:#fff;border:3px solid #7a5a33;border-radius:20px;padding:5px 16px;}
.fb-mode-tag{font-family:'Baloo 2',sans-serif;font-size:11px;font-weight:800;letter-spacing:1px;
  padding:4px 12px;background:#6a3aa2;color:#fff;border-radius:20px;}
.fb-diff-tag{font-family:'Baloo 2',sans-serif;font-size:12px;font-weight:800;border-radius:20px;padding:4px 12px;}

.fb-done{margin:auto;display:flex;flex-direction:column;align-items:center;gap:16px;
  background:#fff7e6;border:5px solid #7a5a33;border-radius:20px;padding:40px 50px;
  text-align:center;box-shadow:0 10px 0 rgba(90,68,34,.35);z-index:1;}

/* Main layout always side-by-side */
.fb-main{display:flex;flex-wrap:nowrap;gap:22px;align-items:flex-start;justify-content:center;
  z-index:1;width:100%;min-width:${BOARD_W + 22 + 272}px;}

/* Board */
.fb-board{position:relative;background:#9ec862;border:6px solid #7a5a33;border-radius:10px;
  box-shadow:0 10px 0 rgba(90,68,34,.45),0 14px 30px rgba(0,0,0,.2);overflow:visible;flex:0 0 auto;}
.fb-grid{position:absolute;z-index:1;left:22px;top:22px;width:522px;height:406px;
  background-image:
    repeating-linear-gradient(to right,rgba(60,80,30,.16) 0 1px,transparent 1px 58px),
    repeating-linear-gradient(to bottom,rgba(60,80,30,.16) 0 1px,transparent 1px 58px);
  box-shadow:0 0 0 2px rgba(60,80,30,.22);pointer-events:none;}
.fb-soil{background-color:#a9732f;
  background-image:
    radial-gradient(circle at 30% 32%,#7bb43e 2.6px,transparent 3px),
    radial-gradient(circle at 70% 68%,#7bb43e 2.6px,transparent 3px),
    repeating-linear-gradient(0deg,rgba(0,0,0,.10) 0 12px,rgba(255,255,255,.05) 12px 15px);
  box-shadow:inset 0 0 0 1px rgba(94,60,30,.18);}
.fb-ghost-h:hover,.fb-ghost-v:hover{background:rgba(187,134,63,.5)!important;border-radius:3px;}
.fb-fence-h{background:linear-gradient(#e3c184,#c89154 45%,#9d6730);
  box-shadow:inset 0 2px 0 rgba(255,255,255,.4),inset 0 -3px 0 rgba(94,60,30,.55),0 0 0 1px #5e3c1e;}
.fb-fence-h:hover{filter:brightness(1.12);}
.fb-fence-v{background:linear-gradient(to right,#e3c184,#c89154 45%,#9d6730);
  box-shadow:inset 2px 0 0 rgba(255,255,255,.4),inset -3px 0 0 rgba(94,60,30,.55),0 0 0 1px #5e3c1e;}
.fb-fence-v:hover{filter:brightness(1.12);}
.fb-post{border-radius:3px;background:#bb863f;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.45),inset 0 -3px 0 rgba(94,60,30,.6),0 0 0 1px #5e3c1e;pointer-events:none;}

/* Win overlay */
.fb-win-overlay{position:absolute;z-index:20;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(40,55,20,.4);}
.fb-win-card{position:relative;background:#fff7e6;border:5px solid #7a5a33;border-radius:16px;
  padding:24px 32px 28px;text-align:center;box-shadow:0 10px 0 rgba(90,68,34,.4);
  animation:fb-pop .5s ease-out;max-width:380px;}
.fb-stars{display:flex;gap:8px;justify-content:center;margin-bottom:8px;}
.fb-explanation{font-family:'Baloo 2',sans-serif;font-size:13px;color:#7a6a4a;margin-top:8px;
  line-height:1.4;padding:8px 10px;background:rgba(74,107,42,.08);border-radius:8px;}
.fb-win-btns{display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap;}
.fb-btn-again{font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:800;color:#7a5a33;
  background:#f0e2c4;border:none;border-bottom:4px solid #c9b48a;border-radius:12px;
  padding:9px 18px;cursor:pointer;}
.fb-btn-again:active{transform:translateY(2px);border-bottom-width:1px;}
.fb-btn-next{font-family:'Baloo 2',sans-serif;font-size:15px;font-weight:800;color:#fff;
  background:#5aa02e;border:none;border-bottom:4px solid #3f7320;border-radius:12px;
  padding:9px 18px;cursor:pointer;}
.fb-btn-next:active{transform:translateY(2px);border-bottom-width:1px;}

/* Panel */
.fb-panel{display:flex;flex-direction:column;gap:12px;width:272px;flex:0 0 272px;}
.fb-label{font-family:'Baloo 2',sans-serif;font-size:11px;font-weight:900;letter-spacing:2px;color:#b07d3f;margin-bottom:6px;}

.fb-mission{background:#fffaf0;border:4px solid #7a5a33;border-radius:14px;
  padding:13px 15px;box-shadow:0 6px 0 rgba(90,68,34,.3);}
.fb-shape-display{display:flex;gap:13px;align-items:center;}
.fb-shape-icon{border:3px solid #7a5a33;background:#f5e8c8;flex:0 0 auto;}
.fb-shape-icon.square{width:40px;height:40px;}
.fb-shape-icon.rect  {width:56px;height:36px;}
/* Parallelogram icon via CSS skew */
.fb-shape-icon.para  {width:56px;height:36px;transform:skewX(-20deg);transform-origin:bottom left;}

.fb-stat-solo{background:#fff;border:4px solid #7a5a33;border-radius:14px;
  padding:10px 12px 8px;text-align:center;box-shadow:0 6px 0 rgba(90,68,34,.3);}
.fb-stat-val{font-family:'Baloo 2',sans-serif;font-size:26px;font-weight:900;margin-top:4px;line-height:1;}
.fb-stat-unit{font-family:'Baloo 2',sans-serif;font-size:11px;font-weight:600;color:#8a8a6a;margin-top:4px;}

.fb-shape-status{font-family:'Baloo 2',sans-serif;font-size:14px;font-weight:800;
  border-radius:10px;padding:9px 12px;text-align:center;letter-spacing:.3px;}
.fb-shape-status.empty{background:#f0eee6;color:#aaa;border:2px solid #ddd;}
.fb-shape-status.ok   {background:#eaf6e1;color:#3f7d2e;border:2px solid #a8d06a;}
.fb-shape-status.bad  {background:#fdeede;color:#c0682a;border:2px solid #f0b07a;}

.fb-status{font-family:'Baloo 2',sans-serif;border:3px solid;border-radius:12px;
  padding:10px 13px;font-size:14px;font-weight:700;line-height:1.35;}

.fb-hint-box{font-family:'Baloo 2',sans-serif;background:#e8f4e0;border:2px solid #a8d06a;
  border-radius:10px;padding:10px 13px;font-size:14px;font-weight:600;color:#3d6b1e;line-height:1.4;}

.fb-mode-tip{font-family:'Baloo 2',sans-serif;background:#f0eaf8;border:2px solid #c4a0e8;
  border-radius:10px;padding:10px 13px;font-size:13px;font-weight:600;color:#6a3aa2;line-height:1.4;}

.fb-clear-btn{font-family:'Baloo 2',sans-serif;font-size:16px;font-weight:800;color:#7a5a33;
  background:#f0e2c4;border:none;border-bottom:5px solid #c9b48a;border-radius:12px;
  padding:10px 0;cursor:pointer;width:100%;margin-top:auto;}
.fb-clear-btn:hover{background:#e8d4b0;}
.fb-clear-btn:active{transform:translateY(2px);border-bottom-width:2px;}

@media (prefers-reduced-motion:reduce){.fb-sun,[class*="twinkle"]{animation:none!important;}}
`
