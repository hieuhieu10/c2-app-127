'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import {
  streamGenerate,
  recommendGames,
  GuardrailError,
  type SafetyReport,
  type CompleteEvent,
  type StageStatus,
  type GameRecommendation,
} from '@/features/game-creation/ai-api'
import { getTemplateByBackendId } from '@/features/game-creation/template-registry'

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineStage {
  id: string
  label: string
  subtitle: string
  tag: string | null
  tagType: 'neutral' | 'indigo'
  status: StageStatus
}

interface PostGateStep {
  id: string
  label: string
  subtitle: string
  status: StageStatus
}

interface SentForm {
  subject: string
  grade: number
  difficulty: string
  prompt: string
  numItems: number
  sourceText: string | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const SUBJECTS = ['Toán', 'Tiếng Việt', 'Khoa học', 'Lịch sử', 'Địa lý', 'Tiếng Anh']
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const DIFFICULTIES: { label: string; value: 'easy' | 'medium' | 'hard' }[] = [
  { label: 'Dễ', value: 'easy' },
  { label: 'Trung bình', value: 'medium' },
  { label: 'Khó', value: 'hard' },
]

const PIPELINE_STAGE_DEFS: PipelineStage[] = [
  { id: 'parse_pdf', label: 'Phân tích tài liệu', subtitle: '...', tag: 'PyMuPDF · OCR', tagType: 'neutral', status: 'pending' },
  { id: 'rag', label: 'Tra cứu khung chương trình GDPT 2018', subtitle: '...', tag: 'RAG', tagType: 'neutral', status: 'pending' },
  { id: 'recommend', label: 'Đề xuất mẫu trò chơi', subtitle: '...', tag: 'Bộ điều phối', tagType: 'indigo', status: 'pending' },
  { id: 'generate', label: 'Sinh nội dung trò chơi', subtitle: '...', tag: 'Bộ sinh nội dung', tagType: 'indigo', status: 'pending' },
]

// ── Icons ────────────────────────────────────────────────────────────────────

function IconCheck({ size = 15, stroke = '#0d9f6e', strokeWidth = 2.4 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5l3.5 3.5 8.5-9"/>
    </svg>
  )
}

function IconWarn({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="#b06f00" strokeWidth="2.2" strokeLinecap="round">
      <path d="M10 6v5M10 14v.2"/>
    </svg>
  )
}

function IconSpinner({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  )
}

// ── Stage circle ─────────────────────────────────────────────────────────────

function StageCircle({ status, size = 30 }: { status: StageStatus; size?: number }) {
  if (status === 'done') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#e7f7f0', color: '#0d9f6e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconCheck size={size === 26 ? 13 : 15} />
      </div>
    )
  }
  if (status === 'warning' || status === 'error') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#fdf3e0', color: '#b06f00', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconWarn size={size === 26 ? 14 : 14} />
      </div>
    )
  }
  if (status === 'running') {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconSpinner size={size === 26 ? 13 : 15} />
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#f1f3f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#c2c8d4' }}/>
    </div>
  )
}

// ── Safety check circle ───────────────────────────────────────────────────────

