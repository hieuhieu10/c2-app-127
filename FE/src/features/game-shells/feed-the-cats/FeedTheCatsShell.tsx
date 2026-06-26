'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Game, GameItem } from '@/types/app'
import { createFeedCatsAudio, type Sfx } from './audio'

/**
 * Feed the Hungry Cats — a fully inline, native-React drag-to-sort game shell.
 *
 * Ported from the static design. Each fish-treat shows an expression/clue
 * (`GameItem.question`); the cats are derived by grouping items by their answer
 * (`GameItem.correctAnswer`) — every distinct answer becomes one hungry cat.
 * Drag a treat onto the cat whose label matches its answer to feed it; feed
 * every cat to win. The cat art is pure CSS, themed per-cat via CSS variables.
 */

// ── Types ──────────────────────────────────────────────────────────────────
interface CatLook { body: string; ear: string; name: string }
interface Cat {
  id: string
  target: string // label shown on the cat (the matching answer)
  name: string
  body: string
  ear: string
  need: number // treats this cat wants (= number of items with this answer)
  hunger: number
  full: boolean
  happy: boolean
  wrong: boolean
}
interface Food { id: string; value: string; expr: string; catId: string; placed: boolean }
interface Drag { food: Food; x: number; y: number; offX: number; offY: number }
interface GState { cats: Cat[]; foods: Food[]; score: number; won: boolean }

// CSS custom properties aren't in React.CSSProperties — allow `--*` keys.
type CSSVars = React.CSSProperties & { [key: `--${string}`]: string | number }

// Up to 6 distinct cat looks (backend caps the round at 5 cats; 6 is defensive).
const PALETTE: CatLook[] = [
  { body: '#EFA661', ear: '#F7C9A6', name: 'Pumpkin' },
  { body: '#AEB6BE', ear: '#E6C9D2', name: 'Pepper' },
  { body: '#F2DDB0', ear: '#F4C7A8', name: 'Biscuit' },
  { body: '#C9B6E4', ear: '#E7D7F2', name: 'Mochi' },
  { body: '#E59A6C', ear: '#F4C7A8', name: 'Ginger' },
  { body: '#CFE0E6', ear: '#DDEAEE', name: 'Cloud' },
]

// ── Pure helpers ───────────────────────────────────────────────────────────
function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

// Group items by answer → cats; each item → one treat for its cat. Treats shuffled.
function buildRound(items: GameItem[]): { cats: Cat[]; foods: Food[] } {
  const order: string[] = []
  const byAnswer = new Map<string, GameItem[]>()
  for (const it of items) {
    const ans = (it.correctAnswer ?? '').trim()
    const expr = (it.question ?? '').trim()
    if (!ans || !expr) continue
    if (!byAnswer.has(ans)) {
      byAnswer.set(ans, [])
      order.push(ans)
    }
    byAnswer.get(ans)!.push(it)
  }

  const cats: Cat[] = []
  let foods: Food[] = []
  order.slice(0, PALETTE.length).forEach((ans, i) => {
    const look = PALETTE[i % PALETTE.length]
    const id = 'cat' + i
    const treats = byAnswer.get(ans)!
    cats.push({
      id, target: ans, name: look.name, body: look.body, ear: look.ear,
      need: treats.length, hunger: 0, full: false, happy: false, wrong: false,
    })
    treats.forEach((t, j) => {
      foods.push({ id: `${id}-f${j}`, value: ans, expr: (t.question ?? '').trim(), catId: id, placed: false })
    })
  })
  foods = shuffle(foods)
  return { cats, foods }
}

