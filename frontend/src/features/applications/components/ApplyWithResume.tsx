import { PdfDocumentViewer } from '../../resumes/PdfDocumentViewer'
import { ApplicationAiStatus } from './ApplicationAiStatus'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/providers/auth-context'
import { ApiError } from '../../../services/api'
import { applyToJob, getApplications } from '../../../services/application.service'
import { cvDocumentUrl, getCvDocuments } from '../../../services/resume.service'
import type { CvDocument } from '../../../services/resume.service'
import './applications.css'
import '../../resumes/cv-pdf-import.css'
import { jobApplicationPath } from '../../jobs/candidate-job-route'
export function ApplyWithResume({
  jobId,
  onBusy,
  onSubmitted,
  preferredDocumentId,
}: {
  jobId: string
  preferredDocumentId?: string
  onBusy: (busy: boolean) => void
  onSubmitted?: () => void
}) {
  const { user } = useAuth()
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    documents?: CvDocument[]
    applied?: boolean
    applicationId?: string
    error?: string
  } | null>(null)
  const [selected, setSelected] = useState('')
  const [letter, setLetter] = useState('')
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedId, setSubmittedId] = useState('')
  const [error, setError] = useState('')
  const key = `${jobId}:${user?.id}:${retry}`
  const current = result?.key === key ? result : null
  useEffect(() => {
    if (user?.role !== 'CANDIDATE') return
    let active = true
    Promise.all([
      getCvDocuments(),
      getApplications(false, new URLSearchParams({ jobId, size: '1' })),
    ])
      .then(([documents, apps]) => {
        if (!active) return
        const preferred = documents.find((d) => d.id === preferredDocumentId)
        const selected =
          preferred ??
          documents.find((d) => d.isDefault) ??
          documents.find((d) => d.confirmedAt) ??
          documents[0]
        setSelected(selected ? `pdf:${selected.id}` : '')
        setResult({
          key,
          documents,
          applied: apps.totalElements > 0,
          applicationId: apps.content[0]?.id,
        })
      })
      .catch((e) => {
        if (active) setResult({ key, error: e instanceof Error ? e.message : 'Không tải được CV.' })
      })
    return () => {
      active = false
    }
  }, [key, jobId, user?.role, preferredDocumentId])
  if (!user)
    return (
      <div className="empty-state">
        <h3>Đăng nhập để gửi hồ sơ</h3>
        <p>Đơn sẽ gắn với tài khoản và CV đã lưu của bạn.</p>
        <Link className="button" to="/login" state={{ from: jobApplicationPath(jobId) }}>
          Đăng nhập
        </Link>
      </div>
    )
  if (user.role !== 'CANDIDATE') return <p>Tính năng nộp đơn dành cho tài khoản ứng viên.</p>
  if (!current) return <p role="status">Đang kiểm tra đơn và CV đã lưu…</p>
  if (current.error)
    return (
      <div role="alert">
        <p>{current.error}</p>
        <button className="button secondary" onClick={() => setRetry(retry + 1)}>
          Thử lại
        </button>
      </div>
    )
  if (submitted || current.applied)
    return (
      <div className="success-panel" role="status">
        <h3>
          {submitted ? 'Đã gửi hồ sơ đến nhà tuyển dụng' : 'Bạn đã nộp đơn cho công việc này'}
        </h3>
        <p>CV và công việc lúc nộp đã được lưu trong đơn.</p>
        {(submittedId || current.applicationId) && (
          <ApplicationAiStatus applicationId={submittedId || current.applicationId!} />
        )}
        <Link className="button" to="/applications">
          Theo dõi đơn ứng tuyển
        </Link>
        {(submittedId || current.applicationId) && (
          <p>
            <Link
              to={`/applications?application=${encodeURIComponent(submittedId || current.applicationId!)}&tab=clarifications`}
            >
              Bổ sung thông tin cho HR · Không bắt buộc
            </Link>
          </p>
        )}
      </div>
    )
  if (!current.documents?.length)
    return (
      <div className="empty-state">
        <h3>Chọn một CV để gửi</h3>
        <p>Tải CV PDF của bạn lên để gửi ngay. AI sẽ phân tích sau khi nộp.</p>
        <div className="modal-actions">
          <Link className="button secondary" to={`/profile?tab=cv&jobId=${jobId}`}>
            Tải CV PDF
          </Link>
        </div>
      </div>
    )
  const document = current.documents?.find((d) => `pdf:${d.id}` === selected)
  async function submit() {
    if (!document || saving.current) return
    saving.current = true
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      const application = await applyToJob(
        jobId,
        null,
        null,
        letter,
        'ORIGINAL_PDF',
        document.id,
        document.confirmedAt ? document.reviewVersion : undefined,
      )
      setSubmittedId(application.id)
      setSubmitted(true)
      onSubmitted?.()
    } catch (e) {
      if (e instanceof ApiError && (e.status === 0 || e.status === 409)) {
        try {
          const apps = await getApplications(false, new URLSearchParams({ jobId, size: '1' }))
          if (apps.totalElements > 0) {
            setSubmittedId(apps.content[0].id)
            setSubmitted(true)
            onSubmitted?.()
            return
          }
        } catch {
          setError(
            'Chưa xác nhận được hồ sơ đã gửi. Mở Đơn ứng tuyển để kiểm tra trước khi gửi lại.',
          )
          return
        }
      }
      setError(e instanceof Error ? e.message : 'Không gửi được hồ sơ.')
    } finally {
      saving.current = false
      setBusy(false)
      onBusy(false)
    }
  }
  return (
    <form
      className="stack-form real-apply-form"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <fieldset className="cv-source-choice">
        <legend>Chọn CV gửi cho nhà tuyển dụng</legend>
        {current.documents?.map((d) => (
          <label key={d.id}>
            <input
              type="radio"
              name="selectedCv"
              value={`pdf:${d.id}`}
              checked={selected === `pdf:${d.id}`}
              disabled={busy}
              onChange={() => setSelected(`pdf:${d.id}`)}
            />
            {d.title} · PDF riêng{d.isDefault ? ' · Mặc định' : ''}
          </label>
        ))}
        <Link to={`/profile?tab=cv&jobId=${encodeURIComponent(jobId)}`}>Tải thêm CV PDF</Link>
      </fieldset>
      {document && (
        <details className="application-ready-preview" open>
          <summary>Xem lại CV sẽ gửi · {document.title}</summary>
          <div className="submitted-cv">
            <a href={cvDocumentUrl(document.id)} target="_blank" rel="noreferrer">
              Mở PDF sẽ gửi
            </a>
            <PdfDocumentViewer title="PDF sẽ gửi" url={cvDocumentUrl(document.id)} />
            <p role="status">
              {document.confirmedAt
                ? 'Thông tin bạn đã xác nhận sẽ được lưu cùng PDF gốc.'
                : 'Bạn có thể gửi PDF ngay. AI sẽ đọc và đối chiếu sau khi nộp; HR vẫn xem được file gốc trong lúc chờ.'}
            </p>
            <Link
              to={`/profile?${new URLSearchParams({ tab: 'cv', jobId, documentId: document.id })}`}
            >
              Kiểm tra thông tin AI đọc (tùy chọn)
            </Link>
          </div>
        </details>
      )}
      <label>
        Thư ứng tuyển (tùy chọn)
        <textarea
          maxLength={10000}
          disabled={busy}
          value={letter}
          onChange={(e) => setLetter(e.target.value)}
          placeholder="Vì sao bạn quan tâm đến vị trí này?"
        />
      </label>
      <p className="muted small-text">
        PDF gốc được lưu cố định cùng đơn. Không cần chờ AI hoặc xác nhận dữ liệu trích xuất để ứng
        tuyển. Nếu AI chưa khả dụng, hồ sơ vẫn đến HR; kết quả phân tích sẽ được bổ sung khi xử lý
        thành công. Thay đổi CV sau khi nộp không làm đổi hồ sơ đã gửi.
      </p>
      {error && (
        <div role="alert">
          <p className="form-error">{error}</p>
          <button type="button" className="button secondary" onClick={() => setRetry(retry + 1)}>
            Tải lại CV và đơn
          </button>
        </div>
      )}
      <button className="button" disabled={busy || !document} type="submit">
        {busy ? 'Đang gửi hồ sơ…' : 'Xác nhận gửi hồ sơ'}
      </button>
    </form>
  )
}
