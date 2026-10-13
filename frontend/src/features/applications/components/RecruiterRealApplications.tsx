import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { JobApplicationCharts } from '../../jobs/components/JobApplicationCharts'
import {
  applicationStages,
  getApplications,
  getApplicationSummary,
  submittedDate,
} from '../../../services/application.service'
import type { ApplicationPage, ApplicationSummary } from '../../../services/application.service'
import { TopCandidatesWidget } from './TopCandidatesWidget'
export function RecruiterRealApplications({
  jobId,
  onJobId,
  lockedJob = false,
  onSelect,
  refreshKey = 0,
}: {
  jobId: string
  onJobId: (id: string) => void
  lockedJob?: boolean
  onSelect: (id: string, tab?: string) => void
  refreshKey?: number
}) {
  const [params, setParams] = useSearchParams()
  const stage = Object.keys(applicationStages).find((value) => value === params.get('stage')) ?? ''
  const search = params.get('search')?.slice(0, 200) ?? ''
  const rawPage = Number(params.get('page') ?? 0)
  const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 100000 ? rawPage : 0
  const updateFilters = useCallback(
    (values: Record<string, string>) => {
      setParams(
        () => {
          const next = new URLSearchParams(window.location.search)
          for (const [key, value] of Object.entries(values)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: ApplicationPage
    error?: string
  } | null>(null)
  const [summary, setSummary] = useState<{
    key: string
    data?: ApplicationSummary
    error?: string
  } | null>(null)
  const key = JSON.stringify([jobId, stage, search, page, retry, refreshKey])
  const summaryKey = JSON.stringify([jobId, retry, refreshKey])
  const current = result?.key === key ? result : null
  const counts = summary?.key === summaryKey ? summary : null
  const [allJobs, setAllJobs] = useState<ApplicationSummary['jobs']>([])
  useEffect(() => {
    if (lockedJob) return
    let active = true
    getApplicationSummary()
      .then((s) => {
        if (active) setAllJobs(s.jobs)
      })
      .catch(() => {
        if (active) setAllJobs([])
      })
    return () => {
      active = false
    }
  }, [lockedJob, retry, refreshKey])
  useEffect(() => {
    let active = true
    getApplicationSummary(jobId)
      .then((data) => {
        if (active) setSummary({ key: summaryKey, data })
      })
      .catch((e) => {
        if (active)
          setSummary({
            key: summaryKey,
            error: e instanceof Error ? e.message : 'Không tải được thống kê.',
          })
      })
    return () => {
      active = false
    }
  }, [jobId, summaryKey])
  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ stage, search, page: String(page), size: '10' })
    if (jobId) params.set('jobId', jobId)
    getApplications(true, params)
      .then((data) => {
        if (active) {
          const lastPage = Math.max(0, data.totalPages - 1)
          if (page > lastPage) updateFilters({ page: String(lastPage) })
          setResult({ key, data })
        }
      })
      .catch((e) => {
        if (active)
          setResult({ key, error: e instanceof Error ? e.message : 'Không tải được hồ sơ.' })
      })
    return () => {
      active = false
    }
  }, [key, jobId, stage, search, page, updateFilters])
  return (
    <section className="hr-panel">
      <TopCandidatesWidget
        jobId={jobId}
        refreshKey={refreshKey}
        onSelect={(applicationId, tab) => onSelect(applicationId, tab)}
      />
      <div className="hr-panel-heading">
        <div>
          <h2>
            {lockedJob
              ? 'Hồ sơ ứng tuyển'
              : jobId
                ? 'Đơn ứng tuyển theo công việc'
                : 'Tất cả đơn ứng tuyển'}
          </h2>
          <p>
            {lockedJob
              ? 'Chỉ gồm đơn nộp vào tin này. CV được giữ nguyên tại thời điểm ứng viên nộp.'
              : 'Danh sách đơn trên toàn công ty, có thể lọc theo công việc và vòng tuyển dụng. Một ứng viên nộp nhiều công việc sẽ có các đơn riêng.'}
          </p>
        </div>
        <button className="hr-button secondary" onClick={() => setRetry(retry + 1)}>
          Làm mới
        </button>
      </div>
      <div className="hr-filter-bar">
        <label className="hr-search">
          <input
            aria-label="Tìm ứng viên"
            placeholder="Tên, email hoặc công việc…"
            maxLength={200}
            value={search}
            onChange={(e) => {
              updateFilters({ search: e.target.value, page: '' })
            }}
          />
        </label>
        {!lockedJob && (
          <select
            aria-label="Lọc công việc ứng tuyển"
            value={jobId}
            onChange={(e) => {
              onJobId(e.target.value)
            }}
          >
            <option value="">Tất cả công việc</option>
            {jobId && !allJobs.some((j) => j.jobId === jobId) && (
              <option value={jobId}>Công việc đang chọn</option>
            )}
            {allJobs.map((j) => (
              <option key={j.jobId} value={j.jobId}>
                {j.title} ({j.count})
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Lọc vòng tuyển dụng"
          value={stage}
          onChange={(e) => {
            updateFilters({ stage: e.target.value, page: '' })
          }}
        >
          <option value="">Tất cả các vòng</option>
          {Object.entries(applicationStages).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {counts?.error && (
        <p className="hr-field-error" role="alert">
          {counts.error}
        </p>
      )}
      <div className="hr-pipeline" aria-label="Lọc theo vòng tuyển dụng">
        {['', ...Object.keys(applicationStages)].map((value) => (
          <button
            key={value}
            className={stage === value ? 'active' : ''}
            data-stage={value || 'ALL'}
            aria-pressed={stage === value}
            onClick={() => {
              updateFilters({ stage: stage === value ? '' : value, page: '' })
            }}
          >
            <span>
              {value ? applicationStages[value as keyof typeof applicationStages] : 'Tất cả'}
            </span>
            <strong>
              {counts?.data
                ? value
                  ? counts.data.stages[value as keyof typeof applicationStages]
                  : counts.data.total
                : '—'}
            </strong>
            <small>hồ sơ</small>
          </button>
        ))}
      </div>
      {!current ? (
        <p role="status">Đang tải hồ sơ…</p>
      ) : current.error ? (
        <div className="hr-empty" role="alert">
          <p>{current.error}</p>
          <button className="hr-button secondary" onClick={() => setRetry(retry + 1)}>
            Thử lại
          </button>
        </div>
      ) : !current.data?.content.length ? (
        <div className="hr-empty">
          <h3>
            {counts?.data?.total ? 'Không tìm thấy hồ sơ theo bộ lọc' : 'Chưa có hồ sơ ứng tuyển'}
          </h3>
          <p>Đơn sẽ xuất hiện khi ứng viên gửi CV cho công việc.</p>
          {(stage || search) && (
            <button
              className="hr-button secondary"
              onClick={() => {
                updateFilters({ stage: '', search: '', page: '' })
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hr-table-scroll">
            <table className="hr-table hr-applications-table">
              <thead>
                <tr>
                  <th>Ứng viên</th>
                  <th>Công việc ứng tuyển</th>
                  <th>Ngày nộp</th>
                  <th>Vòng tuyển dụng</th>
                  <th>Đánh giá AI</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {current.data.content.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Ứng viên">
                      <button className="hr-job-title" onClick={() => onSelect(a.id)}>
                        {a.name}
                      </button>
                      <small>{a.email}</small>
                    </td>
                    <td data-label="Công việc ứng tuyển">
                      {a.jobTitle}
                      <small>{a.resumeTitle}</small>
                    </td>
                    <td data-label="Ngày nộp">{submittedDate(a.appliedAt)}</td>
                    <td data-label="Vòng tuyển dụng">
                      <span className={`hr-stage hr-stage-${a.status.toLowerCase()}`}>
                        {applicationStages[a.status]}
                      </span>
                    </td>
                    <td data-label="Đánh giá AI">
                      <button className="hr-text-button" onClick={() => onSelect(a.id, 'ai')}>
                        {a.aiScore == null ? 'Chưa phân tích' : `${a.aiScore}/100 · Xem AI`}
                      </button>
                    </td>
                    <td data-label="Chi tiết">
                      <button
                        className="hr-text-button"
                        aria-label={`Xem hồ sơ ${a.name}`}
                        onClick={() => onSelect(a.id)}
                      >
                        Xem hồ sơ →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="application-pagination">
            <span>
              {current.data.totalElements} hồ sơ · Trang {page + 1}/{current.data.totalPages}
            </span>
            <button
              className="hr-button secondary"
              disabled={page === 0}
              onClick={() => updateFilters({ page: String(page - 1) })}
            >
              Trước
            </button>
            <button
              className="hr-button secondary"
              disabled={page + 1 >= current.data.totalPages}
              onClick={() => updateFilters({ page: String(page + 1) })}
            >
              Tiếp
            </button>
          </div>
        </>
      )}
      <p className="hr-panel-note">
        Số lượng các vòng tính trên toàn bộ đơn của công việc đang chọn, trước khi lọc tên/vòng và
        phân trang. Điểm AI lấy từ kết quả đã lưu gần nhất; hồ sơ chưa đánh giá không tính thành 0
        điểm.
      </p>
    </section>
  )
}
export function RecruiterRealJobSummary({
  jobId,
  title,
  onAll,
  onSelect,
  refreshKey = 0,
}: {
  jobId: string
  title: string
  onAll: () => void
  onSelect: (id: string, tab?: string) => void
  refreshKey?: number
}) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: ApplicationSummary
    error?: string
  } | null>(null)
  const key = `${jobId}:${retry}:${refreshKey}`
  const current = result?.key === key ? result : null
  useEffect(() => {
    let active = true
    getApplicationSummary(jobId)
      .then((data) => {
        if (active) setResult({ key, data })
      })
      .catch((e) => {
        if (active)
          setResult({ key, error: e instanceof Error ? e.message : 'Không tải được thống kê.' })
      })
    return () => {
      active = false
    }
  }, [key, jobId])
  return (
    <section className="hr-job-candidates">
      <h2>{title}</h2>
      {!current ? (
        <p role="status">Đang tải tổng hợp…</p>
      ) : current.error ? (
        <div role="alert">
          <p>{current.error}</p>
          <button className="hr-button secondary" onClick={() => setRetry(retry + 1)}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <div className="hr-job-candidate-stats">
            <div>
              <strong>{current.data?.total}</strong>
              <span>Hồ sơ của tin này</span>
            </div>
            <div>
              <strong>{current.data?.assessed ?? 0}</strong>
              <span>Có kết quả AI</span>
            </div>
            <div>
              <strong>{(current.data?.total ?? 0) - (current.data?.assessed ?? 0)}</strong>
              <span>Chưa phân tích</span>
            </div>
          </div>
          <JobApplicationCharts
            total={current.data?.total ?? 0}
            assessed={current.data?.assessed ?? 0}
            stages={current.data?.stages ?? {}}
          />
          {current.data?.priority.length ? (
            <>
              <h3>Ứng viên ưu tiên xem</h3>
              <p>
                Tối đa 5 hồ sơ đang nộp, xem xét hoặc phỏng vấn, xếp theo điểm AI đã lưu gần nhất.
                HR vẫn xem được tất cả hồ sơ.
              </p>
              <div className="hr-job-candidate-list">
                {current.data.priority.map((a) => (
                  <article key={a.id}>
                    <div className="hr-job-candidate-heading">
                      <h4>{a.name}</h4>
                      <span className="hr-assessment-badge hr-assessment-completed">
                        {a.aiScore}/100
                      </span>
                    </div>
                    <span className={`hr-stage hr-stage-${a.status.toLowerCase()}`}>
                      {applicationStages[a.status]}
                    </span>
                    <p>{a.aiSummary}</p>
                    <div className="hr-row-actions">
                      <button className="hr-text-button" onClick={() => onSelect(a.id)}>
                        Xem hồ sơ →
                      </button>
                      <button className="hr-text-button" onClick={() => onSelect(a.id, 'ai')}>
                        Xem đánh giá AI →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="hr-empty">
              <h3>Chưa có hồ sơ để xếp ưu tiên</h3>
              <p>
                Hồ sơ chưa có đánh giá hoặc đã kết thúc vẫn nằm trong danh sách đầy đủ. Mở hồ sơ và
                chọn Đánh giá AI để phân tích.
              </p>
            </div>
          )}
        </>
      )}
      <button className="hr-button" onClick={onAll}>
        Xem tất cả hồ sơ →
      </button>
    </section>
  )
}
