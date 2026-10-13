import { ApplicationAiStatus } from './ApplicationAiStatus'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/providers/auth-context'
import { ApiError } from '../../../services/api'
import { applyToJob, getApplications } from '../../../services/application.service'
import { getMyResumes } from '../../../services/resume.service'
import { CvPreview } from '../../resumes/CvPreview'
import type { Resume } from '../../../types/domain'
import './applications.css'
import { jobApplicationPath } from '../../jobs/candidate-job-route'
export function ApplyWithResume({
  jobId,
  onBusy,
  onSubmitted,
  preferredResumeId,
}: {
  jobId: string
  preferredResumeId?: string
  onBusy: (busy: boolean) => void
  onSubmitted?: () => void
}) {
  const { user } = useAuth()
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    resumes?: Resume[]
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
    Promise.all([getMyResumes(), getApplications(false, new URLSearchParams({ jobId, size: '1' }))])
      .then(([resumes, apps]) => {
        if (!active) return
        const ready = resumes.filter((r) => r.status === 'READY')
        setSelected(
          (
            ready.find((r) => r.id === preferredResumeId) ??
            ready.find((r) => r.isDefault) ??
            ready[0]
          )?.id ?? '',
        )
        setResult({
          key,
          resumes: ready,
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
  }, [key, jobId, user?.role, preferredResumeId])
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
      </div>
    )
  if (!current.resumes?.length)
    return (
      <div className="empty-state">
        <h3>Bạn cần một CV đã hoàn tất</h3>
        <p>CV bản nháp chưa thể nộp. Tạo CV mới hoặc mở một CV đang có để hoàn tất.</p>
        <div className="modal-actions">
          <Link className="button" to={`/cv-builder?jobId=${jobId}`}>
            Tạo CV
          </Link>
          <Link className="button secondary" to={`/profile?tab=cv&jobId=${jobId}`}>
            CV của tôi
          </Link>
        </div>
      </div>
    )
  const resume = current.resumes.find((r) => r.id === selected)
  async function submit() {
    if (!resume || saving.current) return
    saving.current = true
    setBusy(true)
    onBusy(true)
    setError('')
    try {
      const application = await applyToJob(jobId, resume.id, resume.version, letter)
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
      <label>
        CV đã hoàn tất
        <select
          aria-label="Chọn CV đã hoàn tất"
          value={selected}
          disabled={busy}
          onChange={(e) => setSelected(e.target.value)}
        >
          {current.resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
              {r.isDefault ? ' · Mặc định' : ''}
            </option>
          ))}
        </select>
      </label>
      {resume && (
        <details className="application-ready-preview" open>
          <summary>Xem lại CV sẽ gửi · {resume.title}</summary>
          <div className="submitted-cv">
            <CvPreview draft={resume} skills={resume.skills} />
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
        Sau khi gửi, nội dung năng lực trong CV và JD được AI (Groq hoặc Gemini dự phòng) phân tích
        để hỗ trợ đối chiếu và thống kê ẩn danh. Họ tên, email và số điện thoại không được gửi tới
        AI. Bản CV đã lưu sẽ được gửi cùng đơn. Thay đổi chưa lưu trong trình tạo CV không nằm trong
        hồ sơ này.
      </p>
      {error && (
        <div role="alert">
          <p className="form-error">{error}</p>
          <button type="button" className="button secondary" onClick={() => setRetry(retry + 1)}>
            Tải lại CV và đơn
          </button>
        </div>
      )}
      <button className="button" disabled={busy || !resume} type="submit">
        {busy ? 'Đang gửi hồ sơ…' : 'Xác nhận gửi hồ sơ'}
      </button>
    </form>
  )
}
