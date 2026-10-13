import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../../components/ui/Modal'
import {
  getApplications,
  applicationStages,
  submittedDate,
} from '../../../services/application.service'
import type { ApplicationPage } from '../../../services/application.service'
import { SubmittedApplicationDetail } from '../components/SubmittedApplicationDetail'
export function ApplicationsPage() {
  const [stage, setStage] = useState('')
  const [page, setPage] = useState(0)
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState<{
    key: string
    data?: ApplicationPage
    error?: string
  } | null>(null)
  const key = JSON.stringify([stage, page, retry])
  const current = result?.key === key ? result : null
  useEffect(() => {
    let active = true
    getApplications(false, new URLSearchParams({ stage, page: String(page), size: '10' }))
      .then((data) => {
        if (active) setResult({ key, data })
      })
      .catch((e) => {
        if (active)
          setResult({ key, error: e instanceof Error ? e.message : 'Không tải được đơn.' })
      })
    return () => {
      active = false
    }
  }, [key, stage, page])
  return (
    <div className="container inner-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">HỒ SƠ ĐÃ GỬI</span>
          <h1>
            Hành trình ứng tuyển<span className="orange-dot">.</span>
          </h1>
          <p>Theo dõi đơn đã gửi và xem lại đúng bản CV tại lúc nộp.</p>
        </div>
        <Link className="button secondary" to="/">
          Khám phá công việc
        </Link>
      </div>
      <div className="application-filters">
        <label>
          Trạng thái{' '}
          <select
            aria-label="Lọc trạng thái đơn"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value)
              setPage(0)
            }}
          >
            <option value="">Tất cả</option>
            {Object.entries(applicationStages).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" onClick={() => setRetry(retry + 1)}>
          Làm mới
        </button>
        <span>{current?.data ? `${current.data.totalElements} đơn` : ''}</span>
      </div>
      {!current ? (
        <p role="status">Đang tải đơn ứng tuyển…</p>
      ) : current.error ? (
        <div role="alert">
          <p>{current.error}</p>
          <button className="button" onClick={() => setRetry(retry + 1)}>
            Thử lại
          </button>
        </div>
      ) : !current.data?.content.length ? (
        <div className="empty-state bordered">
          <h3>{stage ? 'Không có đơn ở trạng thái này' : 'Bạn chưa gửi đơn nào'}</h3>
          <p>
            {stage
              ? 'Chọn trạng thái khác để xem hồ sơ.'
              : 'Chọn một công việc đang tuyển và nộp bằng CV đã hoàn tất.'}
          </p>
        </div>
      ) : (
        <>
          <div className="application-list">
            {current.data.content.map((a) => (
              <article className="application-row" key={a.id}>
                <div className="grow">
                  <button className="text-title" onClick={() => setSelected(a.id)}>
                    {a.jobTitle}
                  </button>
                  <p>
                    {a.resumeTitle} · Nộp {submittedDate(a.appliedAt)}
                  </p>
                </div>
                <span className="status-badge">{applicationStages[a.status]}</span>
                <button className="button secondary" onClick={() => setSelected(a.id)}>
                  Xem hồ sơ đã gửi
                </button>
              </article>
            ))}
          </div>
          <div className="application-pagination">
            <button
              className="button secondary"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Trước
            </button>
            <span>
              Trang {page + 1}/{current.data.totalPages}
            </span>
            <button
              className="button secondary"
              disabled={page + 1 >= current.data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Tiếp
            </button>
          </div>
        </>
      )}
      {selected && (
        <Modal title="Hồ sơ đã gửi" wide onClose={() => setSelected('')}>
          <SubmittedApplicationDetail key={selected} id={selected} />
        </Modal>
      )}
    </div>
  )
}
