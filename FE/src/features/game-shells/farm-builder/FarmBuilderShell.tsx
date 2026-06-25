'use client'

import { useMemo, useReducer } from 'react'
import type { ShellProps } from '../registry'

// ── Grid constants ────────────────────────────────────────────────────────────
const COLS = 9, ROWS = 7, CELL = 58, PAD = 22
const BOARD_W = 566, BOARD_H = 450

// ── State ─────────────────────────────────────────────────────────────────────
interface FBState {
  hSet: Set<string>
  vSet: Set<string>
  challengeIdx: number
  allDone: boolean
}

type FBAction =
  | { type: 'toggleH'; r: number; c: number }
  | { type: 'toggleV'; r: number; c: number }
  | { type: 'clear' }
  | { type: 'next'; total: number }
  | { type: 'restart' }

function initState(): FBState {
  return { hSet: new Set(), vSet: new Set(), challengeIdx: 0, allDone: false }
}

function reducer(state: FBState, action: FBAction): FBState {
  switch (action.type) {
    case 'toggleH': {
      const k = `${action.r}:${action.c}`
      const next = new Set(state.hSet)
      next.has(k) ? next.delete(k) : next.add(k)
      return { ...state, hSet: next }
    }
    case 'toggleV': {
      const k = `${action.r}:${action.c}`
      const next = new Set(state.vSet)
      next.has(k) ? next.delete(k) : next.add(k)
      return { ...state, vSet: next }
    }
    case 'clear':
      return { ...state, hSet: new Set(), vSet: new Set() }
    case 'next': {
      const next = state.challengeIdx + 1
      return { hSet: new Set(), vSet: new Set(), challengeIdx: next, allDone: next >= action.total }
    }
    case 'restart':
      return initState()
  }
}

// ── Pure game logic ───────────────────────────────────────────────────────────
interface EdgeItem { key: string; x: number; y: number; r: number; c: number }
interface PostItem { key: string; left: number; top: number }
interface CellItem { key: string; left: number; top: number }

interface GameDerived {
  fieldCells: CellItem[]
  hGhost: EdgeItem[]
  hPlaced: EdgeItem[]
  vGhost: EdgeItem[]
  vPlaced: EdgeItem[]
  posts: PostItem[]
  area: number
  perimeter: number
  boundaryCount: number
  solved: boolean
  minPerimeter: number
}

