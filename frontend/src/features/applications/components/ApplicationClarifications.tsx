import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  generateClarifications,
  getClarifications,
  saveClarification,
  mergeClarifications,
} from '../../../services/application-clarification.service'
import type {
  ApplicationClarificationsData,
  ClarificationQuestion,
} from '../../../services/application-clarification.service'
import './application-clarifications.css'

const date = (value: string) => new Date(value).toLocaleString('vi-VN')
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Chưa thể kết nối. Hãy thử lại.'

export function ApplicationClarifications({
  applicationId,
  staff = false,
  onDataChange,
}: {
  applicationId: string
  staff?: boolean
  onDataChange?: (data: ApplicationClarificationsData) => void
}) {
  const [data, setData] = useState<ApplicationClarificationsData | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const mounted = useRef(true)
  const working = useRef(false)
  function receive(incoming: ApplicationClarificationsData) {
    setData((current) => {
      const merged = mergeClarifications(current, incoming)
      onDataChange?.(merged)
      return merged
    })
  }
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    let polls = 0
    async function load() {
      try {
        const result = await getClarifications(applicationId, staff)
        if (!active) return
        receive(result)
        setError('')
        // Only status reads: opening or polling this tab never invokes a model.
        if (
          ++polls < 24 &&
          (result.state === 'WAITING' ||
            result.state === 'GENERATING' ||
            (result.state === 'FAILED' && !result.canGenerate && result.canEdit))
        ) {
          timer = setTimeout(load, 5000)
        }
      } catch (error) {
        if (active) setError(errorText(error))
      }
    }
    void load()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [applicationId, staff, revision])
  async function generate() {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError('')
    try {
      const result = await generateClarifications(applicationId)
      if (mounted.current) {
        receive(result)
        setRevision((n) => n + 1)
      }
    } catch (error) {
      if (mounted.current) setError(errorText(error))
    } finally {
      working.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const answered = data?.questions.filter((q) => q.responseStatus === 'ANSWERED').length ?? 0
  return (
    <section className="clarifications" aria-labelledby="clarifications-title" aria-busy={busy}>
      <header className="clarifications-heading">
        <div>
          <span className="clarifications-eyebrow">
            {staff ? 'GÓC NHÌN TỪ ỨNG VIÊN' : 'THÊM NGỮ CẢNH CHO HỒ SƠ'}
          </span>
          <h3 id="clarifications-title">Bổ sung thông tin</h3>
          <p>
            {staff
              ? 'Câu hỏi dựa trên yêu cầu của công việc mà CV chưa thể hiện rõ.'
              : 'Giúp nhà tuyển dụng hiểu rõ hơn kinh nghiệm của bạn qua tối đa 3 câu hỏi từ AI.'}
          </p>
        </div>
        <span className="clarifications-tag">Không bắt buộc</span>
      </header>
      <div className="clarifications-note">
        {staff
          ? 'Câu trả lời do ứng viên tự cung cấp, chưa được xác minh. Hãy đối chiếu thêm khi phỏng vấn.'
          : 'Bạn có thể trả lời hoặc bỏ qua. Hồ sơ đã nộp vẫn được tiếp nhận; thông tin bổ sung không tự thay đổi điểm CV hay kết quả tuyển dụng.'}
      </div>
      {error && (
        <div className="clarifications-error" role="alert">
          {error}
        </div>
      )}
      {!data && !error && <p role="status">Đang tải thông tin bổ sung…</p>}
      {busy && (
        <p className="clarifications-state" role="status">
          <span className="clarifications-button-content">
            <Loader2 size={18} className="clarifications-spinner" />
            AI đang soạn câu hỏi từ CV và yêu cầu công việc. Bạn có thể quay lại sau.
          </span>
        </p>
      )}
      {data && data.state !== 'READY' && !busy && (
        <div className="clarifications-state" role="status">
          {data.state === 'WAITING' && (
            <>
              <h4>Chờ kết quả phân tích CV</h4>
              <p>
                Câu hỏi sẽ dựa trên bản CV đã nộp và JD lúc ứng tuyển. Bạn có thể quay lại sau khi
                phân tích hoàn tất.
              </p>
            </>
          )}
          {data.state === 'NOT_REQUESTED' && (
            <>
              <h4>
                {staff
                  ? 'Ứng viên chưa tạo câu hỏi bổ sung'
                  : 'CV chưa kể hết kinh nghiệm của bạn?'}
              </h4>
              <p>
                {staff
                  ? 'Khi ứng viên trả lời, nội dung sẽ xuất hiện tại đây.'
                  : 'AI chọn tối đa 3 yêu cầu cần làm rõ để bạn chia sẻ ví dụ, vai trò và kết quả thực tế. Câu hỏi được lưu để dùng lại.'}
              </p>
            </>
          )}
          {data.state === 'NEEDS_ANALYSIS' && (
            <>
              <h4>Cần kết quả phân tích phù hợp để tạo câu hỏi</h4>
              <p>
                {staff
                  ? 'Phân tích trước đây chưa đủ dữ liệu cho tính năng này hoặc đã gặp lỗi. Mở mục Đánh giá AI để phân tích lại hồ sơ.'
                  : 'Phân tích trước đây chưa đủ dữ liệu cho tính năng này hoặc đã gặp lỗi. Nhà tuyển dụng có thể phân tích lại; hồ sơ đã nộp của bạn vẫn được tiếp nhận.'}
              </p>
            </>
          )}
          {data.state === 'GENERATING' && (
            <>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={18} className="clarifications-spinner" />
                Đang tạo bộ câu hỏi
              </h4>
              <p>Bạn không cần bấm tạo lại. Trang sẽ tự cập nhật khi có kết quả.</p>
            </>
          )}
          {data.state === 'NOT_NEEDED' && (
            <>
              <h4>Chưa có yêu cầu cần hỏi thêm</h4>
              <p>
                Phân tích hiện tại không tìm thấy tiêu chí còn thiếu căn cứ để tạo câu hỏi. Đây
                không phải kết luận trúng tuyển.
              </p>
            </>
          )}
          {data.state === 'FAILED' && (
            <>
              <h4>Chưa tạo được câu hỏi lúc này</h4>
              <p>
                Hồ sơ đã nộp vẫn được giữ nguyên.{' '}
                {staff
                  ? 'Ứng viên có thể thử tạo lại sau.'
                  : data.canGenerate
                    ? 'Bạn có thể thử lại hoặc quay lại sau.'
                    : data.retryAt
                      ? `Có thể thử lại sau ${date(data.retryAt)}.`
                      : 'Hãy quay lại sau.'}
              </p>
            </>
          )}
        </div>
      )}
      {data?.state === 'READY' && (
        <>
          <div className="clarifications-progress">
            <strong>
              {answered}/{data.questions.length} câu đã trả lời
            </strong>
            {data.assessedAt && <span>Dựa trên phân tích ngày {date(data.assessedAt)}</span>}
          </div>
          <div className="clarifications-list">
            {data.questions.map((question, index) => (
              <QuestionCard
                key={`${question.id}:${question.version}`}
                question={question}
                index={index}
                staff={staff}
                canEdit={data.canEdit}
                applicationId={applicationId}
                onSaved={receive}
              />
            ))}
          </div>
        </>
      )}
      {data && !staff && !data.canEdit && (
        <p className="clarifications-note">
          Hồ sơ đã kết thúc. Bạn vẫn có thể xem lại thông tin đã gửi.
        </p>
      )}
      <div className="clarifications-actions">
        {data?.canGenerate && !staff && (
          <button type="button" className="button" disabled={busy} onClick={() => void generate()}>
            {busy ? (
              <span className="clarifications-button-content">
                <Loader2 size={16} className="clarifications-spinner" />
                Đang tạo câu hỏi…
              </span>
            ) : data.state === 'FAILED' ? (
              'Thử tạo lại câu hỏi'
            ) : (
              'Tạo câu hỏi gợi ý'
            )}
          </button>
        )}
        {(staff || error || data?.state !== 'READY') && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => setRevision((n) => n + 1)}
          >
            Cập nhật trạng thái
          </button>
        )}
      </div>
    </section>
  )
}

