import { useEffect, useId, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  MessageCircleQuestion,
  Sparkles,
  Undo2,
} from 'lucide-react'
import type { ResumeInput } from '../../services/resume.service'
import { reviewCv, refineCv } from '../../services/cv-review.service'
import type {
  CvReviewContext,
  CvReviewItem,
  CvReviewKind,
  CvReviewResult,
  CvReviewTarget,
} from '../../services/cv-review.service'
import {
  cvReviewContext,
  reviewFingerprint,
  reviewKey,
  reviewLabel,
  reviewQuestion,
  reviewText,
  withReviewText,
} from './cv-review-model'
import './cv-review.css'

const categories: { key: CvReviewKind; label: string }[] = [
  { key: 'ADD', label: 'Cần bổ sung' },
  { key: 'CLARIFY', label: 'Cần làm rõ' },
  { key: 'REWRITE', label: 'Đề xuất chỉnh sửa' },
]
type Proposal = { text: string; answer: string; questions: string[] }
type Applied = { before: string; after: string }

export function CvReviewAssistant({
  draft,
  jobId,
  jobTitle,
  disabled,
  onApply,
  onOpenField,
  validationIssue,
}: {
  draft: ResumeInput
  jobId: string | null
  jobTitle?: string
  disabled: boolean
  onApply: (target: CvReviewTarget, text: string, expected: CvReviewContext) => boolean
  validationIssue?: { field: string; step: number; message: string }
  onOpenField: (step: number, target: string) => void
}) {
  const panelId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const sequence = useRef(0)
  const running = useRef(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<CvReviewKind | 'ALL'>('ALL')
  const [review, setReview] = useState<{
    snapshot: CvReviewContext
    jobId: string | null
    result: CvReviewResult
  } | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [proposals, setProposals] = useState<Record<string, Proposal>>({})
  const [applied, setApplied] = useState<Record<string, Applied>>({})
  useEffect(
    () => () => {
      sequence.current++
    },
    [],
  )
  const context = cvReviewContext(draft)
  const stale =
    !!review &&
    reviewFingerprint(context, jobId) !== reviewFingerprint(review.snapshot, review.jobId)
  const requestBusy = busy || !!pending
  const available = !!(
    draft.summary?.trim() ||
    draft.desiredPosition?.trim() ||
    draft.skills.length ||
    draft.experiences.length ||
    draft.projects.length ||
    draft.educations.length
  )

  const generate = async () => {
    if (running.current || disabled || validationIssue || !available) return
    running.current = true
    const request = ++sequence.current
    const snapshot = structuredClone(context)
    setBusy(true)
    setOpen(true)
    setError('')
    try {
      const result = await reviewCv(snapshot, jobId)
      if (request !== sequence.current) return
      setReview({ snapshot, jobId, result })
      setAnswers({})
      setProposals({})
      setApplied({})
      setFilter('ALL')
      requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }))
    } catch (err) {
      if (request === sequence.current)
        setError(
          err instanceof Error
            ? err.message
            : 'Chưa rà soát được. Bạn vẫn có thể chỉnh sửa và lưu CV.',
        )
    } finally {
      if (request === sequence.current) {
        setBusy(false)
        running.current = false
      }
    }
  }
  const refine = async (item: CvReviewItem) => {
    if (!review || stale || running.current || disabled) return
    const key = reviewKey(item)
    const answer = answers[key]?.trim()
    if (!answer) return
    running.current = true
    const request = ++sequence.current
    setPending(key)
    setError('')
    try {
      const result = await refineCv(review.snapshot, jobId, item, answer)
      if (request === sequence.current)
        setProposals((current) => ({
          ...current,
          [key]: { text: result.suggestion, questions: result.questions, answer },
        }))
    } catch (err) {
      if (request === sequence.current)
        setError(
          err instanceof Error
            ? err.message
            : 'Chưa tạo được đề xuất. Câu trả lời của bạn vẫn được giữ lại.',
        )
    } finally {
      if (request === sequence.current) {
        setPending('')
        running.current = false
      }
    }
  }
  const apply = (item: CvReviewItem, text: string) => {
    if (!review || stale || requestBusy || disabled) return
    const before = reviewText(review.snapshot, item)
    if (before === undefined || !onApply(item, text, review.snapshot)) {
      setError('Mục CV đã thay đổi. Hãy rà soát lại trước khi áp dụng.')
      return
    }
    setApplied((current) => ({ ...current, [reviewKey(item)]: { before, after: text } }))
    setReview({ ...review, snapshot: withReviewText(review.snapshot, item, text) })
  }
  const undo = (item: CvReviewItem) => {
    if (!review || stale || requestBusy || disabled) return
    const key = reviewKey(item),
      edit = applied[key]
    if (
      !edit ||
      reviewText(context, item) !== edit.after ||
      !onApply(item, edit.before, review.snapshot)
    )
      return
    setApplied((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setReview({ ...review, snapshot: withReviewText(review.snapshot, item, edit.before) })
  }
  const openTarget = (item: CvReviewItem) =>
    onOpenField(
      item.section === 'summary' ? 1 : 2,
      item.section === 'summary'
        ? 'cv-summary'
        : `cv-${item.section === 'experience' ? 'experiences' : 'projects'}-${item.index}-description`,
    )

  return (
    <section className="cv-review-assistant" aria-label="AI rà soát và hoàn thiện CV">
      <header className="cv-review-intro">
        <div className="cv-review-mark">
          <Sparkles size={22} />
        </div>
        <div className="cv-review-intro-copy">
          <span className="cv-review-eyebrow">TRỢ LÝ HOÀN THIỆN CV</span>
          <h2>Biến trải nghiệm thật thành một CV rõ ràng.</h2>
          <p>
            {jobId
              ? `Đối chiếu với ${jobTitle || 'tin tuyển dụng đang chọn'}, hỏi thêm và đề xuất sửa đúng mục.`
              : 'Rà soát nội dung chung theo vị trí mong muốn. Chưa đối chiếu với tin tuyển dụng cụ thể.'}
          </p>
        </div>
        <button
          type="button"
          className="button cv-review-start"
          disabled={disabled || requestBusy || !available || !!validationIssue}
          onClick={() => void generate()}
        >
          {busy ? <LoaderCircle size={17} className="cv-review-spin" /> : <Sparkles size={17} />}
          {busy ? 'Đang rà soát…' : review ? 'Rà soát lại CV' : 'AI rà soát & hoàn thiện CV'}
        </button>
      </header>
      <div className="cv-review-footnote">
        <span>Đọc CV → Hỏi làm rõ → Duyệt đề xuất → Áp dụng & lưu</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {open ? 'Thu gọn' : 'Xem cách hoạt động'}
          <ChevronDown size={14} />
        </button>
      </div>
      {validationIssue && (
        <p className="cv-review-stale">
          Hãy sửa dữ liệu trước khi rà soát: {validationIssue.message}{' '}
          <button
            type="button"
            className="cv-review-text-button"
            onClick={() => onOpenField(validationIssue.step, `cv-${validationIssue.field}`)}
          >
            Đi tới trường cần sửa
          </button>
        </p>
      )}
      {open && (
        <div className="cv-review-panel" id={panelId} aria-busy={requestBusy}>
          <p className="cv-review-disclosure">
            Khi bạn yêu cầu rà soát, nội dung năng lực trong CV và JD được gửi tới Groq hoặc Gemini
            dự phòng. Thông tin liên hệ không được tự gửi. Đề xuất chưa thay đổi CV cho đến khi bạn
            bấm Áp dụng; sau đó cần Lưu CV.
          </p>
          {!available && (
            <p>Điền vị trí mong muốn hoặc vài thông tin học vấn, dự án để AI có căn cứ hỏi bạn.</p>
          )}
          {busy && (
            <p className="cv-review-status" role="status">
              <LoaderCircle size={16} className="cv-review-spin" />
              Đang đọc nội dung và chọn những câu hỏi hữu ích…
            </p>
          )}
          {error && (
            <p className="cv-review-error" role="alert">
              {error}
            </p>
          )}
          {stale && (
            <p className="cv-review-stale" role="status">
              CV hoặc job đã thay đổi. Bấm “Rà soát lại CV” để nhận đề xuất phù hợp với nội dung
              mới. Câu trả lời hiện tại vẫn được giữ để bạn tham khảo.
            </p>
          )}
          {review && (
            <>
              <div className="cv-review-overview">
                <h3 ref={heading} tabIndex={-1}>
                  Nhận xét cho bản CV này
                </h3>
                <p>{review.result.overview}</p>
                <small>
                  {Object.keys(applied).length} / {review.result.items.length} đề xuất đã áp dụng ·
                  Bấm Lưu CV để giữ thay đổi
                </small>
              </div>
              <div className="cv-review-filters" role="group" aria-label="Loại đề xuất">
                <button
                  type="button"
                  aria-pressed={filter === 'ALL'}
                  onClick={() => setFilter('ALL')}
                >
                  Tất cả <span>{review.result.items.length}</span>
                </button>
                {categories.map((category) => (
                  <button
                    type="button"
                    key={category.key}
                    aria-pressed={filter === category.key}
                    onClick={() => setFilter(category.key)}
                  >
                    {category.label}
                    <span>
                      {review.result.items.filter((item) => item.kind === category.key).length}
                    </span>
                  </button>
                ))}
              </div>
              {!review.result.items.length && (
                <p className="cv-review-status">
                  AI chưa tìm thấy đề xuất cần ưu tiên. Hãy đọc lại CV và kiểm tra thông tin trước
                  khi lưu.
                </p>
              )}
              {!!review.result.items.length &&
                !review.result.items.some((item) => filter === 'ALL' || item.kind === filter) && (
                  <p>Không có đề xuất thuộc nhóm này.</p>
                )}
              <div className="cv-review-cards">
                {review.result.items
                  .filter((item) => filter === 'ALL' || item.kind === filter)
                  .map((item) => {
                    const key = reviewKey(item),
                      proposal = proposals[key],
                      edit = applied[key]
                    const text = proposal?.text || item.suggestion
                    const answerChanged =
                      !!proposal && proposal.answer !== (answers[key] ?? '').trim()
                    const original = edit?.before ?? reviewText(review.snapshot, item) ?? ''
                    return (
                      <article className={`cv-review-card ${edit ? 'is-applied' : ''}`} key={key}>
                        <div className="cv-review-card-heading">
                          <span className={`cv-review-kind kind-${item.kind.toLowerCase()}`}>
                            {categories.find((c) => c.key === item.kind)?.label}
                          </span>
                          {edit && (
                            <span className="cv-review-applied">
                              <Check size={13} />
                              Đã áp dụng
                            </span>
                          )}
                        </div>
                        <h4>{reviewLabel(review.snapshot, item)}</h4>
                        <p>{item.reason}</p>
                        {(item.evidence || item.job_evidence) && (
                          <details className="cv-review-evidence">
                            <summary>Căn cứ nhận xét</summary>
                            {item.evidence && (
                              <blockquote>
                                <strong>Trong CV</strong>
                                {item.evidence}
                              </blockquote>
                            )}
                            {item.job_evidence && (
                              <blockquote>
                                <strong>Trong tin tuyển dụng</strong>
                                {item.job_evidence}
                              </blockquote>
                            )}
                          </details>
                        )}
                        {!edit && (
                          <>
                            <label className="cv-review-answer">
                              <span>
                                <MessageCircleQuestion size={15} />
                                {reviewQuestion(item) ||
                                  'Bạn muốn làm rõ thêm trải nghiệm thật nào ở mục này? (Tùy chọn)'}
                              </span>
                              <textarea
                                value={answers[key] ?? ''}
                                maxLength={3000}
                                rows={3}
                                disabled={disabled || requestBusy || stale}
                                onChange={(e) =>
                                  setAnswers((current) => ({ ...current, [key]: e.target.value }))
                                }
                                placeholder="Nêu phần bạn trực tiếp làm, công cụ đã dùng và kết quả thực tế…"
                              />
                            </label>
                            <button
                              type="button"
                              className="button secondary small"
                              disabled={disabled || requestBusy || stale || !answers[key]?.trim()}
                              onClick={() => void refine(item)}
                            >
                              {pending === key ? (
                                <LoaderCircle size={14} className="cv-review-spin" />
                              ) : (
                                <ArrowRight size={14} />
                              )}{' '}
                              {pending === key ? 'Đang tạo đề xuất…' : 'Tạo đề xuất từ câu trả lời'}
                            </button>
                          </>
                        )}
                        {text && (
                          <div className="cv-review-comparison">
                            <div>
                              <span>Trước</span>
                              <p>{original || 'Chưa có nội dung'}</p>
                            </div>
                            <div>
                              <span>Đề xuất {edit ? 'đã áp dụng' : 'chưa áp dụng'}</span>
                              <p>{text}</p>
                            </div>
                          </div>
                        )}
                        {!!proposal?.questions.length && (
                          <div className="cv-review-followup">
                            <strong>Thông tin còn cần làm rõ</strong>
                            <ul>
                              {proposal.questions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                            <small>
                              Bổ sung vào câu trả lời rồi tạo lại đề xuất nếu bạn có thông tin.
                            </small>
                          </div>
                        )}
                        {answerChanged && !edit && (
                          <p className="cv-review-stale">
                            Câu trả lời đã thay đổi. Hãy tạo lại đề xuất trước khi áp dụng.
                          </p>
                        )}
                        <footer>
                          {edit ? (
                            <button
                              type="button"
                              className="cv-review-text-button"
                              disabled={disabled || requestBusy || stale}
                              onClick={() => undo(item)}
                            >
                              <Undo2 size={14} />
                              Hoàn tác mục này
                            </button>
                          ) : text ? (
                            <button
                              type="button"
                              className="button small"
                              disabled={disabled || requestBusy || stale || answerChanged}
                              onClick={() => apply(item, text)}
                            >
                              <Check size={14} />
                              Áp dụng vào CV
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="cv-review-text-button"
                            onClick={() => openTarget(item)}
                            disabled={disabled || stale}
                          >
                            Đến mục này
                            <ArrowRight size={13} />
                          </button>
                        </footer>
                      </article>
                    )
                  })}
              </div>
            </>
          )}
          {!review && !busy && (
            <p>
              AI xem nội dung Giới thiệu, Kinh nghiệm và Dự án trong ngữ cảnh toàn CV. Bạn trả lời
              bằng trải nghiệm thật, kiểm tra bản trước/sau rồi chọn áp dụng từng mục.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