// ── Fish-treat SVG (shared by the tray and the drag ghost) ──────────────────
function FishSvg() {
  return (
    <svg viewBox="0 0 138 104" fill="none">
      <g stroke="#1F1B18" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M42,48 C24,33 9,31 6,36 C12,45 13,50 23,54 C13,59 11,66 7,72 C13,77 26,74 42,62 Z" fill="#F2933F" />
        <path d="M72,20 C78,6 92,5 99,18 C90,19 82,20 72,24 Z" fill="#EE8A33" />
        <path d="M38,46 C48,20 84,13 108,18 C126,22 134,35 131,49 C129,63 114,74 92,75 C70,76 48,72 39,62 C33,55 32,52 38,46 Z" fill="#F2933F" />
        <g stroke="#C45F18" strokeWidth={3.5}>
          <path d="M72,27 l6,3" />
          <path d="M86,24 l6,3" />
          <path d="M99,26 l5,3" />
        </g>
        <path d="M115,32 L126,41 M126,32 L115,41" strokeWidth={4.5} />
        <path d="M129,48 C124,62 111,66 100,62" />
        <path d="M42,70 Q63,60 84,70 L63,98 Z" fill="#F2B83A" />
        <path d="M47,72 Q63,64 79,72 L63,93 Z" fill="#FBE271" stroke="none" />
        <g stroke="#D79A1E" strokeWidth={2}>
          <path d="M63,93 L49,72" />
          <path d="M63,93 L59,69" />
          <path d="M63,93 L68,69" />
          <path d="M63,93 L78,72" />
        </g>
        <path d="M42,70 Q63,60 84,70 L63,98 Z" fill="none" strokeWidth={4} />
      </g>
    </svg>
  )
}

function FishTreat({ food, onDown }: { food: Food; onDown: (f: Food, e: React.PointerEvent) => void }) {
  return (
    <div className="fhc-fish" onPointerDown={(e) => onDown(food, e)}>
      <FishSvg />
      <span className="expr">{food.expr}</span>
    </div>
  )
}