function SafetyCircle({ status }: { status: string }) {
  if (status === 'pass' || status === 'fixed') {
    const isFixed = status === 'fixed'
    return (
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: isFixed ? '#fdf3e0' : '#e7f7f0', color: isFixed ? '#b06f00' : '#0d9f6e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isFixed ? <IconWarn size={14}/> : <IconCheck size={13} stroke="#0d9f6e"/>}
      </div>
    )
  }
  return (
    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#fee2e6', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NewGamePage() {
  const router = useRouter()

  // Form state
  const [subject, setSubject] = useState('Toán')
  const [grade, setGrade] = useState(4)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [prompt, setPrompt] = useState('')
  const [numItems, setNumItems] = useState(8)

  // Chat state
  const [submitted, setSubmitted] = useState(false)
  const [sentForm, setSentForm] = useState<SentForm | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)

  // Recommendation state (the game-choice step that precedes generation)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [recommendations, setRecommendations] = useState<GameRecommendation[] | null>(null)
  const [chosenGame, setChosenGame] = useState<GameRecommendation | null>(null)
  const [guardrailBlock, setGuardrailBlock] = useState<{ message: string; suggestion: string } | null>(null)

  // Pipeline state
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [postGate, setPostGate] = useState<PostGateStep[]>([])
  const [safetyReport, setSafetyReport] = useState<SafetyReport | null>(null)
  const [result, setResult] = useState<CompleteEvent | null>(null)

  // Attachment state
  const [sourceText, setSourceText] = useState<string | null>(null)
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)

  const threadRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const SUPPORTED_TYPES = ['.txt', '.md', '.csv', '.json']

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = '' // reset so same file can be re-attached
    if (!file) return

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!SUPPORTED_TYPES.includes(ext)) {
      setAttachError(`Định dạng "${ext}" chưa hỗ trợ. Vui lòng dùng: ${SUPPORTED_TYPES.join(', ')}`)
      setTimeout(() => setAttachError(null), 4000)
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setSourceText(text)
      setAttachedFileName(file.name)
      setAttachError(null)
    }
    reader.onerror = () => {
      setAttachError('Không đọc được tệp. Vui lòng thử lại.')
      setTimeout(() => setAttachError(null), 4000)
    }
    reader.readAsText(file, 'utf-8')
  }

  const removeAttachment = () => {
    setSourceText(null)
    setAttachedFileName(null)
  }

  const diffLabel = DIFFICULTIES.find(d => d.value === difficulty)?.label ?? 'Trung bình'

  const scrollDown = () => {
    setTimeout(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  // Phase 1 — teacher describes the lesson; AI recommends which games fit.
  const handleSubmit = async () => {
    if (isRunning || loadingRecs || !prompt.trim()) return

    const form: SentForm = { subject, grade, difficulty, prompt: prompt.trim(), numItems, sourceText }
    setSentForm(form)
    setSubmitted(true)
    setError(null)
    setResult(null)
    setSafetyReport(null)
    setPostGate([])
    setStages([])
    setRecommendations(null)
    setChosenGame(null)
    setGuardrailBlock(null)
    setLoadingRecs(true)
    scrollDown()

    try {
      const recs = await recommendGames({ subject, grade, difficulty, prompt: prompt.trim(), source_text: sourceText ?? undefined })
      setRecommendations(recs)
    } catch (err) {
      if (err instanceof GuardrailError) {
        setGuardrailBlock({ message: err.message, suggestion: err.suggestion })
      } else {
        setError(err instanceof Error ? err.message : 'Lỗi không xác định')
      }
    } finally {
      setLoadingRecs(false)
      scrollDown()
    }
  }

  // Phase 2 — teacher picks a game; run the generation pipeline for that template.
  const handleChooseGame = async (rec: GameRecommendation) => {
    if (isRunning || !sentForm) return

    setChosenGame(rec)
    setIsRunning(true)
    setError(null)
    setResult(null)
    setSafetyReport(null)
    setPostGate([])
    setStages(PIPELINE_STAGE_DEFS.map(s => ({ ...s, status: 'pending' })))

    let t = 0
    setElapsedSec(0)
    timerRef.current = setInterval(() => { t++; setElapsedSec(t) }, 1000)
    scrollDown()

    try {
      for await (const ev of streamGenerate({
        subject: sentForm.subject,
        grade: sentForm.grade,
        difficulty: sentForm.difficulty as 'easy' | 'medium' | 'hard',
        prompt: sentForm.prompt,
        num_items: sentForm.numItems,
        source_text: sentForm.sourceText ?? undefined,
        override_template: rec.template_id,
      })) {
        if (ev.type === 'stage') {
          const pipelineIds = ['parse_pdf', 'rag', 'recommend', 'generate']
          if (pipelineIds.includes(ev.id)) {
            setStages(prev => prev.map(s => s.id === ev.id ? { ...s, status: ev.status, subtitle: ev.subtitle } : s))
          } else if (ev.id === 'schema' || ev.id === 'build') {
            setPostGate(prev => {
              const exists = prev.find(p => p.id === ev.id)
              if (exists) return prev.map(p => p.id === ev.id ? { ...p, status: ev.status, subtitle: ev.subtitle } : p)
              return [...prev, { id: ev.id, label: ev.label, subtitle: ev.subtitle, status: ev.status }]
            })
          }
          scrollDown()
        } else if (ev.type === 'safety') {
          setSafetyReport(ev.report)
          scrollDown()
        } else if (ev.type === 'complete') {
          setResult(ev)
          setIsRunning(false)
          clearInterval(timerRef.current!)
          scrollDown()
        } else if (ev.type === 'error') {
          setError(ev.message)
          setIsRunning(false)
          clearInterval(timerRef.current!)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định')
      setIsRunning(false)
      clearInterval(timerRef.current!)
    }
  }

  const handlePreview = () => {
    if (!result || !sentForm) return
    sessionStorage.setItem('gamePreviewData', JSON.stringify({
      templateId: result.template_id,
      templateName: result.template_name,
      content: result.content,
      safetyReport: result.safety_report,
      metadata: {
        subject: sentForm.subject,
        grade: sentForm.grade,
        difficulty: sentForm.difficulty,
        prompt: sentForm.prompt,
        elapsed_ms: result.elapsed_ms,
      },
    }))
    router.push('/dashboard/game/preview')
  }

  const safetyOverall = safetyReport?.overall
  const hasWarning = safetyOverall === 'warning'

  return (
    <div style={{ height: '100vh', minHeight: 780, display: 'flex', fontFamily: "'Be Vietnam Pro', sans-serif", background: '#f4f5f8', color: '#1b2333', overflow: 'hidden', fontSize: 15 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <AppSidebar />

      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header style={{ height: 60, flexShrink: 0, borderBottom: '1px solid #e9ebf1', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 26px', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span style={{ fontSize: 13.5, color: '#9aa2b2' }}>Trò chơi của tôi</span>
            <span style={{ color: '#cfd4df' }}>/</span>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sentForm ? sentForm.prompt.slice(0, 40) + (sentForm.prompt.length > 40 ? '…' : '') : 'Trò chơi mới'}
            </span>
            <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#b06f00', background: '#fdf3e0', border: '1px solid #f5e2bb', borderRadius: 7, padding: '3px 9px' }}>Bản nháp</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <button style={{ border: '1px solid #e3e6ee', background: '#fff', color: '#5b6577', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '8px 14px', borderRadius: 9, cursor: 'pointer' }}>Lưu nháp</button>
            <div style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid #e3e6ee', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#8b94a6' }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7.2"/><path d="M10 14.5v-.2M10 11.4c0-1.6 1.8-1.7 1.8-3.3A1.8 1.8 0 0010 6.4c-1 0-1.7.6-1.9 1.5" strokeLinecap="round"/></svg>
            </div>
          </div>
        </header>

        {/* Thread */}
        <div ref={threadRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#f4f5f8' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '30px 24px 14px', display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Welcome state */}
            {!submitted && (
              <div style={{ textAlign: 'center', padding: '60px 0 20px', color: '#9aa2b2' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eef0fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="#4f46e5"><path d="M10 2l1.7 4.6L16.5 8l-4.8 1.4L10 14l-1.7-4.6L3.5 8l4.8-1.4z"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1b2333', marginBottom: 6 }}>Tạo trò chơi học tập</div>
                <div style={{ fontSize: 13.5 }}>Mô tả trò chơi bạn muốn tạo và bấm gửi để bắt đầu.</div>
              </div>
            )}

            {/* Teacher message */}
            {sentForm && (
              <div style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                <div style={{ background: '#4f46e5', color: '#fff', borderRadius: '16px 16px 5px 16px', padding: '14px 16px', boxShadow: '0 6px 18px rgba(79,70,229,.22)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,.18)', borderRadius: 7, padding: '3px 9px' }}>Môn: {sentForm.subject}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,.18)', borderRadius: 7, padding: '3px 9px' }}>Lớp {sentForm.grade}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,.18)', borderRadius: 7, padding: '3px 9px' }}>
                      Độ khó: {DIFFICULTIES.find(d => d.value === sentForm.difficulty)?.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.5 }}>{sentForm.prompt}</div>
                </div>
              </div>
            )}

            {/* Assistant block */}
            {submitted && (
              <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="#4f46e5"><path d="M10 2l1.7 4.6L16.5 8l-4.8 1.4L10 14l-1.7-4.6L3.5 8l4.8-1.4z"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Intro */}
                  <div style={{ fontSize: 14, color: '#5b6577' }}>
                    {loadingRecs
                      ? <>Đang phân tích yêu cầu và chọn trò chơi phù hợp…</>
                      : recommendations && !chosenGame
                        ? <>Dựa trên bài học của bạn, đây là những trò chơi phù hợp. Chọn một trò chơi để mình tạo nội dung.</>
                        : result
                          ? <>Mình đã chạy xong quy trình tạo trò chơi <span style={{ color: '#9aa2b2' }}>· hoàn tất trong {Math.round(result.elapsed_ms / 1000)} giây</span></>
                          : isRunning
                            ? <>Đang tạo trò chơi <b>{chosenGame?.name}</b>… <span style={{ color: '#9aa2b2' }}>{elapsedSec}s</span></>
                            : error
                              ? <span style={{ color: '#e11d48' }}>Có lỗi xảy ra</span>
                              : null}
                  </div>

                  {/* Game recommendation cards (choose-a-game step) */}
                  {recommendations && !chosenGame && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {recommendations.map(rec => {
                        const meta = getTemplateByBackendId(rec.template_id)
                        return (
                          <button
                            key={rec.template_id}
                            onClick={() => handleChooseGame(rec)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left', width: '100%',
                              background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                              border: `1.5px solid ${rec.recommended ? '#c7c5f7' : '#e9ebf1'}`,
                              borderRadius: 16, padding: '16px 18px',
                              boxShadow: rec.recommended ? '0 6px 20px rgba(79,70,229,.1)' : '0 1px 2px rgba(16,24,40,.04)',
                            }}
                          >
                            <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                              {meta?.icon ?? '🎮'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                <span style={{ fontSize: 15.5, fontWeight: 700, color: '#1b2333' }}>{rec.name}</span>
                                {rec.recommended && (
                                  <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4f46e5', background: '#eef0fe', border: '1px solid #dfe1fc', borderRadius: 7, padding: '2px 8px' }}>
                                    Đề xuất
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13.5, color: '#5b6577', lineHeight: 1.5 }}>{rec.intro}</div>
                            </div>
                            <span style={{ flexShrink: 0, alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: '#4f46e5' }}>
                              Chọn
                              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h11M11 5l5 5-5 5"/></svg>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Chosen-game confirmation */}
                  {chosenGame && (
                    <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 9, background: '#eef0fe', border: '1px solid #dfe1fc', borderRadius: 11, padding: '8px 13px' }}>
                      <span style={{ fontSize: 18 }}>{getTemplateByBackendId(chosenGame.template_id)?.icon ?? '🎮'}</span>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#3730a3' }}>Trò chơi đã chọn: {chosenGame.name}</span>
                    </div>
                  )}

                  {/* Pipeline card */}
                  {stages.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '6px 18px', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)' }}>
                      {stages.map((stage, i) => (
                        <div key={stage.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '14px 0', borderBottom: i < stages.length - 1 ? '1px solid #f1f2f6' : 'none' }}>
                          <StageCircle status={stage.status} size={30} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{stage.label}</div>
                            <div style={{ fontSize: 13, color: '#8b94a6', marginTop: 1 }}>{stage.subtitle !== '...' ? stage.subtitle : ''}</div>
                          </div>
                          {stage.tag && (
                            <span style={{
                              flexShrink: 0, alignSelf: 'center', fontSize: 12, fontWeight: 500,
                              color: stage.tagType === 'indigo' ? '#4f46e5' : '#5b6577',
                              background: stage.tagType === 'indigo' ? '#eef0fe' : '#f3f4f8',
                              border: `1px solid ${stage.tagType === 'indigo' ? '#dfe1fc' : '#e9ebf1'}`,
                              borderRadius: 7, padding: '3px 9px',
                            }}>
                              {stage.tag}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Safety gate card */}
                  {safetyReport && (
                    <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 8px 24px rgba(16,24,40,.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid #f1f2f6', background: '#fbfcfe' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#eef0fe', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="#4f46e5" strokeWidth="1.7" strokeLinejoin="round"><path d="M10 2.5l6 2v4.5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8V4.5z"/><path d="M7.4 10l1.8 1.8 3.6-3.8" strokeLinecap="round"/></svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>Kiểm định nội dung &amp; an toàn</div>
                          <div style={{ fontSize: 12.5, color: '#8b94a6' }}>Bộ kiểm định tự động trước khi xuất bản</div>
                        </div>
                        {hasWarning ? (
                          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#b06f00', background: '#fdf3e0', border: '1px solid #f3deb0', borderRadius: 9, padding: '5px 11px' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d98a04' }}/>
                            Đạt · 1 cảnh báo
                          </span>
                        ) : (
                          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#047a55', background: '#e7f7f0', border: '1px solid #c4ecd9', borderRadius: 9, padding: '5px 11px' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0d9f6e' }}/>
                            Đạt toàn bộ
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '6px 18px' }}>
                        {safetyReport.checks.map((check, i) => (
                          <div key={check.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '13px 0', borderBottom: i < safetyReport.checks.length - 1 ? '1px solid #f4f5f8' : 'none' }}>
                            <SafetyCircle status={check.status} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{check.label}</div>
                              <div style={{ fontSize: 12.5, color: '#8b94a6', marginTop: 1 }}>{check.detail}</div>
                            </div>
                            <span style={{ flexShrink: 0, alignSelf: 'center', fontSize: 12.5, fontWeight: 600, color: check.status === 'pass' ? '#047a55' : '#b06f00' }}>
                              {check.status === 'pass' ? 'Đạt' : check.status === 'fixed' ? 'Đã khắc phục' : 'Không đạt'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post-gate card */}
                  {postGate.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '6px 18px', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)' }}>
                      {postGate.map((step, i) => (
                        <div key={step.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '14px 0', borderBottom: i < postGate.length - 1 ? '1px solid #f1f2f6' : 'none' }}>
                          <StageCircle status={step.status} size={30} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{step.label}</div>
                            <div style={{ fontSize: 13, color: '#8b94a6', marginTop: 1 }}>{step.subtitle}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Guardrail block card */}
                  {guardrailBlock && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: '16px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>⚠️</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Nội dung ngoài phạm vi hỗ trợ</span>
                      </div>
                      <div style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.55, marginBottom: 8 }}>{guardrailBlock.message}</div>
                      <div style={{ fontSize: 13, color: '#a16207', fontStyle: 'italic' }}>💡 {guardrailBlock.suggestion}</div>
                    </div>
                  )}

                  {/* Error card */}
                  {error && (
                    <div style={{ background: '#fff0f0', border: '1px solid #fecaca', borderRadius: 16, padding: '16px 18px' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#e11d48', marginBottom: 4 }}>Có lỗi xảy ra</div>
                      <div style={{ fontSize: 13, color: '#e11d48' }}>{error}</div>
                    </div>
                  )}

                  {/* Ready card */}
                  {result && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(180deg,#f3f4ff,#eef0fe)', border: '1px solid #dfe1fc', borderRadius: 16, padding: '18px 20px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15.5, fontWeight: 700 }}>Trò chơi đã sẵn sàng</div>
                        <div style={{ fontSize: 13.5, color: '#5b6577', marginTop: 2 }}>Xem trước, chỉnh sửa từng câu rồi duyệt &amp; xuất bản cho lớp của bạn.</div>
                      </div>
                      <button onClick={handlePreview} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 14.5, padding: '12px 20px', borderRadius: 11, boxShadow: '0 6px 16px rgba(79,70,229,.28)' }}>
                        Xem trước &amp; duyệt
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h11M11 5l5 5-5 5"/></svg>
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div style={{ flexShrink: 0, background: '#f4f5f8', padding: '8px 24px 22px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', border: '1px solid #e3e6ee', borderRadius: 18, boxShadow: '0 2px 6px rgba(16,24,40,.05),0 12px 30px rgba(16,24,40,.06)', padding: '13px 15px' }}>
            {/* Chips row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 11 }}>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#3730a3', background: '#eef0fe', border: '1px solid #e0e2fb', borderRadius: 9, padding: '5px 11px', cursor: 'pointer' }}>
                Môn: {subject}
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                <select value={subject} onChange={e => setSubject(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </label>

              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#475067', background: '#f1f3f7', border: '1px solid #e7e9f0', borderRadius: 9, padding: '5px 11px', cursor: 'pointer' }}>
                Lớp {grade}
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                <select value={grade} onChange={e => setGrade(Number(e.target.value))} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  {GRADES.map(g => <option key={g} value={g}>Lớp {g}</option>)}
                </select>
              </label>

              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#475067', background: '#f1f3f7', border: '1px solid #e7e9f0', borderRadius: 9, padding: '5px 11px', cursor: 'pointer' }}>
                Độ khó: {diffLabel}
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </label>
            </div>

            {/* Textarea */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
              placeholder="Mô tả trò chơi bạn muốn tạo, hoặc yêu cầu chỉnh sửa…"
              disabled={isRunning || loadingRecs}
              rows={2}
              style={{
                width: '100%', border: 'none', outline: 'none', resize: 'none',
                fontSize: 15, color: '#1b2333', fontFamily: 'inherit',
                background: 'transparent', padding: '2px 4px 10px',
                lineHeight: 1.5,
              }}
            />

            {/* Attached-file chip */}
            {attachedFileName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: '#92400e', marginBottom: 8 }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9l-4.5 4.5a2.5 2.5 0 01-3.5-3.5l5-5a1.6 1.6 0 012.3 2.3l-5 5"/></svg>
                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFileName}</span>
                <button onClick={removeAttachment} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', padding: '0 2px', lineHeight: 1, fontSize: 15, fontWeight: 700 }} title="Gỡ tệp">×</button>
              </div>
            )}
            {attachError && (
              <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 6 }}>{attachError}</div>
            )}

            {/* Bottom row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                style={{ display: 'none' }}
                onChange={handleFileAttach}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning || loadingRecs}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  border: attachedFileName ? '1px solid #fcd34d' : '1px solid #e3e6ee',
                  background: attachedFileName ? '#fef9ee' : '#fff',
                  color: attachedFileName ? '#92400e' : '#5b6577',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
                  padding: '7px 12px', borderRadius: 9,
                  cursor: isRunning || loadingRecs ? 'not-allowed' : 'pointer',
                  opacity: isRunning || loadingRecs ? 0.5 : 1,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9l-4.5 4.5a2.5 2.5 0 01-3.5-3.5l5-5a1.6 1.6 0 012.3 2.3l-5 5"/></svg>
                {attachedFileName ? 'Thay tệp' : 'Đính kèm'}
              </button>
              <div style={{ marginLeft: 'auto', width: 42, height: 42, borderRadius: '50%', background: isRunning || loadingRecs || !prompt.trim() ? '#c7c5f7' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isRunning || loadingRecs || !prompt.trim() ? 'not-allowed' : 'pointer', boxShadow: isRunning || loadingRecs || !prompt.trim() ? 'none' : '0 5px 14px rgba(79,70,229,.3)', transition: 'all .15s ease' }} onClick={handleSubmit}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 16V5M5 10l5-5 5 5"/></svg>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
