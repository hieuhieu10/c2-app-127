'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppSidebar } from '@/components/layout/AppSidebar'
import {
  type CompleteEvent,
  type GameRecommendation,
  type SafetyReport,
  type StageStatus,
} from '@/features/game-creation/ai-api'
import { getTemplateByBackendId } from '@/features/game-creation/template-registry'
import {
  beWebApi,
  type BeWebChatMessage,
  type BeWebCompleteEvent,
} from '@/features/game-library/services/be-web'

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
  numItems: number | null
  sourceText: string | null
  attachedFileName?: string | null
}

interface GeneratedResult extends CompleteEvent {
  assistantMessageId?: number
  gameId?: number
  lessonId?: number
}

interface UserChatMessageView {
  id: string
  backendId?: number
  role: 'user'
  form: SentForm
}

interface AssistantChatMessageView {
  id: string
  backendId?: number
  role: 'assistant'
  kind: 'recommendations' | 'guardrail' | 'generation'
  status: 'loading' | 'done' | 'error'
  promptMessageId?: number
  recommendationMessageId?: number
  recommendations?: GameRecommendation[]
  guardrail?: { message: string; suggestion: string } | null
  selectedGame?: GameRecommendation | null
  stages: PipelineStage[]
  postGate: PostGateStep[]
  safetyReport: SafetyReport | null
  result: GeneratedResult | null
  error?: string | null
}

type ChatMessageView = UserChatMessageView | AssistantChatMessageView

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

function makeTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getDifficultyLabel(value: string) {
  return DIFFICULTIES.find((item) => item.value === value)?.label ?? 'Trung bình'
}

function extractNumItemsFromPrompt(promptText: string): number | null {
  const normalized = promptText.toLowerCase()
  const patterns = [
    /(?:gồm|co|có|tao|tạo|sinh|generate)?\s*(\d{1,2})\s*(?:cau hoi|câu hỏi|cau|câu)\b/u,
    /(?:cau hoi|câu hỏi|cau|câu)\s*(?:so|số)?\s*(\d{1,2})\b/u,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    if (!match) continue
    const parsed = Number(match[1])
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 20) {
      return parsed
    }
  }

  return null
}

function buildSentForm(promptText: string, payload: Record<string, unknown>): SentForm {
  return {
    subject: typeof payload.subject === 'string' ? payload.subject : 'Toán',
    grade: typeof payload.grade === 'number' ? payload.grade : 4,
    difficulty: typeof payload.difficulty === 'string' ? payload.difficulty : 'medium',
    prompt: promptText,
    numItems: typeof payload.numItems === 'number' ? payload.numItems : null,
    sourceText: typeof payload.sourceText === 'string' ? payload.sourceText : null,
    attachedFileName: typeof payload.attachedFileName === 'string' ? payload.attachedFileName : null,
  }
}

function buildSelectedGame(payload: Record<string, unknown> | null | undefined): GameRecommendation | null {
  if (!payload) return null
  const templateId = typeof payload.template_id === 'string' ? payload.template_id : null
  if (!templateId) return null
  const meta = getTemplateByBackendId(templateId)
  return {
    template_id: templateId,
    name: typeof payload.name === 'string' ? payload.name : (meta?.title ?? templateId),
    intro: typeof payload.intro === 'string' ? payload.intro : '',
    recommended: Boolean(payload.recommended),
  }
}

function buildGeneratedResult(raw: Record<string, unknown> | null | undefined): GeneratedResult | null {
  if (!raw) return null
  if (typeof raw.template_id !== 'string' || typeof raw.template_name !== 'string' || !isRecord(raw.content) || !isRecord(raw.safety_report)) {
    return null
  }
  return {
    type: 'complete',
    template_id: raw.template_id,
    template_name: raw.template_name,
    content: raw.content,
    safety_report: raw.safety_report as unknown as SafetyReport,
    elapsed_ms: typeof raw.elapsed_ms === 'number' ? raw.elapsed_ms : 0,
    assistantMessageId: typeof raw.assistantMessageId === 'number' ? raw.assistantMessageId : undefined,
    gameId: typeof raw.gameId === 'number' ? raw.gameId : undefined,
    lessonId: typeof raw.lessonId === 'number' ? raw.lessonId : undefined,
  }
}