function QuestionCard({
  question: q,
  index,
  staff,
  canEdit,
  applicationId,
  onSaved,
}: {
  question: ClarificationQuestion
  index: number
  staff: boolean
  canEdit: boolean
  applicationId: string
  onSaved: (data: ApplicationClarificationsData) => void
}) {
  const [answer, setAnswer] = useState(q.answer)
  const [busy, setBusy] = useState(false)
  const [savingAction, setSavingAction] = useState<'ANSWER' | 'SKIP' | null>(null)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const working = useRef(false)
  const dirty = answer !== q.answer
  useEffect(() => {
    if (!dirty) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  async function save(action: 'ANSWER' | 'SKIP') {
    if (working.current) return
    working.current = true
    setSavingAction(action)
    setBusy(true)
    setError('')
    try {
      onSaved(await saveClarification(applicationId, q, action, answer))
    } catch (error) {
      setError(errorText(error))
      setConflict(error instanceof Error && 'status' in error && error.status === 409)
    } finally {
      working.current = false
      setSavingAction(null)
      setBusy(false)
    }
  }
  async function reload() {
    try {
      onSaved(await getClarifications(applicationId))
      setConflict(false)
      setError('')
    } catch (error) {
      setError(errorText(error))
    }
  }
  return (
    <article className="clarification-card">
      <div className="clarification-card-top">
        <span className="clarification-number">{String(index + 1).padStart(2, '0')}</span>
        <span className={`clarification-status ${q.responseStatus.toLowerCase()}`}>
          {q.responseStatus === 'ANSWERED'
            ? 'Đã gửi trả lời'
            : q.responseStatus === 'SKIPPED'
              ? 'Đã bỏ qua'
              : 'Chưa trả lời'}
        </span>
      </div>
      <p className="clarification-requirement">
        <strong>Yêu cầu cần làm rõ:</strong> {q.requirement}{' '}
        <span>· {q.required ? 'Bắt buộc trong JD' : 'Ưu tiên trong JD'}</span>
      </p>
      <h4 id={`question-${q.id}`}>{q.question}</h4>
      <details className="clarification-evidence">
        <summary>Căn cứ từ CV đã nộp</summary>
        {q.evidence ? (
          <blockquote>{q.evidence}</blockquote>
        ) : (
          <p>
            AI chưa tìm thấy đoạn CV thể hiện rõ yêu cầu này. Điều đó không có nghĩa ứng viên không
            có kinh nghiệm.
          </p>
        )}
      </details>
      {staff || !canEdit ? (
        <div className="clarification-response">
          <strong>
            {staff ? 'Câu trả lời của ứng viên · Chưa xác minh' : 'Câu trả lời đã gửi'}
          </strong>
          <p>
            {q.responseStatus === 'ANSWERED'
              ? q.answer
              : q.responseStatus === 'SKIPPED'
                ? 'Ứng viên đã chọn bỏ qua câu hỏi này.'
                : 'Chưa có câu trả lời.'}
          </p>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void save('ANSWER')
          }}
        >
          <label htmlFor={`answer-${q.id}`}>Câu trả lời của bạn</label>
          <textarea
            id={`answer-${q.id}`}
            aria-describedby={`question-${q.id} hint-${q.id}`}
            value={answer}
            maxLength={3000}
            rows={5}
            disabled={busy}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Chia sẻ một ví dụ thực tế: bạn đã làm gì, vai trò của bạn và kết quả. Nếu chưa có kinh nghiệm, bạn có thể nói rõ hoặc bỏ qua."
          />
          <div className="clarification-input-meta" id={`hint-${q.id}`}>
            <span>
              {dirty ? 'Có thay đổi chưa gửi' : 'Chỉ nội dung đã gửi mới hiển thị cho HR.'}
            </span>
            <span>{answer.length}/3000</span>
          </div>
          {error && (
            <p className="clarifications-error" role="alert">
              {error}
            </p>
          )}
          {conflict && (
            <button type="button" className="button secondary" onClick={() => void reload()}>
              Tải bản đã lưu mới nhất
            </button>
          )}
          <div className="clarifications-actions">
            <button
              className="button"
              type="submit"
              disabled={
                busy || conflict || !answer.trim() || (!dirty && q.responseStatus === 'ANSWERED')
              }
            >
              {savingAction === 'ANSWER' ? (
                <span className="clarifications-button-content">
                  <Loader2 size={16} className="clarifications-spinner" />
                  Đang lưu…
                </span>
              ) : q.responseStatus === 'ANSWERED' ? (
                'Lưu thay đổi'
              ) : (
                'Gửi câu trả lời'
              )}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={busy || conflict || q.responseStatus === 'SKIPPED'}
              onClick={() => void save('SKIP')}
            >
              {savingAction === 'SKIP' ? (
                <span className="clarifications-button-content">
                  <Loader2 size={16} className="clarifications-spinner" />
                  Đang cập nhật…
                </span>
              ) : q.responseStatus === 'ANSWERED' ? (
                'Rút câu trả lời và bỏ qua'
              ) : (
                'Bỏ qua câu này'
              )}
            </button>
          </div>
        </form>
      )}
      {q.answeredAt && <p className="clarification-time">Cập nhật {date(q.answeredAt)}</p>}
    </article>
  )
}
