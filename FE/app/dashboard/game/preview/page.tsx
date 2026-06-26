'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SafetyReport, SafetyCheck } from '@/features/game-creation/ai-api'
import { getTemplateByBackendId } from '@/features/game-creation/template-registry'
import { GameShell } from '@/features/game-shells/GameShell'
import { FullscreenPlay } from '@/features/game-shells/FullscreenPlay'
import { saveLocalGame, newLocalGameId } from '@/features/game-library/services/local-games'
import type { Game, GameItem, GameTemplateType } from '@/types/app'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawQuestion {
  question: string
  correct_answer: string
  distractors?: string[]
  hint?: string
  explanation?: string
  objective_id?: string
}

interface GameContent {
  questions?: RawQuestion[]
  items?: RawQuestion[]
  title?: string
  [key: string]: unknown
}

interface Metadata {
  subject: string
  grade: number
  difficulty: string
  prompt: string
  elapsed_ms: number
}

interface PreviewData {
  templateId: string
  templateName: string
  content: GameContent
  safetyReport: SafetyReport
  metadata: Metadata
  /** Set when reopening a game already saved to the local library. */
  localId?: string
}

interface ShareSettings {
  classShare: boolean
  showScores: boolean
  publicLibrary: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise the raw AI content dict into a flat RawQuestion array.
 *
 * Different templates use different top-level keys:
 *   - quiz / battleship / cat_jump → content.questions
 *   - feed_the_cats                → content.items
 *   - farm_builder                 → content.challenges (target_area → correct_answer)
 *   - beat_forge                   → uses lanes (not a Q&A list; returns [] here)
 */
function extractQuestions(content: GameContent): RawQuestion[] {
  if (Array.isArray(content.problems) && content.problems.length > 0) {
    return (content.problems as Array<{ shape_type?: string; constraint?: string; value?: number; hint?: string; explanation?: string; objective_id?: string }>).map(
      (p) => ({
        question: `Xây trang trại ${p.shape_type ?? '?'} với ${p.constraint ?? '?'} = ${p.value ?? '?'}`,
        correct_answer: `${p.shape_type}|${p.constraint}|${p.value}`,
        hint: p.hint,
        explanation: p.explanation,
        objective_id: p.objective_id,
      })
    )
  }
  if (Array.isArray(content.items) && content.items.length > 0) return content.items
  return content.questions ?? []
}

interface BeatForgeLaneRaw {
  correct_answer: string
  hint?: string
  explanation?: string
}

function beatForgeContentToGame(content: GameContent): Game {
  const timeSig = String(content.time_signature ?? '4/4')
  const lanes = (content.lanes as BeatForgeLaneRaw[] | undefined) ?? []

  // options_json[0..5]: half, quarter, eighth, dotted_half, dotted_quarter, triplet_eighth
  const configItem: GameItem = {
    id: '0',
    type: 'beat-forge',
    question: String(content.title ?? 'Beat Forge'),
    correctAnswer: timeSig,
    options: [
      String(Number(content.half_notes           ?? 0)),
      String(Number(content.quarter_notes        ?? 0)),
      String(Number(content.eighth_notes         ?? 0)),
      String(Number(content.dotted_half_notes    ?? 0)),
      String(Number(content.dotted_quarter_notes ?? 0)),
      String(Number(content.triplet_eighth_notes ?? 0)),
    ],
    explanation: '',
    validationStatus: 'valid',
  }

  const laneItems: GameItem[] = lanes.map((lane, i) => ({
    id: String(i + 1),
    type: 'beat-forge' as GameTemplateType,
    question: `Lane ${i + 1}`,
    correctAnswer: lane.correct_answer ?? '',
    options: [],
    explanation: lane.explanation ?? '',
    hint: lane.hint || undefined,
    validationStatus: 'valid' as const,
  }))

  return {
    id: 'preview',
    lessonId: 'preview',
    templateType: 'beat-forge',
    items: [configItem, ...laneItems],
    settings: { numItems: lanes.length },
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function questionsToGame(questions: RawQuestion[], templateType: GameTemplateType): Game {
  const items: GameItem[] = questions.map((q, i) => ({
    id: String(i),
    type: templateType,
    question: q.question,
    correctAnswer: q.correct_answer,
    options: shuffle([q.correct_answer, ...(q.distractors ?? [])]),
    explanation: q.explanation ?? '',
    hint: q.hint,
    validationStatus: 'valid',
  }))
  return {
    id: 'preview',
    lessonId: 'preview',
    templateType,
    items,
    settings: { numItems: items.length, playerCount: 2, mapTheme: 'treasure-hunt' },
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// ── Safety circle ─────────────────────────────────────────────────────────────

function SafetyCircle({ status, size = 24 }: { status: string; size?: number }) {
  const isPass = status === 'pass'
  const isFixed = status === 'fixed'
  const isFail = status === 'fail'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isFail ? '#fee2e6' : isFixed ? '#fdf3e0' : '#e7f7f0',
      color: isFail ? '#e11d48' : isFixed ? '#b06f00' : '#0d9f6e',
    }}>
      {(isPass) && (
        <svg width={size === 24 ? 12 : 10} height={size === 24 ? 12 : 10} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l3.5 3.5 8.5-9"/></svg>
      )}
      {isFixed && (
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 6v5M10 14v.2"/></svg>
      )}
      {isFail && (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>
      )}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div onClick={onChange} style={{ width: 40, height: 23, borderRadius: 12, background: on ? '#4f46e5' : '#dfe3ee', position: 'relative', flexShrink: 0, cursor: 'pointer', transition: 'background .18s' }}>
      <span style={{ position: 'absolute', top: 2.5, left: on ? undefined : 2.5, right: on ? 2.5 : undefined, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .18s, right .18s' }}/>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const router = useRouter()

  const [data, setData] = useState<PreviewData | null>(null)
  const [questions, setQuestions] = useState<RawQuestion[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [editing, setEditing] = useState<RawQuestion | null>(null)
  const [previewMode, setPreviewMode] = useState<'preview' | 'play'>('preview')
  const [publishState, setPublishState] = useState<'draft' | 'published'>('draft')
  const [shareSettings, setShareSettings] = useState<ShareSettings>({ classShare: true, showScores: true, publicLibrary: false })
  const [copied, setCopied] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [localId, setLocalId] = useState<string | null>(null)
  const shareUrl = 'hocmachoi.vn/g/tro-choi-moi'

  useEffect(() => {
    const raw = sessionStorage.getItem('gamePreviewData')
    if (!raw) { router.push('/dashboard/game/new'); return }
    try {
      const parsed: PreviewData = JSON.parse(raw)
      setData(parsed)
      setQuestions(extractQuestions(parsed.content))
      if (parsed.localId) { setLocalId(parsed.localId); setPublishState('published') }
    } catch {
      router.push('/dashboard/game/new')
    }
  }, [router])

  const gameDef = getTemplateByBackendId(data?.templateId ?? '')
  const templateType: GameTemplateType = gameDef?.type ?? 'press-the-button'
  // Some games can only be summarised in-app (full play needs a BE_Web game id).
  const previewOnly = gameDef?.previewOnly ?? false

  const isBeatForge = data?.templateId === 'beat_forge'

  // Rebuild the Game whenever question set or raw content changes.
  const game = useMemo(
    () => isBeatForge && data ? beatForgeContentToGame(data.content) : questionsToGame(questions, templateType),
    [isBeatForge, data, questions, templateType],
  )

  const numQuestions = isBeatForge
    ? ((data?.content.lanes as unknown[] | undefined)?.length ?? 0)
    : questions.length

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Be Vietnam Pro', sans-serif", color: '#9aa2b2' }}>
      Đang tải…
    </div>
  )

  const { safetyReport, metadata, templateName } = data
  const hasWarning = safetyReport.overall === 'warning'

  const handleSaveEdit = () => {
    if (!editing) return
    const next = [...questions]
    next[selectedIdx] = editing
    setQuestions(next)
    setEditing(null)
  }

  const handleAddQuestion = () => {
    const blank: RawQuestion = { question: '', correct_answer: '', distractors: ['', '', ''], explanation: '' }
    setQuestions(prev => [...prev, blank])
    setSelectedIdx(questions.length)
    setEditing(blank)
  }

  const persist = (status: 'draft' | 'published') => {
    if (!data) return
    const id = localId ?? newLocalGameId()
    // beat_forge and farm_builder use structured content not reducible to a flat Q&A list — preserve as-is.
    // For other templates, write back the (possibly edited) questions under the original key.
    const isFarmBuilder = data.templateId === 'farm_builder'
    const persistContent = (isBeatForge || isFarmBuilder)
      ? data.content
      : { ...data.content, [Array.isArray(data.content.items) ? 'items' : 'questions']: questions }
    saveLocalGame({
      id,
      templateId: data.templateId,
      templateName: data.templateName,
      content: persistContent,
      safetyReport: data.safetyReport,
      metadata: data.metadata,
      status,
    })
    setLocalId(id)
  }

  const handlePublish = () => {
    persist('published')
    setPublishState('published')
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://${shareUrl}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div style={{ height: '100vh', minHeight: 780, display: 'flex', flexDirection: 'column', fontFamily: "'Be Vietnam Pro', sans-serif", background: '#f4f5f8', color: '#1b2333', overflow: 'hidden', fontSize: 15 }}>

      {/* ── Top bar ── */}
      <header style={{ height: 62, flexShrink: 0, borderBottom: '1px solid #e9ebf1', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14 }}>
        <button onClick={() => router.push('/dashboard/game/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: '#5b6577', fontSize: 14, fontWeight: 500, border: '1px solid #e3e6ee', borderRadius: 9, padding: '7px 13px', cursor: 'pointer', background: '#fff', fontFamily: 'inherit' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5l-5 5 5 5"/></svg>
          Quay lại chat
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, paddingLeft: 6, borderLeft: '1px solid #eceef3', marginLeft: 2 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
            {getTemplateByBackendId(data.templateId)?.icon ?? '🎮'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {templateName || 'Trò chơi'}: {metadata.subject} lớp {metadata.grade}
            </div>
            <div style={{ fontSize: 12, color: '#9aa2b2' }}>{metadata.subject} · Lớp {metadata.grade} · {numQuestions} câu hỏi</div>
          </div>
          {publishState === 'draft'
            ? <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#b06f00', background: '#fdf3e0', border: '1px solid #f5e2bb', borderRadius: 7, padding: '3px 9px' }}>Bản nháp</span>
            : <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#047a55', background: '#e7f7f0', border: '1px solid #c4ecd9', borderRadius: 7, padding: '3px 9px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9f6e' }}/>Đã xuất bản</span>
          }
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setPlaying(true)} disabled={numQuestions === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #c4ecd9', background: '#e7f7f0', color: '#047a55', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, padding: '9px 14px', borderRadius: 10, cursor: numQuestions === 0 ? 'not-allowed' : 'pointer', opacity: numQuestions === 0 ? .5 : 1 }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M6 4.5v11a1 1 0 001.5.87l9-5.5a1 1 0 000-1.74l-9-5.5A1 1 0 006 4.5z"/></svg>
            Chơi thử ngay
          </button>
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #e3e6ee', background: '#fff', color: '#5b6577', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '9px 14px', borderRadius: 10, cursor: 'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13.5V16h2.5l8-8-2.5-2.5z"/><path d="M11.5 5.5L14 8"/></svg>
            Chỉnh sửa toàn bộ
          </button>
          {publishState === 'draft' ? (
            <button onClick={handlePublish} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, padding: '10px 18px', borderRadius: 10, boxShadow: '0 5px 14px rgba(79,70,229,.28)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l3.5 3.5 8.5-9"/></svg>
              Duyệt &amp; Xuất bản
            </button>
          ) : (
            <button onClick={handleCopyLink} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#0d9f6e', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, padding: '10px 18px', borderRadius: 10, boxShadow: '0 5px 14px rgba(13,159,110,.28)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10l-2.5 2.5a2.5 2.5 0 003.5 3.5L11 13M13 10l2.5-2.5a2.5 2.5 0 00-3.5-3.5L9 7"/><path d="M8 12l4-4"/></svg>
              {copied ? 'Đã sao chép!' : 'Sao chép liên kết'}
            </button>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

        {/* Left: content editor */}
        <aside style={{ width: 332, flexShrink: 0, background: '#fff', borderRight: '1px solid #e9ebf1', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #eef0f4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Nội dung trò chơi</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#5b6577', background: '#f1f3f7', borderRadius: 6, padding: '2px 8px' }}>{numQuestions} câu</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#9aa2b2', marginTop: 3 }}>Bấm vào từng câu hỏi để chỉnh sửa nội dung</div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {questions.map((q, i) => {
              const isSelected = i === selectedIdx
              const isEditing = !!editing && isSelected
              return (
                <div key={i} onClick={() => { setSelectedIdx(i); setEditing(null) }} style={{ border: `1px solid ${isSelected ? '#e0e2fb' : '#eef0f4'}`, background: isSelected ? '#f7f8ff' : '#fff', borderRadius: 11, padding: '11px 12px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: isSelected ? '#eef0fe' : '#f1f3f7', color: isSelected ? '#4f46e5' : '#5b6577', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                    {isEditing ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
                        <textarea value={editing.question} onChange={e => setEditing(p => p ? { ...p, question: e.target.value } : p)} rows={2} placeholder="Câu hỏi" style={{ fontSize: 13, fontFamily: 'inherit', border: '1px solid #e3e6ee', borderRadius: 6, padding: '5px 7px', outline: 'none', resize: 'vertical' }} />
                        <input value={editing.correct_answer} onChange={e => setEditing(p => p ? { ...p, correct_answer: e.target.value } : p)} placeholder="Đáp án đúng" style={{ fontSize: 13, fontFamily: 'inherit', border: '1.5px solid #c4ecd9', background: '#f3fbf7', borderRadius: 6, padding: '4px 7px', outline: 'none' }} />
                        {(editing.distractors ?? []).map((d, di) => (
                          <input key={di} value={d} onChange={e => setEditing(p => { if (!p) return p; const ds = [...(p.distractors ?? [])]; ds[di] = e.target.value; return { ...p, distractors: ds } })} placeholder={`Phương án nhiễu ${di + 1}`} style={{ fontSize: 13, fontFamily: 'inherit', border: '1px solid #e3e6ee', borderRadius: 6, padding: '4px 7px', outline: 'none' }} />
                        ))}
                        <button onClick={handleSaveEdit} style={{ alignSelf: 'flex-end', fontSize: 12, fontWeight: 600, color: '#fff', background: '#4f46e5', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Lưu</button>
                      </div>
                    ) : (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.4 }}>{q.question || <span style={{ color: '#c2c8d4' }}>(Câu hỏi trống)</span>}</div>
                        <div style={{ fontSize: 12.5, color: '#047a55', marginTop: 3 }}>✓ {q.correct_answer}</div>
                      </div>
                    )}
                    {!isEditing && (
                      <svg onClick={e => { e.stopPropagation(); setSelectedIdx(i); setEditing(questions[i]) }} width="15" height="15" viewBox="0 0 20 20" fill="none" stroke={isSelected ? '#4f46e5' : '#c2c8d4'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', flexShrink: 0 }}><path d="M4 13.5V16h2.5l8-8-2.5-2.5z"/><path d="M11.5 5.5L14 8"/></svg>
                    )}
                  </div>
                </div>
              )
            })}

            <button onClick={handleAddQuestion} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1.5px dashed #d3d8e3', background: '#fff', color: '#5b6577', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '11px', borderRadius: 11, cursor: 'pointer', marginTop: 3 }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
              Thêm câu hỏi
            </button>
          </div>
        </aside>

        {/* Center: game preview */}
        <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#eef0f4' }}>
          {/* Toolbar */}
          <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5b6577' }}>Xem trước trò chơi</span>
            {!previewOnly && (
              <div style={{ display: 'flex', background: '#e2e5ec', borderRadius: 9, padding: 3, marginLeft: 4 }}>
                <span onClick={() => setPreviewMode('preview')} style={{ fontSize: 12.5, fontWeight: previewMode === 'preview' ? 600 : 500, color: previewMode === 'preview' ? '#1b2333' : '#5b6577', background: previewMode === 'preview' ? '#fff' : 'transparent', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', boxShadow: previewMode === 'preview' ? '0 1px 2px rgba(16,24,40,.1)' : 'none' }}>Xem trước</span>
                <span onClick={() => setPreviewMode('play')} style={{ fontSize: 12.5, fontWeight: previewMode === 'play' ? 600 : 500, color: previewMode === 'play' ? '#1b2333' : '#5b6577', background: previewMode === 'play' ? '#fff' : 'transparent', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', boxShadow: previewMode === 'play' ? '0 1px 2px rgba(16,24,40,.1)' : 'none' }}>Chơi thử</span>
              </div>
            )}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#8b94a6' }}>
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="3" width="10" height="14" rx="2"/><path d="M9 15h2"/></svg>
              Máy tính · 16:9
            </span>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6px 26px 30px' }}>
            <div style={{ width: '100%', maxWidth: 760 }}>
              {game.items.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9aa2b2', padding: 60 }}>Chưa có câu hỏi nào.</div>
              ) : (
                <GameShell key={`${templateType}-${previewMode}`} game={game} previewMode={previewOnly ? true : previewMode === 'preview'} />
              )}
            </div>
          </div>
        </section>

        {/* Right: verify + publish */}
        <aside style={{ width: 340, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e9ebf1', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Safety */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>Kiểm định &amp; an toàn</span>
                {hasWarning
                  ? <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#b06f00', background: '#fdf3e0', border: '1px solid #f3deb0', borderRadius: 8, padding: '3px 9px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d98a04' }}/>Đạt · 1 cảnh báo</span>
                  : <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#047a55', background: '#e7f7f0', border: '1px solid #c4ecd9', borderRadius: 8, padding: '3px 9px' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9f6e' }}/>Đạt toàn bộ</span>
                }
              </div>
              <div style={{ border: '1px solid #eef0f4', borderRadius: 13, overflow: 'hidden' }}>
                {safetyReport.checks.map((check: SafetyCheck, i: number) => (
                  <div key={check.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '11px 13px', borderBottom: i < safetyReport.checks.length - 1 ? '1px solid #f4f5f8' : 'none' }}>
                    <SafetyCircle status={check.status} size={24} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{check.label}</div>
                      <div style={{ fontSize: 12, color: '#9aa2b2', marginTop: 1 }}>{check.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 9, border: '1px solid #eef0f4', borderRadius: 11, padding: '10px 13px', background: '#fbfcfe' }}>
                <SafetyCircle status="pass" size={24} />
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>Cấu trúc dữ liệu hợp lệ <span style={{ color: '#9aa2b2', fontWeight: 500 }}>(schema)</span></div>
              </div>
            </div>

            {/* Publish settings */}
            <div style={{ borderTop: '1px solid #eef0f4', paddingTop: 16 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 12 }}>Thiết lập xuất bản</div>

              {[
                { key: 'classShare' as const, label: 'Chia sẻ cho lớp học', sub: 'Học sinh trong lớp có thể chơi' },
                { key: 'showScores' as const, label: 'Cho phép xem điểm', sub: 'Hiển thị kết quả sau khi chơi' },
                { key: 'publicLibrary' as const, label: 'Công khai trong thư viện trường', sub: 'Giáo viên khác có thể dùng lại' },
              ].map((item, i) => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', borderTop: i > 0 ? '1px solid #f4f5f8' : 'none' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#9aa2b2' }}>{item.sub}</div>
                  </div>
                  <Toggle on={shareSettings[item.key]} onChange={() => setShareSettings(s => ({ ...s, [item.key]: !s[item.key] }))} />
                </div>
              ))}

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 9, border: '1px solid #e3e6ee', borderRadius: 10, padding: '9px 11px', background: '#f7f8fa' }}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#9aa2b2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10l-2.5 2.5a2.5 2.5 0 003.5 3.5L11 13M13 10l2.5-2.5a2.5 2.5 0 00-3.5-3.5L9 7"/></svg>
                <span style={{ flex: 1, fontSize: 13, color: '#5b6577', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shareUrl}</span>
                <svg onClick={handleCopyLink} width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#4f46e5" strokeWidth="1.7" style={{ cursor: 'pointer', flexShrink: 0 }}><rect x="7" y="7" width="9" height="9" rx="2"/><path d="M4 13V5a1 1 0 011-1h8"/></svg>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ flexShrink: 0, borderTop: '1px solid #eef0f4', padding: '14px 18px' }}>
            {publishState === 'draft' ? (
              <>
                <button onClick={handlePublish} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 15, padding: 13, borderRadius: 12, boxShadow: '0 6px 16px rgba(79,70,229,.28)' }}>
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l3.5 3.5 8.5-9"/></svg>
                  Duyệt &amp; Xuất bản
                </button>
                <div style={{ textAlign: 'center', fontSize: 12, color: '#9aa2b2', marginTop: 8 }}>Bạn là người chịu trách nhiệm cuối cùng về nội dung</div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#e7f7f0', border: '1px solid #c4ecd9', borderRadius: 12, padding: 13, color: '#047a55' }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5l3.5 3.5 8.5-9"/></svg>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Đã xuất bản thành công</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {playing && (
        <FullscreenPlay
          title={`${templateName || 'Trò chơi'} · ${metadata.subject} lớp ${metadata.grade}`}
          def={gameDef}
          game={game}
          onClose={() => setPlaying(false)}
        />
      )}
    </div>
  )
}