function mapChatMessage(message: BeWebChatMessage): ChatMessageView | null {
  const payload = isRecord(message.payloadJson) ? message.payloadJson : {}

  if (message.role === 'user' && message.messageType === 'user_prompt') {
    return {
      id: String(message.id),
      backendId: message.id,
      role: 'user',
      form: buildSentForm(message.content, payload),
    }
  }

  if (message.role !== 'assistant') return null

  if (message.messageType === 'recommendations') {
    return {
      id: String(message.id),
      backendId: message.id,
      role: 'assistant',
      kind: 'recommendations',
      status: message.status === 'error' ? 'error' : 'done',
      promptMessageId: typeof payload.promptMessageId === 'number' ? payload.promptMessageId : undefined,
      recommendations: Array.isArray(payload.recommendations) ? payload.recommendations as GameRecommendation[] : [],
      stages: [],
      postGate: [],
      safetyReport: null,
      result: null,
      error: message.status === 'error' ? message.content : null,
    }
  }

  if (message.messageType === 'guardrail') {
    return {
      id: String(message.id),
      backendId: message.id,
      role: 'assistant',
      kind: 'guardrail',
      status: message.status === 'error' ? 'error' : 'done',
      promptMessageId: typeof payload.promptMessageId === 'number' ? payload.promptMessageId : undefined,
      guardrail: {
        message: typeof payload.message === 'string' ? payload.message : message.content,
        suggestion: typeof payload.suggestion === 'string' ? payload.suggestion : '',
      },
      stages: [],
      postGate: [],
      safetyReport: null,
      result: null,
      error: message.status === 'error' ? message.content : null,
    }
  }

  if (message.messageType === 'generation_result') {
    const selectedPayload = isRecord(payload.selectedTemplate) ? payload.selectedTemplate : null
    const resultPayload = isRecord(payload.result) ? payload.result : null
    return {
      id: String(message.id),
      backendId: message.id,
      role: 'assistant',
      kind: 'generation',
      status: message.status === 'running' ? 'loading' : message.status === 'error' ? 'error' : 'done',
      promptMessageId: typeof payload.promptMessageId === 'number' ? payload.promptMessageId : undefined,
      recommendationMessageId: typeof payload.recommendationMessageId === 'number' ? payload.recommendationMessageId : undefined,
      selectedGame: buildSelectedGame(selectedPayload),
      stages: [],
      postGate: [],
      safetyReport: resultPayload?.safety_report ? (resultPayload.safety_report as unknown as SafetyReport) : null,
      result: buildGeneratedResult(resultPayload),
      error: typeof payload.error === 'string' ? payload.error : (message.status === 'error' ? message.content : null),
    }
  }

  return null
}

function createUserMessageView(tempId: string, form: SentForm): UserChatMessageView {
  return { id: tempId, role: 'user', form }
}

function createLoadingRecommendationMessage(tempId: string): AssistantChatMessageView {
  return {
    id: tempId,
    role: 'assistant',
    kind: 'recommendations',
    status: 'loading',
    stages: [],
    postGate: [],
    safetyReport: null,
    result: null,
  }
}

function createLoadingGenerationMessage(
  tempId: string,
  recommendation: GameRecommendation,
  promptMessageId?: number,
  recommendationMessageId?: number,
): AssistantChatMessageView {
  return {
    id: tempId,
    role: 'assistant',
    kind: 'generation',
    status: 'loading',
    promptMessageId,
    recommendationMessageId,
    selectedGame: recommendation,
    stages: PIPELINE_STAGE_DEFS.map((stage) => ({ ...stage })),
    postGate: [],
    safetyReport: null,
    result: null,
  }
}

function NewGamePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [subject, setSubject] = useState('Toán')
  const [grade, setGrade] = useState(4)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [prompt, setPrompt] = useState('')
  const [numItems, setNumItems] = useState<number | null>(null)
  const [sourceText, setSourceText] = useState<string | null>(null)
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)

  const [sessionId, setSessionId] = useState<number | null>(null)
  const [sessionTitle, setSessionTitle] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessageView[]>([])
  const [loadingSession, setLoadingSession] = useState(false)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [activeGenerationMessageId, setActiveGenerationMessageId] = useState<string | null>(null)

  const threadRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skipHydrationRef = useRef<number | null>(null)

  const SUPPORTED_TYPES = ['.txt', '.md', '.csv', '.json']
  const hasMessages = chatMessages.length > 0
  const sessionParam = searchParams.get('session')
  const firstPrompt = chatMessages.find((message) => message.role === 'user')?.form.prompt ?? null
  const pageTitle = sessionTitle || firstPrompt || 'Trò chơi mới'
  const diffLabel = getDifficultyLabel(difficulty)

  const scrollDown = () => {
    setTimeout(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!sessionParam) {
      setSessionId(null)
      setSessionTitle(null)
      setChatMessages([])
      setLoadingSession(false)
      return
    }

    const parsedId = Number(sessionParam)
    if (!Number.isFinite(parsedId)) {
      return
    }

    if (skipHydrationRef.current === parsedId) {
      skipHydrationRef.current = null
      setLoadingSession(false)
      return
    }

    if (sessionId === parsedId && chatMessages.length > 0) {
      setLoadingSession(false)
      return
    }

    setLoadingSession(true)
    beWebApi.getChatSession(parsedId)
      .then((session) => {
        setSessionId(session.id)
        setSessionTitle(session.title)
        setChatMessages(session.messages.map(mapChatMessage).filter(Boolean) as ChatMessageView[])
        setSubject(session.subject ?? 'Toán')
        setGrade(session.grade ?? 4)
        setDifficulty((session.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard')
        setNumItems(session.numItems)
        setSourceText(session.sourceText ?? null)
      })
      .catch(() => {
        setSessionId(null)
        setSessionTitle(null)
        setChatMessages([])
      })
      .finally(() => {
        setLoadingSession(false)
        scrollDown()
      })
  }, [sessionParam])

  const handleFileAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ''
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

  const ensureSession = async () => {
    if (sessionId) return sessionId
    const created = await beWebApi.createChatSession()
    setSessionId(created.id)
    skipHydrationRef.current = created.id
    router.replace(`/dashboard/game/new?session=${created.id}`)
    return created.id
  }

  const updateAssistantMessage = (targetId: string, updater: (message: AssistantChatMessageView) => AssistantChatMessageView) => {
    setChatMessages((prev) => prev.map((message) => {
      if (message.id !== targetId || message.role !== 'assistant') return message
      return updater(message)
    }))
  }

  const handleSubmit = async () => {
    if (isRunning || loadingRecs) return
    const promptText = prompt.trim()
    if (!promptText) return

    const resolvedNumItems = numItems ?? extractNumItemsFromPrompt(promptText)
    const form: SentForm = { subject, grade, difficulty, prompt: promptText, numItems: resolvedNumItems, sourceText, attachedFileName }
    const tempUserId = makeTempId('user')
    const tempAssistantId = makeTempId('recommend')
    const recommendPayload = {
      subject,
      grade,
      difficulty,
      prompt: promptText,
      sourceText,
      attachedFileName,
    }

    setPrompt('')
    setLoadingRecs(true)
    setChatMessages((prev) => [
      ...prev,
      createUserMessageView(tempUserId, form),
      createLoadingRecommendationMessage(tempAssistantId),
    ])
    scrollDown()

    try {
      const currentSessionId = await ensureSession()
      const response = await beWebApi.recommendChat(currentSessionId, recommendPayload)

      setSessionTitle((prev) => prev || response.session.title || promptText)
      setChatMessages((prev) => prev.map((message) => {
        if (message.id === tempUserId) return mapChatMessage(response.userMessage) ?? message
        if (message.id === tempAssistantId) return mapChatMessage(response.assistantMessage) ?? message
        return message
      }))
    } catch (error) {
      updateAssistantMessage(tempAssistantId, (message) => ({
        ...message,
        status: 'error',
        error: error instanceof Error ? error.message : 'Lỗi không xác định',
      }))
    } finally {
      setLoadingRecs(false)
      scrollDown()
    }
  }

  const handleChooseGame = async (
    recommendation: GameRecommendation,
    promptMessageId?: number,
    recommendationMessageId?: number,
  ) => {
    if (isRunning) return
    const currentSessionId = sessionId
    if (!currentSessionId) return

    const tempAssistantId = makeTempId('generate')
    let seconds = 0

    setIsRunning(true)
    setElapsedSec(0)
    setActiveGenerationMessageId(tempAssistantId)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      seconds += 1
      setElapsedSec(seconds)
    }, 1000)

    setChatMessages((prev) => [
      ...prev,
      createLoadingGenerationMessage(tempAssistantId, recommendation, promptMessageId, recommendationMessageId),
    ])
    scrollDown()

    try {
      for await (const event of beWebApi.generateChat(currentSessionId, {
        templateId: recommendation.template_id,
        promptMessageId,
        recommendationMessageId,
      })) {
        if (event.type === 'stage') {
          updateAssistantMessage(tempAssistantId, (message) => {
            if (['parse_pdf', 'rag', 'recommend', 'generate'].includes(event.id)) {
              return {
                ...message,
                stages: message.stages.map((stage) => (
                  stage.id === event.id ? { ...stage, status: event.status, subtitle: event.subtitle } : stage
                )),
              }
            }
            if (event.id === 'schema' || event.id === 'build') {
              const exists = message.postGate.find((step) => step.id === event.id)
              return {
                ...message,
                postGate: exists
                  ? message.postGate.map((step) => (
                    step.id === event.id ? { ...step, status: event.status, subtitle: event.subtitle } : step
                  ))
                  : [...message.postGate, { id: event.id, label: event.label, subtitle: event.subtitle, status: event.status }],
              }
            }
            return message
          })
          scrollDown()
          continue
        }

        if (event.type === 'safety') {
          updateAssistantMessage(tempAssistantId, (message) => ({
            ...message,
            safetyReport: event.report,
          }))
          scrollDown()
          continue
        }

        if (event.type === 'complete') {
          const completeEvent = event as BeWebCompleteEvent
          updateAssistantMessage(tempAssistantId, (message) => ({
            ...message,
            backendId: completeEvent.assistantMessageId,
            status: 'done',
            result: {
              type: 'complete',
              template_id: completeEvent.template_id,
              template_name: completeEvent.template_name,
              content: completeEvent.content,
              safety_report: completeEvent.safety_report,
              elapsed_ms: completeEvent.elapsed_ms,
              assistantMessageId: completeEvent.assistantMessageId,
              gameId: completeEvent.gameId,
              lessonId: completeEvent.lessonId,
            },
            safetyReport: completeEvent.safety_report,
          }))
          setIsRunning(false)
          setActiveGenerationMessageId(null)
          if (timerRef.current) clearInterval(timerRef.current)
          scrollDown()
          continue
        }

        if (event.type === 'error') {
          updateAssistantMessage(tempAssistantId, (message) => ({
            ...message,
            status: 'error',
            error: event.message,
          }))
          setIsRunning(false)
          setActiveGenerationMessageId(null)
          if (timerRef.current) clearInterval(timerRef.current)
          scrollDown()
        }
      }
    } catch (error) {
      updateAssistantMessage(tempAssistantId, (message) => ({
        ...message,
        status: 'error',
        error: error instanceof Error ? error.message : 'Lỗi không xác định',
      }))
      setIsRunning(false)
      setActiveGenerationMessageId(null)
      if (timerRef.current) clearInterval(timerRef.current)
      scrollDown()
    }
  }

  const openGeneratedResult = (message: AssistantChatMessageView) => {
    const result = message.result
    if (!result) return

    if (result.lessonId && result.gameId) {
      router.push(`/dashboard/lesson/${result.lessonId}/validate/${result.gameId}`)
      return
    }

    sessionStorage.setItem('gamePreviewData', JSON.stringify({
      templateId: result.template_id,
      templateName: result.template_name,
      content: result.content,
      safetyReport: result.safety_report,
      metadata: {
        subject,
        grade,
        difficulty,
        prompt: firstPrompt ?? 'Trò chơi mới',
        elapsed_ms: result.elapsed_ms,
      },
    }))
    router.push('/dashboard/game/preview')
  }

  const renderAssistantIntro = (message: AssistantChatMessageView) => {
    if (message.kind === 'recommendations') {
      if (message.status === 'loading') {
        return <>Đang phân tích yêu cầu và chọn trò chơi phù hợp…</>
      }
      if (message.status === 'error') {
        return <span style={{ color: '#e11d48' }}>Có lỗi xảy ra</span>
      }
      return <>Dựa trên bài học của bạn, đây là những trò chơi phù hợp. Chọn một trò chơi để mình tạo nội dung.</>
    }

    if (message.kind === 'guardrail') {
      return <>Mình chưa thể xử lý yêu cầu này. Bạn có thể chỉnh lại mô tả rồi gửi tiếp.</>
    }

    if (message.result) {
      return <>Mình đã chạy xong quy trình tạo trò chơi <span style={{ color: '#9aa2b2' }}>· hoàn tất trong {Math.round(message.result.elapsed_ms / 1000)} giây</span></>
    }

    if (message.status === 'loading') {
      return <>Đang tạo trò chơi <b>{message.selectedGame?.name}</b>… <span style={{ color: '#9aa2b2' }}>{activeGenerationMessageId === message.id ? elapsedSec : 0}s</span></>
    }

    return <span style={{ color: '#e11d48' }}>Có lỗi xảy ra</span>
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', fontFamily: "'Be Vietnam Pro', sans-serif", background: '#f4f5f8', color: '#1b2333', overflow: 'hidden', fontSize: 15 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <AppSidebar />

      <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ height: 60, flexShrink: 0, borderBottom: '1px solid #e9ebf1', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 26px', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pageTitle.slice(0, 40) + (pageTitle.length > 40 ? '…' : '')}
            </span>
            <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: '#b06f00', background: '#fdf3e0', border: '1px solid #f5e2bb', borderRadius: 7, padding: '3px 9px' }}>Bản nháp</span>
          </div>
        </header>

        <div
          ref={threadRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: hasMessages ? 'auto' : 'hidden',
            overflowX: 'hidden',
            background: '#f4f5f8',
          }}
        >
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '30px 24px 14px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            {loadingSession ? (
              <div style={{ textAlign: 'center', padding: '60px 0 20px', color: '#9aa2b2' }}>Đang tải lịch sử chat…</div>
            ) : null}

            {!loadingSession && !hasMessages && (
              <div style={{ textAlign: 'center', padding: '60px 0 20px', color: '#9aa2b2' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eef0fe', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <svg width="24" height="24" viewBox="0 0 20 20" fill="#4f46e5"><path d="M10 2l1.7 4.6L16.5 8l-4.8 1.4L10 14l-1.7-4.6L3.5 8l4.8-1.4z"/></svg>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1b2333', marginBottom: 6 }}>Tạo trò chơi học tập</div>
                <div style={{ fontSize: 13.5 }}>Mô tả trò chơi bạn muốn tạo và bấm gửi để bắt đầu.</div>
              </div>
            )}

            {chatMessages.map((message) => {
              if (message.role === 'user') {
                return (
                  <div key={message.id} style={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
                    <div style={{ background: '#4f46e5', color: '#fff', borderRadius: '16px 16px 5px 16px', padding: '14px 16px', boxShadow: '0 6px 18px rgba(79,70,229,.22)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,.18)', borderRadius: 7, padding: '3px 9px' }}>Môn: {message.form.subject}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,.18)', borderRadius: 7, padding: '3px 9px' }}>Lớp {message.form.grade}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 500, background: 'rgba(255,255,255,.18)', borderRadius: 7, padding: '3px 9px' }}>
                          Độ khó: {getDifficultyLabel(message.form.difficulty)}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, lineHeight: 1.5 }}>{message.form.prompt}</div>
                    </div>
                  </div>
                )
              }

              return (
                <div key={message.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="#4f46e5"><path d="M10 2l1.7 4.6L16.5 8l-4.8 1.4L10 14l-1.7-4.6L3.5 8l4.8-1.4z"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 14, color: '#5b6577' }}>{renderAssistantIntro(message)}</div>

                    {message.kind === 'recommendations' && message.recommendations && message.recommendations.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {message.recommendations.map((recommendation) => {
                          const meta = getTemplateByBackendId(recommendation.template_id)
                          return (
                            <button
                              key={`${message.id}-${recommendation.template_id}`}
                              onClick={() => void handleChooseGame(recommendation, message.promptMessageId, message.backendId)}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left', width: '100%',
                                background: '#fff', cursor: isRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                                border: `1.5px solid ${recommendation.recommended ? '#c7c5f7' : '#e9ebf1'}`,
                                borderRadius: 16, padding: '16px 18px',
                                boxShadow: recommendation.recommended ? '0 6px 20px rgba(79,70,229,.1)' : '0 1px 2px rgba(16,24,40,.04)',
                                opacity: isRunning ? 0.7 : 1,
                              }}
                              disabled={isRunning}
                            >
                              <div style={{ width: 42, height: 42, borderRadius: 12, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                                {meta?.icon ?? '🎮'}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                                  <span style={{ fontSize: 15.5, fontWeight: 700, color: '#1b2333' }}>{recommendation.name}</span>
                                  {recommendation.recommended ? (
                                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4f46e5', background: '#eef0fe', border: '1px solid #dfe1fc', borderRadius: 7, padding: '2px 8px' }}>
                                      Đề xuất
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: 13.5, color: '#5b6577', lineHeight: 1.5 }}>{recommendation.intro}</div>
                              </div>
                              <span style={{ flexShrink: 0, alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: '#4f46e5' }}>
                                Chọn
                                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h11M11 5l5 5-5 5"/></svg>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}

                    {message.selectedGame ? (
                      <div style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 9, background: '#eef0fe', border: '1px solid #dfe1fc', borderRadius: 11, padding: '8px 13px' }}>
                        <span style={{ fontSize: 18 }}>{getTemplateByBackendId(message.selectedGame.template_id)?.icon ?? '🎮'}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#3730a3' }}>Trò chơi đã chọn: {message.selectedGame.name}</span>
                      </div>
                    ) : null}

                    {message.stages.length > 0 ? (
                      <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '6px 18px', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)' }}>
                        {message.stages.map((stage, index) => (
                          <div key={stage.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '14px 0', borderBottom: index < message.stages.length - 1 ? '1px solid #f1f2f6' : 'none' }}>
                            <StageCircle status={stage.status} size={30} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{stage.label}</div>
                              <div style={{ fontSize: 13, color: '#8b94a6', marginTop: 1 }}>{stage.subtitle !== '...' ? stage.subtitle : ''}</div>
                            </div>
                            {stage.tag ? (
                              <span style={{
                                flexShrink: 0, alignSelf: 'center', fontSize: 12, fontWeight: 500,
                                color: stage.tagType === 'indigo' ? '#4f46e5' : '#5b6577',
                                background: stage.tagType === 'indigo' ? '#eef0fe' : '#f3f4f8',
                                border: `1px solid ${stage.tagType === 'indigo' ? '#dfe1fc' : '#e9ebf1'}`,
                                borderRadius: 7, padding: '3px 9px',
                              }}>
                                {stage.tag}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.safetyReport ? (
                      <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 8px 24px rgba(16,24,40,.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px', borderBottom: '1px solid #f1f2f6', background: '#fbfcfe' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 9, background: '#eef0fe', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="#4f46e5" strokeWidth="1.7" strokeLinejoin="round"><path d="M10 2.5l6 2v4.5c0 4-2.6 6.6-6 8-3.4-1.4-6-4-6-8V4.5z"/><path d="M7.4 10l1.8 1.8 3.6-3.8" strokeLinecap="round"/></svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700 }}>Kiểm định nội dung &amp; an toàn</div>
                            <div style={{ fontSize: 12.5, color: '#8b94a6' }}>Bộ kiểm định tự động trước khi xuất bản</div>
                          </div>
                          {message.safetyReport.overall === 'warning' ? (
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
                          {message.safetyReport.checks.map((check, index) => (
                            <div key={check.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '13px 0', borderBottom: index < message.safetyReport!.checks.length - 1 ? '1px solid #f4f5f8' : 'none' }}>
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
                    ) : null}

                    {message.postGate.length > 0 ? (
                      <div style={{ background: '#fff', border: '1px solid #e9ebf1', borderRadius: 16, padding: '6px 18px', boxShadow: '0 1px 2px rgba(16,24,40,.04),0 6px 20px rgba(16,24,40,.04)' }}>
                        {message.postGate.map((step, index) => (
                          <div key={step.id} style={{ display: 'flex', gap: 13, alignItems: 'flex-start', padding: '14px 0', borderBottom: index < message.postGate.length - 1 ? '1px solid #f1f2f6' : 'none' }}>
                            <StageCircle status={step.status} size={30} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{step.label}</div>
                              <div style={{ fontSize: 13, color: '#8b94a6', marginTop: 1 }}>{step.subtitle}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {message.guardrail ? (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>⚠️</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Nội dung ngoài phạm vi hỗ trợ</span>
                        </div>
                        <div style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.55, marginBottom: 8 }}>{message.guardrail.message}</div>
                        <div style={{ fontSize: 13, color: '#a16207', fontStyle: 'italic' }}>💡 {message.guardrail.suggestion}</div>
                      </div>
                    ) : null}

                    {message.error ? (
                      <div style={{ background: '#fff0f0', border: '1px solid #fecaca', borderRadius: 16, padding: '16px 18px' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#e11d48', marginBottom: 4 }}>Có lỗi xảy ra</div>
                        <div style={{ fontSize: 13, color: '#e11d48' }}>{message.error}</div>
                      </div>
                    ) : null}

                    {message.result ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(180deg,#f3f4ff,#eef0fe)', border: '1px solid #dfe1fc', borderRadius: 16, padding: '18px 20px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Trò chơi đã sẵn sàng</div>
                          <div style={{ fontSize: 13.5, color: '#5b6577', marginTop: 2 }}>Xem trước, chỉnh sửa từng câu rồi duyệt &amp; xuất bản cho lớp của bạn.</div>
                        </div>
                        <button onClick={() => openGeneratedResult(message)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 14.5, padding: '12px 20px', borderRadius: 11, boxShadow: '0 6px 16px rgba(79,70,229,.28)' }}>
                          Xem trước &amp; duyệt
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h11M11 5l5 5-5 5"/></svg>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ flexShrink: 0, background: '#f4f5f8', padding: '8px 24px 22px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto', background: '#fff', border: '1px solid #e3e6ee', borderRadius: 18, boxShadow: '0 2px 6px rgba(16,24,40,.05),0 12px 30px rgba(16,24,40,.06)', padding: '13px 15px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 11 }}>
              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#3730a3', background: '#eef0fe', border: '1px solid #e0e2fb', borderRadius: 9, padding: '5px 11px', cursor: 'pointer' }}>
                Môn: {subject}
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                <select value={subject} onChange={event => setSubject(event.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#475067', background: '#f1f3f7', border: '1px solid #e7e9f0', borderRadius: 9, padding: '5px 11px', cursor: 'pointer' }}>
                Lớp {grade}
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                <select value={grade} onChange={event => setGrade(Number(event.target.value))} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  {GRADES.map((item) => <option key={item} value={item}>Lớp {item}</option>)}
                </select>
              </label>

              <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#475067', background: '#f1f3f7', border: '1px solid #e7e9f0', borderRadius: 9, padding: '5px 11px', cursor: 'pointer' }}>
                Độ khó: {diffLabel}
                <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                <select value={difficulty} onChange={event => setDifficulty(event.target.value as 'easy' | 'medium' | 'hard')} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}>
                  {DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>

            <textarea
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSubmit()
                }
              }}
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

            {attachedFileName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '5px 10px', fontSize: 13, color: '#92400e', marginBottom: 8 }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9l-4.5 4.5a2.5 2.5 0 01-3.5-3.5l5-5a1.6 1.6 0 012.3 2.3l-5 5"/></svg>
                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFileName}</span>
                <button onClick={removeAttachment} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', padding: '0 2px', lineHeight: 1, fontSize: 15, fontWeight: 700 }} title="Gỡ tệp">×</button>
              </div>
            ) : null}
            {attachError ? (
              <div style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 6 }}>{attachError}</div>
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <div
                style={{
                  marginLeft: 'auto', width: 42, height: 42, borderRadius: '50%',
                  background: isRunning || loadingRecs || !prompt.trim() ? '#c7c5f7' : '#4f46e5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isRunning || loadingRecs || !prompt.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: isRunning || loadingRecs || !prompt.trim() ? 'none' : '0 5px 14px rgba(79,70,229,.3)',
                  transition: 'all .15s ease',
                }}
                onClick={() => void handleSubmit()}
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 16V5M5 10l5-5 5 5"/></svg>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function NewGamePage() {
  return (
    <Suspense fallback={null}>
      <NewGamePageContent />
    </Suspense>
  )
}
