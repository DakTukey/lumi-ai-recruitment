import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileText, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { deleteResume, getMyResumes, setDefaultResume } from '../../services/resume.service'
import type { Resume } from '../../types/domain'
import './resume-library.css'

export function ResumeLibrary() {
  const [params] = useSearchParams()
  const jobId = params.get('jobId')
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    getMyResumes()
      .then((data) => {
        if (active) {
          setResumes(data)
          setLoading(false)
        }
      })
      .catch((error) => {
        if (active) {
          setError(error instanceof Error ? error.message : 'Chưa thể tải CV.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [retry])
  const reload = () => {
    setLoading(true)
    setError('')
    setRetry((value) => value + 1)
  }
  const act = async (resume: Resume, action: 'default' | 'delete') => {
    if (
      action === 'delete' &&
      !window.confirm(`Xóa CV “${resume.title}”? Thao tác này không thể khôi phục.`)
    )
      return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (action === 'delete') await deleteResume(resume.id, resume.version)
      else await setDefaultResume(resume.id, resume.version)
      setNotice(action === 'delete' ? 'Đã xóa CV.' : 'Đã đặt CV mặc định.')
      reload()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Thao tác chưa thành công.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="resume-library" aria-label="CV đã lưu">
      <div className="resume-library-heading">
        <div>
          <h3>CV đã lưu</h3>
          <p>Mỗi CV có nội dung riêng. Bạn có thể tạo nhiều bản cho các vị trí khác nhau.</p>
        </div>
        <Link
          className="button small"
          to={jobId ? `/cv-builder?jobId=${encodeURIComponent(jobId)}` : '/cv-builder'}
        >
          <Plus size={16} />
          Tạo CV mới
        </Link>
      </div>
      {notice && (
        <p className="resume-library-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="form-error">
          <p>{error}</p>
          <button className="text-button" disabled={busy} onClick={reload}>
            Tải lại danh sách
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Đang tải CV đã lưu…</p>
      ) : (
        <>
          {!error && !resumes.length && (
            <div className="resume-library-empty">
              <FileText size={28} />
              <h4>Chưa có CV đã lưu</h4>
              <p>Tạo một CV, bổ sung thông tin và bấm Lưu bản nháp để mở lại sau.</p>
            </div>
          )}
          <div className="resume-library-list">
            {resumes.map((resume) => (
              <article className="resume-library-item" key={resume.id}>
                <span className="resume-library-icon" aria-hidden="true">
                  <FileText size={22} />
                </span>
                <div className="resume-library-copy">
                  <h4>{resume.title}</h4>
                  <p>{resume.desiredPosition || 'Chưa chọn vị trí ứng tuyển'}</p>
                  <div className="resume-library-meta">
                    <span>{resume.status === 'READY' ? 'Hoàn tất' : 'Bản nháp'}</span>
                    {resume.isDefault && (
                      <span className="resume-default-badge">
                        <Star size={12} />
                        Mặc định
                      </span>
                    )}
                    <time dateTime={resume.updatedAt}>
                      Sửa {new Date(resume.updatedAt).toLocaleDateString('vi-VN')}
                    </time>
                  </div>
                </div>
                <div className="resume-library-actions">
                  <Link
                    className="button secondary small"
                    to={`/cv-builder?id=${resume.id}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ''}`}
                    aria-label={`Chỉnh sửa ${resume.title}`}
                  >
                    <Pencil size={14} />
                    Chỉnh sửa
                  </Link>
                  {!resume.isDefault && resume.status === 'READY' && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => void act(resume, 'default')}
                      aria-label={`Đặt mặc định ${resume.title}`}
                    >
                      <Star size={14} />
                      Đặt mặc định
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Xóa ${resume.title}`}
                    onClick={() => void act(resume, 'delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
