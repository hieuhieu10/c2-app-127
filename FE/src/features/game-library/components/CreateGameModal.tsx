'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameDefinition } from '@/features/game-shells/registry'
import { beWebApi } from '@/features/game-library/services/be-web'

const SUBJECTS = ['Toán', 'Tiếng Việt', 'Khoa học', 'Lịch sử', 'Địa lý', 'Tiếng Anh']
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const DIFFICULTIES: { label: string; value: 'easy' | 'medium' | 'hard' }[] = [
  { label: 'Dễ', value: 'easy' },
  { label: 'Trung bình', value: 'medium' },
  { label: 'Khó', value: 'hard' },
]
const SUPPORTED_TYPES = ['.txt', '.md', '.csv', '.json']

type Phase = 'form' | 'running' | 'error' | 'blocked'

interface CreateGameModalProps {
  game: GameDefinition
  onClose: () => void
}

export function CreateGameModal({ game, onClose }: CreateGameModalProps) {
  const router = useRouter()

  const [subject, setSubject] = useState('Toán')
  const [grade, setGrade] = useState(4)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [prompt, setPrompt] = useState('')
  const [sourceText, setSourceText] = useState<string | null>(null)
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null)
  const [attachError, setAttachError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('form')
  const [stageLabel, setStageLabel] = useState('Đang chuẩn bị…')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [guardrail, setGuardrail] = useState<{ message: string; suggestion: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isRunning = phase === 'running'

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
      setSourceText(ev.target?.result as string)
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

  const handleGenerate = async () => {
    const promptText = prompt.trim()
    if (!promptText || isRunning) return

    setPhase('running')
    setErrorMessage(null)
    setGuardrail(null)
    setStageLabel('Đang khởi tạo phiên làm việc…')

    try {
      const session = await beWebApi.createChatSession()

      setStageLabel('Đang kiểm tra yêu cầu…')
      const recommend = await beWebApi.recommendChat(session.id, {
        subject,
        grade,
        difficulty,
        prompt: promptText,
        sourceText,
        attachedFileName,
      })

      // The recommend step also runs the safety guardrail. If it blocks the
      // request, surface the explanation instead of generating.
      if (recommend.assistantMessage.messageType === 'guardrail') {
        const payload = recommend.assistantMessage.payloadJson ?? {}
        setGuardrail({
          message: typeof payload.message === 'string' ? payload.message : recommend.assistantMessage.content,
          suggestion: typeof payload.suggestion === 'string' ? payload.suggestion : 'Vui lòng điều chỉnh yêu cầu và thử lại.',
        })
        setPhase('blocked')
        return
      }

      const promptMessageId = recommend.userMessage.id

      // Force this card's template via override_template (templateId) so the
      // pipeline skips its own recommendation step.
      for await (const event of beWebApi.generateChat(session.id, {
        templateId: game.backendId,
        promptMessageId,
      })) {
        if (event.type === 'stage') {
          setStageLabel(event.label || stageLabel)
          continue
        }
        if (event.type === 'complete') {
          router.push(`/dashboard/lesson/${event.lessonId}/validate/${event.gameId}`)
          return
        }
        if (event.type === 'error') {
          setErrorMessage(event.message || 'Tạo trò chơi thất bại.')
          setPhase('error')
          return
        }
      }

      // Stream ended without a complete event.
      setErrorMessage('Quá trình tạo trò chơi kết thúc bất ngờ. Vui lòng thử lại.')
      setPhase('error')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Lỗi không xác định.')
      setPhase('error')
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#475067', marginBottom: 6, display: 'block' }
  const selectStyle: React.CSSProperties = {
    width: '100%', height: 40, borderRadius: 10, border: '1px solid #dbe1eb', background: '#f8faff',
    padding: '0 12px', fontSize: 14, color: '#1b2333', outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
  }

  return (
    <div
      onClick={() => { if (!isRunning) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540, maxHeight: '90dvh', overflowY: 'auto',
          background: '#fff', borderRadius: 18, boxShadow: '0 24px 60px rgba(15,23,42,.28)',
          fontFamily: "'Be Vietnam Pro', sans-serif", color: '#1b2333',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '20px 22px', borderBottom: '1px solid #eef0f4' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, flexShrink: 0 }}>
            {game.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 700 }}>Tạo trò chơi: {game.title}</div>
            <div style={{ fontSize: 13, color: '#8b94a6', marginTop: 1 }}>Điền thông tin bài học rồi tạo trò chơi ngay.</div>
          </div>
          <button
            type="button"
            onClick={() => { if (!isRunning) onClose() }}
            disabled={isRunning}
            aria-label="Đóng"
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: 'none', background: '#f1f3f7', color: '#5b6577', cursor: isRunning ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: isRunning ? 0.5 : 1 }}
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l10 10M15 5L5 15" /></svg>
          </button>
        </div>

        {/* Running state */}
        {phase === 'running' ? (
          <div style={{ padding: '38px 22px 42px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', marginBottom: 18 }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 600, marginBottom: 6 }}>Đang tạo trò chơi…</div>
            <div style={{ fontSize: 13.5, color: '#8b94a6' }}>{stageLabel}</div>
          </div>
        ) : phase === 'blocked' && guardrail ? (
          <div style={{ padding: '22px' }}>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Nội dung ngoài phạm vi hỗ trợ</span>
              </div>
              <div style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.55, marginBottom: 8 }}>{guardrail.message}</div>
              <div style={{ fontSize: 13, color: '#a16207', fontStyle: 'italic' }}>💡 {guardrail.suggestion}</div>
            </div>
            <button
              type="button"
              onClick={() => setPhase('form')}
              style={{ marginTop: 16, width: '100%', border: '1px solid #d8def0', cursor: 'pointer', background: '#f8faff', color: '#4338ca', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, padding: '11px', borderRadius: 11 }}
            >
              Chỉnh lại yêu cầu
            </button>
          </div>
        ) : (
          <div style={{ padding: '20px 22px 22px' }}>
            {/* Subject / Grade / Difficulty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Môn học</label>
                <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}>
                  {SUBJECTS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Lớp</label>
                <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} style={selectStyle}>
                  {GRADES.map((item) => <option key={item} value={item}>Lớp {item}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Độ khó</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')} style={selectStyle}>
                  {DIFFICULTIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>

            {/* Prompt */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Mô tả bài học / mục tiêu</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ví dụ: Ôn tập bảng nhân 6 và 7 cho học sinh lớp 3, khoảng 10 câu."
                rows={4}
                style={{
                  width: '100%', borderRadius: 12, border: '1px solid #dbe1eb', background: '#f8faff',
                  padding: '11px 13px', fontSize: 14, color: '#1b2333', outline: 'none', resize: 'vertical',
                  fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Upload */}
            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>Tài liệu tham khảo (không bắt buộc)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                style={{ display: 'none' }}
                onChange={handleFileAttach}
              />
              {attachedFileName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef9ee', border: '1px solid #fcd34d', borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#92400e' }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9l-4.5 4.5a2.5 2.5 0 01-3.5-3.5l5-5a1.6 1.6 0 012.3 2.3l-5 5" /></svg>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFileName}</span>
                  <button type="button" onClick={removeAttachment} title="Gỡ tệp" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', padding: '0 2px', lineHeight: 1, fontSize: 16, fontWeight: 700 }}>×</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px dashed #c7cede', background: '#fbfcff', color: '#5b6577', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500, padding: '10px 14px', borderRadius: 10, cursor: 'pointer' }}
                >
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9l-4.5 4.5a2.5 2.5 0 01-3.5-3.5l5-5a1.6 1.6 0 012.3 2.3l-5 5" /></svg>
                  Đính kèm tệp (.txt, .md, .csv, .json)
                </button>
              )}
              {attachError ? <div style={{ fontSize: 12.5, color: '#dc2626', marginTop: 6 }}>{attachError}</div> : null}
            </div>

            {phase === 'error' && errorMessage ? (
              <div style={{ marginTop: 16, background: '#fff0f0', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#e11d48', marginBottom: 2 }}>Có lỗi xảy ra</div>
                <div style={{ fontSize: 13, color: '#e11d48' }}>{errorMessage}</div>
              </div>
            ) : null}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ border: '1px solid #e3e6ee', background: '#fff', color: '#5b6577', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, padding: '11px 18px', borderRadius: 11, cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={!prompt.trim()}
                style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  border: 'none', cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                  background: prompt.trim() ? '#4f46e5' : '#c7c5f7', color: '#fff',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: 14.5, padding: '11px', borderRadius: 11,
                  boxShadow: prompt.trim() ? '0 5px 14px rgba(79,70,229,.28)' : 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="#fff"><path d="M10 2l1.7 4.6L16.5 8l-4.8 1.4L10 14l-1.7-4.6L3.5 8l4.8-1.4z" /></svg>
                Tạo trò chơi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