// ── Cat (pure CSS art; colours + blink/yawn stagger come from CSS variables) ──
function CatView({ cat, idx }: { cat: Cat; idx: number }) {
  const vars: CSSVars = { '--body': cat.body, '--ear': cat.ear, '--yd': `${idx * -3.05}s` }
  return (
    <div className="fhc-cat" data-cat-id={cat.id} style={vars}>
      <div className="fhc-yum-wrap">{cat.happy ? <div className="fhc-yum">★ Ngon!</div> : null}</div>
      <div className={`fhc-fx${cat.happy ? ' bounce' : cat.wrong ? ' shake' : ''}`}>
        <div className="fhc-catbox">
          <div className="fhc-tail" />
          <div className="fhc-body"><div className="fhc-belly" /></div>
          <div className="fhc-paw l" />
          <div className="fhc-paw r" />
          <div className="fhc-head">
            <div className="fhc-face">
              <div className="fhc-ear-lo" />
              <div className="fhc-ear-li" />
              <div className="fhc-ear-ro" />
              <div className="fhc-ear-ri" />
              <div className="fhc-stripe s1" />
              <div className="fhc-stripe s2" />
              <div className="fhc-stripe s3" />
              <div className="fhc-eye l"><span className="h1" /><span className="h2" /><span className="fhc-lid" /></div>
              <div className="fhc-eye r"><span className="h1" /><span className="h2" /><span className="fhc-lid" /></div>
              <div className="fhc-cheek l" />
              <div className="fhc-cheek r" />
              <div className="fhc-yawn"><span className="teeth" /><span className="tongue" /></div>
              <div className="fhc-nose" />
              <div className="fhc-mouth" />
              <div className="fhc-wh l1" />
              <div className="fhc-wh l2" />
              <div className="fhc-wh r1" />
              <div className="fhc-wh r2" />
            </div>
          </div>
        </div>
      </div>
      <div className="fhc-namerow">
        <span className="fhc-name">{cat.name}</span>
        <div className="fhc-pips">
          {Array.from({ length: cat.need }, (_, i) => (
            <div key={i} className={`fhc-pip${i < cat.hunger ? ' on' : ''}`} />
          ))}
        </div>
      </div>
      {cat.full ? (
        <div className="fhc-full">No nê ★</div>
      ) : (
        <div className="fhc-want">
          <div className="lbl">Mình muốn</div>
          <div className="tgt">{cat.target}</div>
        </div>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export function FeedTheCatsShell({ game }: { game: Game; previewMode?: boolean; scene?: string }) {
  const items = useMemo(() => game.items, [game.items])

  // Game state lives in a ref mirror so window pointer handlers read the latest.
  const buildState = (score: number): GState => ({ ...buildRound(items), score, won: false })
  const [G, setGState] = useState<GState>(() => buildState(0))
  const gRef = useRef(G)
  const setG = (next: GState) => { gRef.current = next; setGState(next) }

  const [drag, setDragState] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const setDrag = (d: Drag | null) => { dragRef.current = d; setDragState(d) }

  // Audio (synthesized SFX; lazily unlocked on first gesture).
  const audioRef = useRef<ReturnType<typeof createFeedCatsAudio> | null>(null)
  if (audioRef.current === null && typeof window !== 'undefined') audioRef.current = createFeedCatsAudio()
  const audio = audioRef.current
  const [muted, setMuted] = useState(false)
  const sfx = (n: Sfx) => audio?.play(n)
  const ensureAudio = () => audio?.unlock()

  const timers = useRef<Record<string, number>>({})
  useEffect(() => {
    const t = timers.current
    return () => { Object.values(t).forEach((id) => clearTimeout(id)); audioRef.current?.dispose() }
  }, [])

  // ── Mutations (read gRef, write via setG) ──
  const feed = (food: Food, cid: string) => {
    const s = gRef.current
    const foods = s.foods.map((f) => (f.id === food.id ? { ...f, placed: true } : f))
    const cats = s.cats.map((c) => {
      if (c.id !== cid) return c
      const hunger = c.hunger + 1
      return { ...c, hunger, full: hunger >= c.need, happy: true }
    })
    const won = foods.every((f) => f.placed)
    setG({ ...s, foods, cats, score: s.score + 1, won })
    sfx(won ? 'win' : 'feed')
    clearTimeout(timers.current['h_' + cid])
    timers.current['h_' + cid] = window.setTimeout(() => {
      const s2 = gRef.current
      setG({ ...s2, cats: s2.cats.map((c) => (c.id === cid ? { ...c, happy: false } : c)) })
    }, 950)
  }

  const flashWrong = (cid: string) => {
    sfx('wrong')
    const s = gRef.current
    setG({ ...s, cats: s.cats.map((c) => (c.id === cid ? { ...c, wrong: true } : c)) })
    clearTimeout(timers.current['w_' + cid])
    timers.current['w_' + cid] = window.setTimeout(() => {
      const s2 = gRef.current
      setG({ ...s2, cats: s2.cats.map((c) => (c.id === cid ? { ...c, wrong: false } : c)) })
    }, 480)
  }

  const resolveDrop = (food: Food, x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const zone = el && el.closest ? el.closest('[data-cat-id]') : null
    if (!zone) return // dropped on no cat → treat returns to the tray
    const cat = gRef.current.cats.find((c) => c.id === zone.getAttribute('data-cat-id'))
    if (!cat || cat.full) return
    if (food.value === cat.target) feed(food, cat.id)
    else flashWrong(cat.id)
  }

  // Global pointer drag — bound once; handlers read the refs so they never go stale.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (d) { e.preventDefault(); setDrag({ ...d, x: e.clientX, y: e.clientY }) }
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      if (d) { setDrag(null); resolveDrop(d.food, e.clientX, e.clientY) }
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Event handlers ──
  const onFoodDown = (food: Food, e: React.PointerEvent) => {
    e.preventDefault()
    ensureAudio()
    sfx('pickup')
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDrag({ food, x: e.clientX, y: e.clientY, offX: e.clientX - r.left, offY: e.clientY - r.top })
  }
  const newGame = () => { ensureAudio(); sfx('pickup'); setDrag(null); setG(buildState(0)) }
  const nextRound = () => { ensureAudio(); setDrag(null); setG(buildState(gRef.current.score)) }
  const toggleSound = () => {
    if (!audio) return
    const m = audio.toggleMuted()
    setMuted(m)
    if (!m) sfx('pickup')
  }

  // ── Derived render values ──
  const trayFoods = G.foods.filter((f) => !f.placed && (!drag || drag.food.id !== f.id))
  const trayEmpty = G.foods.every((f) => f.placed)

  if (G.cats.length === 0) {
    return (
      <div className="fhc">
        <style>{CSS}</style>
        <div className="fhc-empty">Chưa có miếng cá nào — hãy thêm câu hỏi để cho mèo ăn.</div>
      </div>
    )
  }

  return (
    <div className="fhc">
      <style>{CSS}</style>

      <div className="fhc-header">
        <div className="fhc-brand">
          <div className="fhc-logo"><div className="tri" /></div>
          <div>
            <div className="fhc-title">Cho Mèo Đói Ăn</div>
            <div className="fhc-sub">Kéo từng miếng cá tới chú mèo có số khớp với đáp án</div>
          </div>
        </div>
        <div className="fhc-tools">
          <div className="fhc-score"><span className="fishdot" /><span>{G.score}</span></div>
          <button className="fhc-btn" onClick={toggleSound} title={muted ? 'Tắt âm' : 'Bật âm'}>
            <span className="note">♪</span>{muted ? 'Tắt âm' : 'Bật âm'}
          </button>
          <button className="fhc-btn primary" onClick={newGame}>Chơi mới</button>
        </div>
      </div>

      <div className="fhc-cats">
        {G.cats.map((c, i) => <CatView key={c.id} cat={c} idx={i} />)}
      </div>

      <div className="fhc-floor" />

      <div className="fhc-tray">
        <div className="fhc-tray-inner">
          <div className="fhc-tray-label">KHAY MIẾNG CÁ</div>
          <div className="fhc-tray-row">
            {trayFoods.map((f) => <FishTreat key={f.id} food={f} onDown={onFoodDown} />)}
            {trayEmpty ? <div className="fhc-tray-empty">Đã phục vụ hết!</div> : null}
          </div>
        </div>
      </div>

      {drag ? (
        <div className="fhc-ghost" style={{ left: drag.x - drag.offX, top: drag.y - drag.offY }}>
          <div className="inner"><FishSvg /><span className="expr">{drag.food.expr}</span></div>
        </div>
      ) : null}

      {G.won ? (
        <div className="fhc-win">
          <div className="star" style={{ left: '20%', top: '30%', fontSize: 30, color: '#F6C453' }}>★</div>
          <div className="star" style={{ left: '70%', top: '24%', fontSize: 24, color: '#5FB38F', animationDelay: '.3s' }}>★</div>
          <div className="star" style={{ left: '46%', top: '18%', fontSize: 20, color: '#EFA661', animationDelay: '.6s' }}>★</div>
          <div className="card">
            <h2>Mọi chú mèo đều no! ★</h2>
            <p>Ghép cặp tuyệt vời — các bé mèo đang kêu rừ rừ.</p>
            <button onClick={nextRound}>Cho thêm mèo ăn</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Scoped stylesheet (ported from the design, scoped under .fhc) ────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@600;700;800&display=swap');
.fhc { position:relative; overflow:hidden; border-radius:14px; min-height:560px; width:100%;
  font-family:'Nunito',sans-serif; color:#4A3B33; display:flex; flex-direction:column; align-items:center;
  background:radial-gradient(120% 80% at 50% -10%, #FFF6E6 0%, #FBEFD9 45%, #F6E6CB 100%); }
.fhc *, .fhc *::before, .fhc *::after { box-sizing:border-box; margin:0; padding:0; }
.fhc-empty { margin:auto; padding:2rem; font-weight:700; color:#9C8A78; text-align:center; }

@keyframes fhc-catIdle{ 0%,100%{ transform:translateY(0) rotate(0);} 50%{ transform:translateY(-5px) rotate(-1deg);} }
@keyframes fhc-catBounce{ 0%{ transform:translateY(0) scale(1);} 30%{ transform:translateY(-22px) scale(1.08,.94);} 55%{ transform:translateY(0) scale(.96,1.06);} 75%{ transform:translateY(-8px) scale(1.02,.98);} 100%{ transform:translateY(0) scale(1);} }
@keyframes fhc-catShake{ 0%,100%{ transform:translateX(0) rotate(0);} 20%{ transform:translateX(-7px) rotate(-3deg);} 40%{ transform:translateX(7px) rotate(3deg);} 60%{ transform:translateX(-5px) rotate(-2deg);} 80%{ transform:translateX(5px) rotate(2deg);} }
@keyframes fhc-popUp{ 0%{ transform:translateY(6px) scale(.4); opacity:0;} 30%{ transform:translateY(-4px) scale(1.1); opacity:1;} 80%{ transform:translateY(-14px) scale(1); opacity:1;} 100%{ transform:translateY(-26px) scale(.9); opacity:0;} }
@keyframes fhc-floatStar{ 0%{ transform:translateY(0) rotate(0); opacity:0;} 20%{ opacity:1;} 100%{ transform:translateY(-120px) rotate(60deg); opacity:0;} }
@keyframes fhc-tailSwish{ 0%,100%{ transform:rotate(8deg);} 50%{ transform:rotate(-12deg);} }
@keyframes fhc-lifeEyes{ 0%,22.5%{ transform:scaleY(0);} 24%{ transform:scaleY(1);} 26%{ transform:scaleY(0);} 51%{ transform:scaleY(0);} 52.5%{ transform:scaleY(1);} 54.5%{ transform:scaleY(0);} 78%{ transform:scaleY(0);} 82%{ transform:scaleY(1);} 90%{ transform:scaleY(1);} 93.5%{ transform:scaleY(0);} 100%{ transform:scaleY(0);} }
@keyframes fhc-lifeMouth{ 0%,78%{ transform:translateX(-50%) scaleY(0); opacity:0;} 82%{ transform:translateX(-50%) scaleY(1); opacity:1;} 89%{ transform:translateX(-50%) scaleY(1.06); opacity:1;} 93%{ transform:translateX(-50%) scaleY(0); opacity:0;} 100%{ transform:translateX(-50%) scaleY(0); opacity:0;} }
@keyframes fhc-lifeHead{ 0%,77%{ transform:rotate(0) translateY(0);} 85%{ transform:rotate(-5deg) translateY(-3px);} 92%{ transform:rotate(-2deg) translateY(-1px);} 100%{ transform:rotate(0) translateY(0);} }
@keyframes fhc-earTwitch{ 0%,40%,100%{ transform:rotate(-18deg);} 46%{ transform:rotate(-26deg);} 52%{ transform:rotate(-15deg);} 58%{ transform:rotate(-18deg);} }
@keyframes fhc-breathe{ 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.03,0.985);} }
@keyframes fhc-ring{ 0%,100%{ box-shadow:0 0 0 0 rgba(95,179,143,.55);} 50%{ box-shadow:0 0 0 10px rgba(95,179,143,0);} }

/* ─ Header ─ */
.fhc-header { width:100%; max-width:1180px; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:22px 26px 8px; flex-wrap:wrap; }
.fhc-brand { display:flex; align-items:center; gap:14px; }
.fhc-logo { width:46px; height:46px; border-radius:50%; background:#EFA661; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 0 rgba(0,0,0,.06); }
.fhc-logo .tri { width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-bottom:12px solid #4A3B33; transform:translateY(-1px); }
.fhc-title { font-family:'Baloo 2',cursive; font-weight:800; font-size:24px; line-height:1; color:#3C3029; }
.fhc-sub { font-size:13px; font-weight:700; color:#9C8A78; margin-top:2px; }
.fhc-tools { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.fhc-score { display:flex; align-items:center; gap:8px; background:#fff; border-radius:40px; padding:8px 16px; box-shadow:0 3px 0 rgba(0,0,0,.05); font-family:'Baloo 2',cursive; font-weight:700; font-size:18px; color:#3C3029; }
.fhc-score .fishdot { position:relative; width:18px; height:12px; border-radius:50%; background:#F4C66B; }
.fhc-score .fishdot::after { content:''; position:absolute; right:-5px; top:1px; width:0; height:0; border-top:5px solid transparent; border-bottom:5px solid transparent; border-right:6px solid #F4C66B; }
.fhc-btn { border:none; cursor:pointer; font-family:'Nunito',sans-serif; font-weight:800; font-size:13px; padding:9px 14px; border-radius:40px; box-shadow:0 3px 0 rgba(0,0,0,.05); display:flex; align-items:center; gap:7px; background:#fff; color:#7A6857; }
.fhc-btn .note { font-size:15px; color:#5FB38F; }
.fhc-btn:active { transform:translateY(2px); box-shadow:none; }
.fhc-btn.primary { background:#5FB38F; color:#fff; font-family:'Baloo 2',cursive; font-weight:700; font-size:15px; padding:10px 18px; box-shadow:0 4px 0 #4a9176; }

/* ─ Cats row ─ */
.fhc-cats { width:100%; max-width:1180px; flex:1; display:flex; align-items:flex-end; justify-content:center; gap:34px; padding:16px 26px 0; position:relative; z-index:2; flex-wrap:wrap; }
.fhc-cat { display:flex; flex-direction:column; align-items:center; gap:10px; width:200px; cursor:default; touch-action:none; }
.fhc-yum-wrap { position:relative; height:0; }
.fhc-yum { position:absolute; left:50%; bottom:-2px; transform:translateX(-50%); background:#5FB38F; color:#fff; font-family:'Baloo 2',cursive; font-weight:800; font-size:15px; padding:5px 13px; border-radius:30px; white-space:nowrap; animation:fhc-popUp 1s ease forwards; box-shadow:0 3px 0 rgba(0,0,0,.08); }
.fhc-fx.bounce { animation:fhc-catBounce .6s ease; }
.fhc-fx.shake { animation:fhc-catShake .45s ease; }
.fhc-catbox { position:relative; width:168px; height:178px; animation:fhc-catIdle 3.6s ease-in-out infinite; }

.fhc-tail { position:absolute; right:2px; bottom:18px; width:54px; height:19px; background:var(--body); border-radius:12px; transform-origin:left center; animation:fhc-tailSwish 2.9s ease-in-out infinite; z-index:0; }
.fhc-tail::after { content:''; position:absolute; right:0; top:0; width:18px; height:19px; border-radius:12px; background:rgba(74,59,51,.12); }
.fhc-body { position:absolute; bottom:0; left:26px; width:116px; height:104px; background:var(--body); border-radius:50% 50% 42% 42% / 60% 60% 40% 40%; box-shadow:inset 0 -10px 16px rgba(0,0,0,.07); animation:fhc-breathe 3.2s ease-in-out infinite; z-index:1; }
.fhc-belly { position:absolute; bottom:6px; left:50%; transform:translateX(-50%); width:56px; height:62px; background:rgba(255,255,255,.34); border-radius:50% 50% 46% 46% / 58% 58% 42% 42%; }
.fhc-paw { position:absolute; bottom:0; width:34px; height:24px; background:var(--body); border-radius:46% 46% 50% 50%; box-shadow:inset 0 -3px 5px rgba(0,0,0,.08); z-index:3; }
.fhc-paw.l { left:44px; }
.fhc-paw.r { right:44px; }
.fhc-paw::before, .fhc-paw::after { content:''; position:absolute; top:5px; width:1.5px; height:9px; background:rgba(74,59,51,.22); }
.fhc-paw.l::before { left:11px; } .fhc-paw.l::after { left:18px; }
.fhc-paw.r::before { left:14px; } .fhc-paw.r::after { left:21px; }

.fhc-head { position:absolute; top:0; left:0; width:168px; height:122px; transform-origin:50% 100%; animation:fhc-lifeHead 9s ease-in-out infinite var(--yd); z-index:2; }
.fhc-face { position:absolute; top:12px; left:22px; width:124px; height:108px; background:var(--body); border-radius:48% 48% 44% 44% / 52% 52% 48% 48%; box-shadow:inset 0 -8px 14px rgba(0,0,0,.06); }
.fhc-ear-lo { position:absolute; top:-20px; left:6px; width:0; height:0; border-left:18px solid transparent; border-right:10px solid transparent; border-bottom:34px solid var(--body); transform-origin:50% 100%; transform:rotate(-18deg); animation:fhc-earTwitch 7s ease-in-out infinite var(--yd); }
.fhc-ear-li { position:absolute; top:-12px; left:18px; width:0; height:0; border-left:9px solid transparent; border-right:6px solid transparent; border-bottom:18px solid var(--ear); transform:rotate(-18deg); }
.fhc-ear-ro { position:absolute; top:-20px; right:6px; width:0; height:0; border-left:10px solid transparent; border-right:18px solid transparent; border-bottom:34px solid var(--body); transform:rotate(18deg); }
.fhc-ear-ri { position:absolute; top:-12px; right:18px; width:0; height:0; border-left:6px solid transparent; border-right:9px solid transparent; border-bottom:18px solid var(--ear); transform:rotate(18deg); }
.fhc-stripe { position:absolute; background:rgba(74,59,51,.15); border-radius:2px; }
.fhc-stripe.s1 { top:8px; left:54px; width:3px; height:11px; transform:rotate(-14deg); }
.fhc-stripe.s2 { top:6px; left:61px; width:3px; height:13px; }
.fhc-stripe.s3 { top:8px; left:68px; width:3px; height:11px; transform:rotate(14deg); }
.fhc-eye { position:absolute; top:38px; width:16px; height:21px; background:#3A2E28; border-radius:50%; overflow:hidden; }
.fhc-eye.l { left:28px; } .fhc-eye.r { right:28px; }
.fhc-eye .h1 { position:absolute; top:3px; left:3px; width:5px; height:5px; border-radius:50%; background:#fff; opacity:.92; }
.fhc-eye .h2 { position:absolute; bottom:3px; right:3px; width:3px; height:3px; border-radius:50%; background:#fff; opacity:.5; }
.fhc-lid { position:absolute; inset:-2px; background:var(--body); transform-origin:50% 0; transform:scaleY(0); animation:fhc-lifeEyes 9s ease-in-out infinite var(--yd); }
.fhc-lid::after { content:''; position:absolute; bottom:2px; left:1px; right:1px; height:2px; background:rgba(74,59,51,.55); border-radius:2px; }
.fhc-cheek { position:absolute; top:58px; width:19px; height:12px; background:rgba(240,140,120,.32); border-radius:50%; }
.fhc-cheek.l { left:16px; } .fhc-cheek.r { right:16px; }
.fhc-yawn { position:absolute; top:65px; left:50%; width:24px; height:28px; transform:translateX(-50%) scaleY(0); transform-origin:50% 0; background:#8A3C42; border-radius:46% 46% 50% 50% / 30% 30% 70% 70%; opacity:0; animation:fhc-lifeMouth 9s ease-in-out infinite var(--yd); overflow:hidden; }
.fhc-yawn .teeth { position:absolute; top:0; left:50%; transform:translateX(-50%); width:14px; height:5px; background:#fff; border-radius:0 0 6px 6px; }
.fhc-yawn .tongue { position:absolute; bottom:1px; left:50%; transform:translateX(-50%); width:16px; height:12px; background:#E58598; border-radius:50% 50% 48% 48%; }
.fhc-nose { position:absolute; top:60px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid #E08B6F; z-index:4; }
.fhc-mouth { position:absolute; top:70px; left:50%; width:14px; height:8px; transform:translateX(-50%); border-bottom:2px solid #B5704F; border-radius:0 0 14px 14px; z-index:4; }
.fhc-wh { position:absolute; height:2px; background:rgba(74,59,51,.4); border-radius:2px; }
.fhc-wh.l1 { top:62px; left:-8px; width:28px; transform:rotate(6deg); }
.fhc-wh.l2 { top:69px; left:-8px; width:26px; transform:rotate(-4deg); }
.fhc-wh.r1 { top:62px; right:-8px; width:28px; transform:rotate(-6deg); }
.fhc-wh.r2 { top:69px; right:-8px; width:26px; transform:rotate(4deg); }

.fhc-namerow { display:flex; align-items:center; gap:8px; }
.fhc-name { font-family:'Baloo 2',cursive; font-weight:700; font-size:15px; color:#7A6857; }
.fhc-pips { display:flex; gap:4px; flex-wrap:wrap; max-width:90px; }
.fhc-pip { width:13px; height:9px; border-radius:50%; background:rgba(122,104,87,.18); }
.fhc-pip.on { background:#F4C66B; box-shadow:inset 0 -1px 0 rgba(0,0,0,.12); }
.fhc-full { background:#5FB38F; color:#fff; font-family:'Baloo 2',cursive; font-weight:800; font-size:17px; padding:9px 22px; border-radius:16px; box-shadow:0 4px 0 #4a9176; display:flex; align-items:center; gap:6px; }
.fhc-want { background:#fff; border-radius:16px; padding:8px 20px 10px; box-shadow:0 4px 0 rgba(0,0,0,.06); text-align:center; min-width:108px; }
.fhc-want .lbl { font-size:11px; font-weight:800; letter-spacing:1px; color:#B6A493; text-transform:uppercase; }
.fhc-want .tgt { font-family:'Baloo 2',cursive; font-weight:800; font-size:34px; line-height:1; color:#3C3029; }

/* ─ Floor + tray ─ */
.fhc-floor { width:100%; height:8px; background:rgba(176,122,60,.12); margin-top:6px; }
.fhc-tray { width:100%; background:linear-gradient(180deg,#EBD6B4,#E3CAA3); padding:20px 26px 26px; box-shadow:inset 0 6px 14px rgba(120,86,40,.12); z-index:3; }
.fhc-tray-inner { max-width:1180px; margin:0 auto; }
.fhc-tray-label { font-family:'Baloo 2',cursive; font-weight:700; font-size:14px; color:#8A6A3C; margin:0 0 12px 4px; letter-spacing:.3px; }
.fhc-tray-row { display:flex; flex-wrap:wrap; gap:16px; min-height:80px; align-items:center; }
.fhc-tray-empty { color:#A88C5E; font-weight:700; font-style:italic; }

/* ─ Fish treat ─ */
.fhc-fish { position:relative; width:138px; height:104px; cursor:grab; touch-action:none; user-select:none; filter:drop-shadow(0 4px 4px rgba(120,80,30,.22)); }
.fhc-fish svg, .fhc-ghost svg { position:absolute; inset:0; overflow:visible; }
.fhc-fish .expr, .fhc-ghost .expr { position:absolute; left:40px; top:32px; width:68px; height:28px; display:flex; align-items:center; justify-content:center; font-family:'Baloo 2',cursive; font-weight:800; font-size:21px; color:#3A2410; white-space:nowrap; }
.fhc-ghost { position:fixed; width:118px; height:76px; pointer-events:none; z-index:80; }
.fhc-ghost .inner { position:relative; width:138px; height:104px; filter:drop-shadow(0 9px 8px rgba(120,80,30,.32)); transform:rotate(-6deg) scale(1.06); }

/* ─ Win overlay (scoped to the game card) ─ */
.fhc-win { position:absolute; inset:0; background:rgba(60,48,41,.42); display:flex; align-items:center; justify-content:center; z-index:60; }
.fhc-win .star { position:absolute; animation:fhc-floatStar 2.2s ease-in-out infinite; }
.fhc-win .card { background:#fff; border-radius:28px; padding:34px 42px; text-align:center; box-shadow:0 14px 0 rgba(0,0,0,.12); max-width:420px; }
.fhc-win .card h2 { font-family:'Baloo 2',cursive; font-weight:800; font-size:28px; color:#3C3029; }
.fhc-win .card p { font-size:15px; font-weight:700; color:#9C8A78; margin:8px 0 22px; }
.fhc-win .card button { border:none; cursor:pointer; background:#5FB38F; color:#fff; font-family:'Baloo 2',cursive; font-weight:800; font-size:18px; padding:13px 30px; border-radius:40px; box-shadow:0 5px 0 #4a9176; }
.fhc-win .card button:active { transform:translateY(3px); box-shadow:0 2px 0 #4a9176; }

@media (prefers-reduced-motion: reduce) {
  .fhc-catbox, .fhc-tail, .fhc-body, .fhc-head, .fhc-ear-lo, .fhc-lid, .fhc-yawn, .fhc-fx.bounce, .fhc-fx.shake, .fhc-yum, .fhc-win .star { animation:none !important; }
  .fhc-lid { transform:scaleY(0); }
  .fhc-yawn { opacity:0; }
}
@media (max-width:720px) {
  .fhc-cats { gap:18px; }
  .fhc-sub { display:none; }
}
`