function deriveAll(hSet: Set<string>, vSet: Set<string>, target: number): GameDerived {
  const hH = (r: number, c: number) => hSet.has(`${r}:${c}`)
  const vH = (r: number, c: number) => vSet.has(`${r}:${c}`)

  // Flood fill from outside to mark non-enclosed cells
  const outside: boolean[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(false))
  const q: [number, number][] = []
  const seed = (r: number, c: number) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !outside[r][c]) {
      outside[r][c] = true
      q.push([r, c])
    }
  }
  // Seed cells reachable from each board edge (no fence blocking)
  for (let c = 0; c < COLS; c++) {
    if (!hH(0, c)) seed(0, c)
    if (!hH(ROWS, c)) seed(ROWS - 1, c)
  }
  for (let r = 0; r < ROWS; r++) {
    if (!vH(r, 0)) seed(r, 0)
    if (!vH(r, COLS)) seed(r, COLS - 1)
  }
  while (q.length) {
    const [r, c] = q.pop()!
    if (r > 0 && !hH(r, c)) seed(r - 1, c)
    if (r < ROWS - 1 && !hH(r + 1, c)) seed(r + 1, c)
    if (c > 0 && !vH(r, c)) seed(r, c - 1)
    if (c < COLS - 1 && !vH(r, c + 1)) seed(r, c + 1)
  }
  const inside = (r: number, c: number) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && !outside[r][c]

  // Count enclosed cells and find boundary fences
  let area = 0
  const bH = new Set<string>(), bV = new Set<string>()
  const fieldCells: CellItem[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!inside(r, c)) continue
      area++
      fieldCells.push({ key: `f${r}_${c}`, left: PAD + c * CELL, top: PAD + r * CELL })
      if (!inside(r - 1, c)) bH.add(`${r}:${c}`)
      if (!inside(r + 1, c)) bH.add(`${r + 1}:${c}`)
      if (!inside(r, c - 1)) bV.add(`${r}:${c}`)
      if (!inside(r, c + 1)) bV.add(`${r}:${c + 1}`)
    }
  }

  const perimeter = hSet.size + vSet.size
  const boundaryCount = bH.size + bV.size
  const tidy = boundaryCount > 0 && perimeter === boundaryCount
  const solved = area === target && tidy

  // Min perimeter: closest-to-square rectangle with this area
  const sr = Math.floor(Math.sqrt(target))
  const minPerimeter = 2 * (sr + Math.ceil(target / sr))

  // Horizontal fences (hit areas and rails)
  const hGhost: EdgeItem[] = [], hPlaced: EdgeItem[] = []
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const entry: EdgeItem = { key: `h${r}_${c}`, x: PAD + c * CELL, y: PAD + r * CELL, r, c }
      ;(hSet.has(`${r}:${c}`) ? hPlaced : hGhost).push(entry)
    }
  }

  // Vertical fences
  const vGhost: EdgeItem[] = [], vPlaced: EdgeItem[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const entry: EdgeItem = { key: `v${r}_${c}`, x: PAD + c * CELL, y: PAD + r * CELL, r, c }
      ;(vSet.has(`${r}:${c}`) ? vPlaced : vGhost).push(entry)
    }
  }

  // Posts at intersections of placed fences
  const pset = new Set<string>()
  hSet.forEach(k => {
    const [r, c] = k.split(':').map(Number)
    pset.add(`${r}:${c}`); pset.add(`${r}:${c + 1}`)
  })
  vSet.forEach(k => {
    const [r, c] = k.split(':').map(Number)
    pset.add(`${r}:${c}`); pset.add(`${r + 1}:${c}`)
  })
  const posts: PostItem[] = [...pset].map(k => {
    const [r, c] = k.split(':').map(Number)
    return { key: `p${k}`, left: PAD + c * CELL - 8, top: PAD + r * CELL - 8 }
  })

  return { fieldCells, hGhost, hPlaced, vGhost, vPlaced, posts, area, perimeter, boundaryCount, solved, minPerimeter }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function FarmBuilderShell({ game }: ShellProps) {
  const items = game.items
  const [state, dispatch] = useReducer(reducer, undefined, initState)

  const item = items[Math.min(state.challengeIdx, items.length - 1)]
  const target = item ? (parseInt(item.correctAnswer, 10) || 12) : 12

  const d = useMemo(
    () => deriveAll(state.hSet, state.vSet, target),
    [state.hSet, state.vSet, target],
  )

  if (state.allDone) {
    return (
      <div className="fb">
        <style>{CSS}</style>
        <div className="fb-sun" />
        <div className="fb-done">
          <div className="fb-done-icon">🏆</div>
          <div className="fb-done-title">Xuất sắc!</div>
          <div className="fb-done-sub">Bạn đã hoàn thành tất cả {items.length} thử thách!</div>
          <button className="fb-btn-next" onClick={() => dispatch({ type: 'restart' })}>
            Chơi lại từ đầu
          </button>
        </div>
      </div>
    )
  }

  // Status hint
  const { area, perimeter, boundaryCount, solved, minPerimeter } = d
  const placedCount = state.hSet.size + state.vSet.size
  let statusText = '', statusColor = '#5b6b3a', statusBg = '#f3f6e6', statusBorder = '#cfdca0'
  if (placedCount === 0) {
    statusText = 'Nhấp vào cạnh giữa hai cột để đặt hàng rào.'
  } else if (area === 0) {
    statusText = 'Hãy khép kín vòng rào để quây ô ruộng!'
    statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
  } else if (placedCount > boundaryCount) {
    statusText = 'Dọn gọn lại — có các đoạn rào thừa bên trong.'
    statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
  } else if (area < target) {
    statusText = `Cần thêm ${target - area} ô vuông nữa — hãy mở rộng thêm!`
    statusColor = '#3f7d2e'
  } else if (area > target) {
    statusText = `Quá lớn hơn ${area - target} ô vuông — hãy thu nhỏ lại.`
    statusColor = '#c0682a'; statusBg = '#fdeede'; statusBorder = '#f0c79a'
  } else {
    statusText = 'Hoàn hảo! Ô ruộng hoàn thành.'
    statusColor = '#3f7d2e'
  }

  const areaColor = area === target ? '#3f7d2e' : area > target ? '#c0682a' : '#7a5a33'

  // Win state
  const starN = !solved ? 0 : perimeter <= minPerimeter ? 3 : perimeter <= minPerimeter + 2 ? 2 : 1
  const praise = !solved ? '' : starN === 3 ? 'Nhà Nông Vô Địch!' : starN === 2 ? 'Canh tác xuất sắc!' : 'Ô ruộng hoàn thành!'
  const winSub = !solved ? '' : perimeter <= minPerimeter
    ? `Chỉ ${perimeter} đoạn rào — đây là cách gọn nhất có thể!`
    : `Bạn dùng ${perimeter} đoạn. Cần ít nhất ${minPerimeter} là đủ.`

  const hasNext = state.challengeIdx < items.length - 1
  const CONF_COLORS = ['#f7c52d', '#5aa02e', '#e8643a', '#3aa0d8', '#fff']

  return (
    <div className="fb">
      <style>{CSS}</style>

      <div className="fb-sun" />

      {/* Title */}
      <div className="fb-title-block">
        <h1 className="fb-h1">Xây Dựng Trang Trại</h1>
        <p className="fb-sub">
          Đặt hàng rào để quây đúng{' '}
          <b style={{ color: '#c0682a' }}>{target} ô vuông</b>.
        </p>
        {items.length > 1 && (
          <div className="fb-badge">
            Thử thách {state.challengeIdx + 1} / {items.length}
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="fb-main">

        {/* Board */}
        <div className="fb-board" style={{ width: BOARD_W, height: BOARD_H }}>
          <div className="fb-grid" />

          {/* Enclosed soil cells */}
          {d.fieldCells.map(({ key, left, top }) => (
            <div
              key={key}
              className="fb-soil"
              style={{ position: 'absolute', zIndex: 2, left, top, width: CELL, height: CELL }}
            />
          ))}

          {/* Ghost horizontal hit zones */}
          {d.hGhost.map(({ key, x, y, r, c }) => (
            <div
              key={key}
              className="fb-ghost-h"
              style={{ position: 'absolute', zIndex: 5, cursor: 'pointer', background: 'transparent', left: x, top: y - 9, width: CELL, height: 18 }}
              onClick={() => dispatch({ type: 'toggleH', r, c })}
            />
          ))}

          {/* Ghost vertical hit zones */}
          {d.vGhost.map(({ key, x, y, r, c }) => (
            <div
              key={key}
              className="fb-ghost-v"
              style={{ position: 'absolute', zIndex: 5, cursor: 'pointer', background: 'transparent', left: x - 9, top: y, width: 18, height: CELL }}
              onClick={() => dispatch({ type: 'toggleV', r, c })}
            />
          ))}

          {/* Placed horizontal fence rails */}
          {d.hPlaced.map(({ key, x, y, r, c }) => (
            <div
              key={key}
              className="fb-fence-h"
              style={{ position: 'absolute', zIndex: 6, cursor: 'pointer', left: x, top: y - 7, width: CELL, height: 14 }}
              onClick={() => dispatch({ type: 'toggleH', r, c })}
            />
          ))}

          {/* Placed vertical fence rails */}
          {d.vPlaced.map(({ key, x, y, r, c }) => (
            <div
              key={key}
              className="fb-fence-v"
              style={{ position: 'absolute', zIndex: 6, cursor: 'pointer', left: x - 7, top: y, width: 14, height: CELL }}
              onClick={() => dispatch({ type: 'toggleV', r, c })}
            />
          ))}

          {/* Posts at fence junctions */}
          {d.posts.map(({ key, left, top }) => (
            <div
              key={key}
              className="fb-post"
              style={{ position: 'absolute', zIndex: 8, left, top, width: 16, height: 16 }}
            />
          ))}

          {/* Win overlay */}
          {solved && (
            <div className="fb-win-overlay">
              {Array.from({ length: 14 }, (_, i) => (
                <div
                  key={`cf${i}`}
                  style={{
                    position: 'absolute', zIndex: 19,
                    left: 8 + (i * 37) % 540, top: -20, width: 11, height: 11,
                    background: CONF_COLORS[i % 5], borderRadius: 2,
                    animation: `fb-fall ${1.4 + (i % 4) * 0.3}s ${(i % 6) * 0.12}s ease-in forwards`,
                  }}
                />
              ))}
              <div className="fb-win-card">
                <div className="fb-stars">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      style={{
                        fontSize: 42, lineHeight: 1, display: 'inline-block',
                        color: i < starN ? '#f7c52d' : '#dfd3b0',
                        textShadow: '0 2px 0 rgba(150,110,20,.35)',
                        animation: i < starN ? `fb-twinkle 1.2s ${i * 0.15}s ease-in-out infinite` : 'none',
                      }}
                    >★</span>
                  ))}
                </div>
                <div className="fb-praise">{praise}</div>
                <div className="fb-win-sub">{winSub}</div>
                {item?.explanation && (
                  <div className="fb-explanation">{item.explanation}</div>
                )}
                <div className="fb-win-btns">
                  <button className="fb-btn-again" onClick={() => dispatch({ type: 'clear' })}>
                    Xây lại
                  </button>
                  {hasNext && (
                    <button className="fb-btn-next" onClick={() => dispatch({ type: 'next', total: items.length })}>
                      Thử thách tiếp →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="fb-panel">
          <div className="fb-mission">
            <div className="fb-mission-label">NHIỆM VỤ CỦA BẠN</div>
            <div className="fb-mission-text">
              Quây đúng <b>{target}</b> ô vuông.
            </div>
          </div>

          <div className="fb-stats">
            <div className="fb-stat">
              <div className="fb-stat-label">RUỘNG</div>
              <div className="fb-stat-val" style={{ color: areaColor }}>
                {area}<span style={{ fontSize: 13, color: '#bbb' }}>/{target}</span>
              </div>
              <div className="fb-stat-unit">ô vuông</div>
            </div>
            <div className="fb-stat">
              <div className="fb-stat-label">HÀNG RÀO</div>
              <div className="fb-stat-val" style={{ color: '#7a5a33' }}>{perimeter}</div>
              <div className="fb-stat-unit">đoạn</div>
            </div>
          </div>

          <div
            className="fb-status"
            style={{ background: statusBg, borderColor: statusBorder, color: statusColor }}
          >
            {statusText}
          </div>

          {item?.hint && (
            <div className="fb-hint-box">{item.hint}</div>
          )}

          <div className="fb-tip">
            Mẹo: Ô ruộng hình chữ nhật 3×4 cần ít hàng rào hơn hình dài 1×12 — cùng diện tích nhưng chu vi nhỏ hơn nhiều!
          </div>

          <button className="fb-clear-btn" onClick={() => dispatch({ type: 'clear' })}>
            Xóa hàng rào
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Scoped CSS (keyframes must be global; class names scoped under .fb) ───────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Press+Start+2P&display=swap');

@keyframes fb-pop{0%{transform:scale(.6);opacity:0;}60%{transform:scale(1.08);}100%{transform:scale(1);opacity:1;}}
@keyframes fb-twinkle{0%,100%{transform:scale(1) rotate(0);}50%{transform:scale(1.25) rotate(8deg);}}
@keyframes fb-fall{0%{transform:translateY(-20px) rotate(0);opacity:1;}100%{transform:translateY(360px) rotate(220deg);opacity:0;}}
@keyframes fb-bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}

.fb {
  min-height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 34px 20px 48px;
  font-family: 'Baloo 2', system-ui, sans-serif;
  background: linear-gradient(180deg, #bfe6f2 0%, #dcefcb 52%, #bfe08f 100%);
  position: relative;
  overflow-x: hidden;
  box-sizing: border-box;
}
.fb *, .fb *::before, .fb *::after { box-sizing: border-box; }

/* Sun decoration */
.fb-sun {
  position: absolute; top: 30px; right: 54px;
  width: 74px; height: 74px; border-radius: 50%;
  background: radial-gradient(circle at 38% 36%, #ffe98a, #ffd23f 60%, #f6b32b);
  box-shadow: 0 0 0 6px rgba(255,221,99,.35), 0 0 34px rgba(255,200,60,.45);
  animation: fb-bob 4s ease-in-out infinite;
  pointer-events: none;
}

/* Title */
.fb-title-block { text-align: center; z-index: 1; position: relative; }
.fb-h1 {
  margin: 0; font-family: 'Press Start 2P', monospace; font-size: 24px; line-height: 1.4;
  color: #4a6b2a; text-shadow: 0 2px 0 #fff, 0 4px 0 rgba(74,107,42,.25);
}
.fb-sub { margin: 12px 0 0; font-size: 18px; font-weight: 600; color: #5a6b3c; }
.fb-badge {
  display: inline-block; margin-top: 8px; font-size: 13px; font-weight: 700;
  background: rgba(74,107,42,.15); color: #4a6b2a; border-radius: 20px; padding: 4px 14px;
}

/* All-done screen */
.fb-done {
  margin: auto; display: flex; flex-direction: column; align-items: center; gap: 16px;
  background: #fff7e6; border: 5px solid #7a5a33; border-radius: 20px; padding: 40px 50px;
  text-align: center; box-shadow: 0 10px 0 rgba(90,68,34,.35); z-index: 1;
}
.fb-done-icon { font-size: 64px; line-height: 1; }
.fb-done-title { font-family: 'Press Start 2P', monospace; font-size: 16px; color: #4a6b2a; }
.fb-done-sub { font-size: 17px; font-weight: 600; color: #6a6a52; }

/* Layout */
.fb-main { display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start; justify-content: center; z-index: 1; }

/* Board */
.fb-board {
  position: relative;
  background: #9ec862;
  border: 6px solid #7a5a33;
  border-radius: 10px;
  box-shadow: 0 10px 0 rgba(90,68,34,.45), 0 14px 30px rgba(0,0,0,.2);
  overflow: hidden;
  flex: 0 0 auto;
}
.fb-grid {
  position: absolute; z-index: 1; left: 22px; top: 22px; width: 522px; height: 406px;
  background-image:
    repeating-linear-gradient(to right, rgba(60,80,30,.16) 0 1px, transparent 1px 58px),
    repeating-linear-gradient(to bottom, rgba(60,80,30,.16) 0 1px, transparent 1px 58px);
  box-shadow: 0 0 0 2px rgba(60,80,30,.22);
  pointer-events: none;
}

/* Soil (enclosed cells) */
.fb-soil {
  background-color: #a9732f;
  background-image:
    radial-gradient(circle at 30% 32%, #7bb43e 2.6px, transparent 3px),
    radial-gradient(circle at 70% 68%, #7bb43e 2.6px, transparent 3px),
    repeating-linear-gradient(0deg, rgba(0,0,0,.10) 0 12px, rgba(255,255,255,.05) 12px 15px);
  box-shadow: inset 0 0 0 1px rgba(94,60,30,.18);
}

/* Fence hit areas */
.fb-ghost-h:hover { background: rgba(187,134,63,.5) !important; border-radius: 3px; }
.fb-ghost-v:hover { background: rgba(187,134,63,.5) !important; border-radius: 3px; }

/* Fence rails */
.fb-fence-h {
  background: linear-gradient(#e3c184, #c89154 45%, #9d6730);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.4), inset 0 -3px 0 rgba(94,60,30,.55), 0 0 0 1px #5e3c1e;
}
.fb-fence-h:hover { filter: brightness(1.12); }
.fb-fence-v {
  background: linear-gradient(to right, #e3c184, #c89154 45%, #9d6730);
  box-shadow: inset 2px 0 0 rgba(255,255,255,.4), inset -3px 0 0 rgba(94,60,30,.55), 0 0 0 1px #5e3c1e;
}
.fb-fence-v:hover { filter: brightness(1.12); }

/* Posts */
.fb-post {
  border-radius: 3px;
  background: #bb863f;
  box-shadow: inset 0 2px 0 rgba(255,255,255,.45), inset 0 -3px 0 rgba(94,60,30,.6), 0 0 0 1px #5e3c1e;
  pointer-events: none;
}

/* Win overlay */
.fb-win-overlay {
  position: absolute; z-index: 20; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(40,55,20,.4);
}
.fb-win-card {
  position: relative;
  background: #fff7e6; border: 5px solid #7a5a33; border-radius: 16px;
  padding: 26px 34px 30px; text-align: center;
  box-shadow: 0 10px 0 rgba(90,68,34,.4);
  animation: fb-pop .5s ease-out;
  max-width: 380px;
}
.fb-stars { display: flex; gap: 10px; justify-content: center; margin-bottom: 8px; }
.fb-praise {
  font-family: 'Press Start 2P', monospace; font-size: 14px; color: #4a6b2a; line-height: 1.5;
}
.fb-win-sub { font-size: 15px; font-weight: 600; color: #6a6a52; margin-top: 10px; }
.fb-explanation {
  font-size: 13px; color: #7a6a4a; margin-top: 8px; line-height: 1.4;
  padding: 8px 10px; background: rgba(74,107,42,.08); border-radius: 8px;
}
.fb-win-btns { display: flex; gap: 10px; justify-content: center; margin-top: 18px; flex-wrap: wrap; }
.fb-btn-again {
  font-family: 'Baloo 2', sans-serif; font-size: 16px; font-weight: 800; color: #7a5a33;
  background: #f0e2c4; border: none; border-bottom: 4px solid #c9b48a; border-radius: 12px;
  padding: 10px 20px; cursor: pointer;
}
.fb-btn-again:active { transform: translateY(2px); box-shadow: none; }
.fb-btn-next {
  font-family: 'Baloo 2', sans-serif; font-size: 16px; font-weight: 800; color: #fff;
  background: #5aa02e; border: none; border-bottom: 4px solid #3f7320; border-radius: 12px;
  padding: 10px 20px; cursor: pointer;
}
.fb-btn-next:active { transform: translateY(2px); box-shadow: none; }

/* Side panel */
.fb-panel { display: flex; flex-direction: column; gap: 16px; width: 286px; flex: 0 0 auto; }

.fb-mission {
  background: #fffaf0; border: 4px solid #7a5a33; border-radius: 14px;
  padding: 16px 18px; box-shadow: 0 6px 0 rgba(90,68,34,.3);
}
.fb-mission-label { font-size: 12px; font-weight: 800; letter-spacing: 2px; color: #b07d3f; }
.fb-mission-text { font-size: 20px; font-weight: 700; color: #4a6b2a; margin-top: 4px; line-height: 1.25; }

.fb-stats { display: flex; gap: 14px; }
.fb-stat {
  flex: 1; background: #fff; border: 4px solid #7a5a33; border-radius: 14px;
  padding: 12px 8px; text-align: center; box-shadow: 0 6px 0 rgba(90,68,34,.3);
}
.fb-stat-label { font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #b07d3f; }
.fb-stat-val { font-family: 'Press Start 2P', monospace; font-size: 20px; margin-top: 8px; }
.fb-stat-unit { font-size: 12px; font-weight: 600; color: #8a8a6a; margin-top: 5px; }

.fb-status {
  border: 3px solid; border-radius: 12px; padding: 13px 15px;
  font-size: 15px; font-weight: 700; line-height: 1.35; min-height: 54px;
  display: flex; align-items: center;
}

.fb-hint-box {
  background: #e8f4e0; border: 2px solid #a8d06a; border-radius: 10px;
  padding: 10px 13px; font-size: 14px; font-weight: 600; color: #3d6b1e; line-height: 1.4;
}

.fb-tip {
  font-size: 13px; font-weight: 600; color: #6a7a4a; line-height: 1.4; padding: 0 4px;
}

.fb-clear-btn {
  font-family: 'Baloo 2', sans-serif; font-size: 17px; font-weight: 800; color: #7a5a33;
  background: #f0e2c4; border: none; border-bottom: 5px solid #c9b48a; border-radius: 12px;
  padding: 11px 0; cursor: pointer; width: 100%;
}
.fb-clear-btn:hover { background: #e8d4b0; }
.fb-clear-btn:active { transform: translateY(2px); border-bottom-width: 2px; }

@media (max-width: 640px) {
  .fb-h1 { font-size: 18px; }
  .fb-panel { width: 100%; max-width: 566px; }
  .fb-sun { width: 50px; height: 50px; right: 16px; top: 16px; }
}

@media (prefers-reduced-motion: reduce) {
  .fb-sun, .fb-win-card, .fb-praise span { animation: none !important; }
}
`
