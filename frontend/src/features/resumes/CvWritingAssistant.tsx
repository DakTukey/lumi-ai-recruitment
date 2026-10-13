import { useEffect, useId, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  RotateCw,
  Sparkles,
  Undo2,
  X,
  MessageCircleQuestion,
} from 'lucide-react'
import { rewriteCvSection } from '../../services/cv-writing.service'
import type {
  CvWritingAction,
  CvWritingResult,
  CvWritingSection,
} from '../../services/cv-writing.service'
import { ApiError } from '../../services/api'
import './cv-writing.css'

const actions: { id: CvWritingAction; label: string }[] = [
  { id: 'polish', label: 'Viết rõ hơn' },
  { id: 'shorten', label: 'Rút gọn' },
  { id: 'bullets', label: 'Gạch đầu dòng' },
]

export function CvWritingAssistant({
  section,
  value,
  context,
  onApply,
}: {
  section: CvWritingSection
  value: string
  context: string
  onApply: (text: string) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<CvWritingAction>('polish')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<{
    original: string
    context: string
    action: CvWritingAction
    result: CvWritingResult
  } | null>(null)
  const [undo, setUndo] = useState<{ before: string; after: string; context: string } | null>(null)
  const sequence = useRef(0)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(
    () => () => {
      sequence.current++
    },
    [],
  )
  const stale =
    !!proposal &&
    (proposal.original !== value || proposal.context !== context || proposal.action !== action)
  const canUndo = undo && undo.after === value && undo.context === context
  const generate = async () => {
    if (!value.trim() || busy) return
    const request = ++sequence.current
    const original = value
    const sourceContext = context
    setBusy(true)
    setError('')
    setProposal(null)
    try {
      const result = await rewriteCvSection({
        section,
        action,
        text: original,
        context: sourceContext,
      })
      if (request === sequence.current)
        setProposal({ original, context: sourceContext, action, result })
    } catch (error) {
      if (request === sequence.current)
        setError(
          error instanceof ApiError
            ? error.message
            : 'Chưa tạo được gợi ý. Bạn có thể tiếp tục sửa CV và thử lại sau.',
        )
    } finally {
      if (request === sequence.current) setBusy(false)
    }
  }
  const close = () => {
    sequence.current++
    setOpen(false)
    setBusy(false)
    setError('')
    setProposal(null)
    trigger.current?.focus()
  }
  return (
    <div className="cv-ai-field">
      <div className="cv-ai-field-actions">
        <button
          type="button"
          className="cv-ai-trigger"
          ref={trigger}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <Sparkles size={13} />
          {open ? 'Đóng trợ lý' : 'AI hỗ trợ'}
          <ChevronDown size={12} />
        </button>
        {canUndo && (
          <button
            type="button"
            className="cv-ai-undo"
            onClick={() => {
              if (undo && value === undo.after && context === undo.context) {
                onApply(undo.before)
                setUndo(null)
              }
            }}
          >
            <Undo2 size={12} />
            Hoàn tác AI
          </button>
        )}
      </div>
      {open && (
        <section
          className="cv-ai-editor"
          id={id}
          aria-label="Trợ lý viết lại nội dung CV"
          aria-busy={busy}
        >
          <header>
            <span>
              <Sparkles size={15} />
              Viết từ trải nghiệm của bạn
            </span>
            <button type="button" aria-label="Đóng trợ lý viết CV" onClick={close}>
              <X size={15} />
            </button>
          </header>
          <p className="cv-ai-description">
            Giữ ý thật của bạn, diễn đạt rõ hơn. Đọc lại đề xuất trước khi áp dụng.
          </p>
          <div className="cv-ai-modes" role="group" aria-label="Cách viết lại">
            {actions.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-pressed={action === item.id}
                disabled={busy}
                onClick={() => setAction(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {!value.trim() ? (
            <div className="cv-ai-empty">
              <strong>Bắt đầu bằng vài ý ngắn</strong>
              <p>
                {section === 'summary'
                  ? 'Bạn đang học hoặc làm gì? Có kinh nghiệm, kỹ năng nào? Muốn ứng tuyển vị trí nào?'
                  : section === 'experience'
                    ? 'Bạn phụ trách việc gì, dùng công cụ nào và có kết quả thực tế gì?'
                    : 'Dự án giải quyết việc gì? Phần nào do bạn làm và dùng công nghệ nào?'}
              </p>
              <small>Điền các ý vào ô nội dung phía trên, rồi nhờ AI viết lại.</small>
            </div>
          ) : (
            <>
              <details className="cv-ai-original">
                <summary>Nội dung hiện tại</summary>
                <p>{value}</p>
              </details>
              <p className="cv-ai-disclosure">
                Khi tạo gợi ý, nội dung mục này và ngữ cảnh vai trò được gửi tới Groq; Gemini được
                dùng dự phòng khi cần.
              </p>
              {error && (
                <p className="cv-ai-error" role="alert">
                  {error}
                </p>
              )}
              {busy && (
                <p className="cv-ai-loading" role="status">
                  <RotateCw size={14} />
                  Đang viết đề xuất… Có thể mất tối đa khoảng 25 giây khi cần chuyển dịch vụ.
                </p>
              )}
              {proposal && (
                <div className="cv-ai-proposal" aria-live="polite">
                  <span className="cv-ai-eyebrow">BẢN ĐỀ XUẤT · CHƯA ÁP DỤNG</span>
                  <p className="cv-ai-proposal-text">{proposal.result.suggestion}</p>
                  {proposal.result.questions.length > 0 && (
                    <div className="cv-ai-questions">
                      <strong>
                        <MessageCircleQuestion size={14} />
                        Bạn có thể làm rõ thêm
                      </strong>
                      <ul>
                        {proposal.result.questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                      <small>Trả lời bằng cách bổ sung vào nội dung gốc, rồi tạo lại gợi ý.</small>
                    </div>
                  )}
                  {stale && (
                    <p className="cv-ai-stale" role="status">
                      Nội dung hoặc cách viết đã thay đổi. Tạo lại đề xuất để tránh ghi đè bản đang
                      sửa.
                    </p>
                  )}
                  <button
                    type="button"
                    className="cv-ai-apply"
                    disabled={stale || busy}
                    onClick={() => {
                      if (value !== proposal.original || context !== proposal.context || stale)
                        return
                      setUndo({ before: value, after: proposal.result.suggestion, context })
                      onApply(proposal.result.suggestion)
                      close()
                    }}
                  >
                    <Check size={14} />
                    Áp dụng vào mục này
                  </button>
                </div>
              )}
              <div className="cv-ai-bottom-actions">
                <button type="button" disabled={busy} onClick={() => void generate()}>
                  {proposal || error ? <RotateCw size={13} /> : <Sparkles size={13} />}
                  {busy ? 'Đang xử lý…' : proposal || error ? 'Tạo lại gợi ý' : 'Tạo gợi ý'}
                </button>
                <button type="button" onClick={close}>
                  Bỏ qua
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
