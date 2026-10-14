import { ArrowUpRight, ChevronDown, Quote, RotateCw, Sparkles } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { ApiError } from '../../../services/api'
import type { JobSummary, SummaryCategory } from '../../../services/job-summary.service'
import { generateJobSummary, getJobSummary } from '../../../services/job-summary.service'
import '../styles/job-ai-summary.css'
const groups: {
  category: SummaryCategory
  label: string
  empty: string
  index: string
}[] = [
  {
    category: 'responsibilities',
    label: 'Công việc chính',
    empty: 'Chưa có ý tóm tắt. Xem mô tả công việc bên dưới.',
    index: '01',
  },
  {
    category: 'required',
    label: 'Yêu cầu bắt buộc',
    empty: 'Chưa có ý tóm tắt. Xem đầy đủ yêu cầu bên dưới.',
    index: '02',
  },
  {
    category: 'preferred',
    label: 'Yêu cầu ưu tiên',
    empty: 'Chưa có ý ưu tiên được tóm tắt từ tin này.',
    index: '03',
  },
  {
    category: 'notes',
    label: 'Điểm cần lưu ý',
    empty: 'Chưa có lưu ý được tóm tắt. Xem thông tin vị trí và quyền lợi.',
    index: '04',
  },
]
export function JobAiSummary({
  jobId,
  onRefreshJob,
}: {
  jobId: string

  onRefreshJob: () => void
}) {
  const contentId = useId()
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    attempt: number
    summary?: JobSummary
    error?: string
    refreshJob?: boolean
  } | null>(null)
  // Once opened, collapsing the panel does not cancel a paid request or generate a second one.
  const [requested, setRequested] = useState(false)
  const current = result?.attempt === attempt ? result : null
  const loading = requested && !current
  useEffect(() => {
    if (!requested) return
    let active = true
    async function load() {
      try {
        let summary = await getJobSummary(jobId)
        if (!active) return
        summary ??= await generateJobSummary(jobId)
        if (active) setResult({ attempt, summary })
      } catch (error) {
        if (active)
          setResult({
            attempt,
            refreshJob: error instanceof ApiError && [404, 409].includes(error.status),
            error:
              error instanceof ApiError
                ? error.message
                : 'Chưa thể tóm tắt lúc này. Vui lòng thử lại.',
          })
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [jobId, requested, attempt])
  return (
    <section
      className={`jd-ai ${open ? 'is-open' : ''}`}
      aria-label="Tóm tắt tin tuyển dụng bằng AI"
    >
      <button
        className="jd-ai-toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => {
          setOpen(!open)
          setRequested(true)
        }}
      >
        <span className="jd-ai-icon">
          <Sparkles size={21} />
        </span>
        <span className="jd-ai-heading">
          <span className="jd-ai-kicker">ĐỌC NHANH · HIỂU RÕ</span>
          <strong>Hiểu nhanh vị trí với AI</strong>
          <span>Những ý chính từ tin tuyển dụng, kèm căn cứ để bạn đối chiếu.</span>
        </span>
        <span className="jd-ai-toggle-label">{open ? 'Thu gọn' : 'Xem tóm tắt'}</span>
        <ChevronDown className="jd-ai-chevron" size={19} />
      </button>
      <div id={contentId} hidden={!open} className="jd-ai-body" aria-busy={loading}>
        {loading ? (
          <div className="jd-ai-message" role="status">
            <RotateCw className="jd-ai-spin" size={18} /> Đang đọc JD và đối chiếu căn cứ…
          </div>
        ) : current?.error ? (
          <div className="jd-ai-error">
            <p role="alert">{current.error}</p>
            <p>Bạn có thể tiếp tục đọc JD đầy đủ bên dưới.</p>
            <button
              className="jd-ai-retry"
              onClick={() => (current.refreshJob ? onRefreshJob() : setAttempt(attempt + 1))}
            >
              <RotateCw size={15} />
              {current.refreshJob ? 'Tải lại tin' : 'Thử lại'}
            </button>
          </div>
        ) : current?.summary ? (
          <JobSummaryContent summary={current.summary} />
        ) : null}
      </div>
    </section>
  )
}
export function JobSummaryContent({ summary }: { summary: JobSummary }) {
  const sources = new Map(summary.sources.map((source) => [source.id, source]))
  return (
    <>
      <div className="jd-ai-groups">
        {groups.map((group) => {
          const items = summary.items.filter((item) => item.category === group.category)
          return (
            <section className="jd-ai-group" key={group.category}>
              <h2>
                <span>{group.index}</span>
                {group.label}
              </h2>
              {items.length ? (
                <ul>
                  {items.map((item, index) => (
                    <li key={`${item.source_id}:${index}`}>
                      <p>{item.text}</p>
                      <details className="jd-ai-evidence">
                        <summary>
                          <Quote size={12} />
                          Xem căn cứ trong JD
                        </summary>
                        <div>
                          <span>{sources.get(item.source_id)?.label ?? 'Tin tuyển dụng'}</span>
                          <blockquote>{item.quote}</blockquote>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="jd-ai-empty">{group.empty}</p>
              )}
            </section>
          )
        })}
      </div>
      <div className="jd-ai-footer">
        <p>
          <Sparkles size={13} />
          AI tóm tắt từ JD. Hãy đọc nội dung đầy đủ trước khi ứng tuyển.
        </p>
        <a
          href="#job-overview"
          onClick={(event) => {
            const target = document.getElementById('job-overview')
            if (!target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            target.focus({ preventScroll: true })
            target.scrollIntoView({
              block: 'start',
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'auto'
                : 'smooth',
            })
          }}
        >
          Đọc JD đầy đủ
          <ArrowUpRight size={14} />
        </a>
      </div>
    </>
  )
}
