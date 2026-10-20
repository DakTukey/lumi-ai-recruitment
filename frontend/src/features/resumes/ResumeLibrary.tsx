import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, FileText, Pencil, Star } from 'lucide-react'
import {
  cvDocumentUrl,
  getCvDocuments,
  getMyResumes,
  renameCvDocument,
  setDefaultCvDocument,
  uploadCvDocument,
} from '../../services/resume.service'
import type { CvDocument } from '../../services/resume.service'
import type { Resume } from '../../types/domain'
import { CvDocumentReview } from './CvDocumentReview'
import { jobApplicationPath, jobMatchPath } from '../jobs/candidate-job-route'
import { Modal } from '../../components/ui/Modal'
import { CvPreview } from './CvPreview'
import './resume-library.css'

export function ResumeLibrary() {
  const [params] = useSearchParams()
  const jobId = params.get('jobId')
  const requestedDocument = params.get('documentId')
  const [resumes, setResumes] = useState<Resume[]>([])
  const [documents, setDocuments] = useState<CvDocument[]>([])
  const [viewingResume, setViewingResume] = useState<Resume | null>(null)
  const [viewingDocument, setViewingDocument] = useState<CvDocument | null>(null)
  const [renamingDocument, setRenamingDocument] = useState<CvDocument | null>(null)
  const [reviewDirty, setReviewDirty] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([getMyResumes(), getCvDocuments()])
      .then(([history, files]) => {
        if (!active) return
        setResumes(history)
        setDocuments(files)
        setLoading(false)
        if (requestedDocument)
          setViewingDocument(files.find((d) => d.id === requestedDocument) ?? null)
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Chưa thể tải CV.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [retry, requestedDocument])
  function saved(document: CvDocument) {
    setDocuments((list) => [document, ...list.filter((d) => d.id !== document.id)])
    setViewingDocument(document)
  }
  async function uploadPdf(file?: File) {
    if (!file || busy) return
    if (!file.name.toLowerCase().endsWith('.pdf') || !file.size || file.size > 10 * 1024 * 1024) {
      setError('Chọn PDF có nội dung, tối đa 10 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      saved(await uploadCvDocument(file))
      setNotice(
        'Đã lưu PDF gốc. Bạn có thể ứng tuyển ngay; đọc và xác nhận thông tin là tùy chọn trước khi gửi.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa tải được PDF lên.')
    } finally {
      setBusy(false)
    }
  }
  async function updateDocument(document: CvDocument, action: 'rename' | 'default') {
    setBusy(true)
    setError('')
    try {
      const next =
        action === 'rename'
          ? await renameCvDocument(document.id, newTitle.trim())
          : await setDefaultCvDocument(document.id)
      setDocuments((list) =>
        list.map((d) =>
          d.id === next.id ? next : action === 'default' ? { ...d, isDefault: false } : d,
        ),
      )
      setNotice(action === 'rename' ? 'Đã đổi tên CV.' : 'Đã đặt PDF làm CV mặc định.')
      setRenamingDocument(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa cập nhật được PDF.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="resume-library" aria-label="CV của tôi">
      <div className="resume-library-heading">
        <div>
          <h3>CV của tôi</h3>
          <p>
            Tải CV PDF và ứng tuyển ngay. Bạn có thể kiểm tra thông tin AI đọc trước khi đối chiếu
            công việc.
          </p>
        </div>
        <label className="button small" style={{ cursor: busy ? 'wait' : 'pointer' }}>
          <FileText size={16} /> Tải CV PDF
          <input
            aria-label="Tải CV PDF"
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy}
            onChange={(e) => {
              void uploadPdf(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p className="small-text">
        PDF có chữ hoặc scan · Tối đa 10 MB, 10 trang. File gốc được giữ nguyên khi AI đọc.
      </p>
      {jobId && (
        <p>
          <Link to={jobApplicationPath(jobId)}>← Quay lại ứng tuyển</Link>
        </p>
      )}
      {notice && (
        <p className="resume-library-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div role="alert" className="form-error">
          <p>{error}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError('')
              setLoading(true)
              setRetry((v) => v + 1)
            }}
          >
            Tải lại danh sách
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Đang tải CV…</p>
      ) : (
        <>
          {!error && !documents.length && (
            <div className="resume-library-empty">
              <FileText size={28} />
              <h4>Chưa có CV PDF</h4>
              <p>Tải PDF để kiểm tra thông tin và bắt đầu ứng tuyển.</p>
            </div>
          )}
          <div className="resume-library-list" aria-label="CV PDF của tôi">
            {documents.map((doc) => (
              <article className="resume-library-item" key={doc.id}>
                <span className="resume-library-icon" aria-hidden="true">
                  <FileText size={22} />
                </span>
                <div className="resume-library-copy">
                  <h4>{doc.title}</h4>
                  <div className="resume-library-meta">
                    <span>PDF</span>
                    <span>
                      {doc.confirmedAt
                        ? 'Đã xác nhận thông tin'
                        : doc.status === 'PARSED'
                          ? 'Cần kiểm tra thông tin'
                          : doc.status === 'PROCESSING'
                            ? 'Đang đọc PDF'
                            : doc.status === 'FAILED'
                              ? 'Đọc chưa thành công · Có thể thử lại'
                              : 'Chưa đọc thông tin'}
                    </span>
                    {doc.isDefault && (
                      <span className="resume-default-badge">
                        <Star size={12} />
                        Mặc định
                      </span>
                    )}
                    <time dateTime={doc.createdAt}>
                      Tải lên {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                    </time>
                  </div>
                </div>
                <div className="resume-library-actions">
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => {
                      setViewingDocument(doc)
                      setReviewDirty(false)
                    }}
                  >
                    <Eye size={14} />
                    Kiểm tra PDF
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      setRenamingDocument(doc)
                      setNewTitle(doc.title)
                    }}
                  >
                    <Pencil size={14} />
                    Đổi tên
                  </button>
                  {!doc.isDefault && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => void updateDocument(doc, 'default')}
                    >
                      <Star size={14} />
                      Đặt mặc định
                    </button>
                  )}
                  {jobId && doc.confirmedAt && (
                    <Link className="button secondary small" to={jobMatchPath(jobId, doc.id)}>
                      Đối chiếu công việc
                    </Link>
                  )}
                  {jobId && (
                    <Link
                      className="button small"
                      to={`${jobApplicationPath(jobId)}&documentId=${encodeURIComponent(doc.id)}`}
                    >
                      Dùng PDF để ứng tuyển
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
          {resumes.length > 0 && (
            <details className="resume-legacy-history">
              <summary>CV tạo trước đây ({resumes.length}) · Chỉ xem</summary>
              <p>
                CV cũ và các đơn đã nộp vẫn được giữ. Để ứng tuyển mới, hãy tải bản PDF của bạn.
              </p>
              {resumes.map((resume) => (
                <article className="resume-library-item" key={resume.id}>
                  <div className="resume-library-copy">
                    <h4>{resume.title}</h4>
                    <p>{resume.desiredPosition}</p>
                  </div>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => setViewingResume(resume)}
                  >
                    Xem CV cũ
                  </button>
                </article>
              ))}
            </details>
          )}
        </>
      )}
      {viewingResume && (
        <Modal title={`CV cũ: ${viewingResume.title}`} onClose={() => setViewingResume(null)} wide>
          <div className="resume-library-preview">
            <CvPreview draft={viewingResume} skills={viewingResume.skills ?? []} />
          </div>
        </Modal>
      )}
      {viewingDocument && (
        <Modal
          title={`Kiểm tra PDF: ${viewingDocument.title}`}
          wide
          className="cv-pdf-modal"
          onClose={() => {
            if (!busy && (!reviewDirty || window.confirm('Bỏ các sửa đổi PDF chưa lưu?'))) {
              setViewingDocument(null)
              setReviewDirty(false)
            }
          }}
        >
          <a href={cvDocumentUrl(viewingDocument.id)} target="_blank" rel="noreferrer">
            Mở PDF gốc trong tab mới
          </a>
          <p>Kiểm tra dữ liệu là tùy chọn. Bạn vẫn có thể nộp PDF gốc khi AI chưa đọc được.</p>
          {jobId && !busy && !reviewDirty && (
            <Link
              className="button"
              to={`${jobApplicationPath(jobId)}&documentId=${encodeURIComponent(viewingDocument.id)}`}
            >
              Tiếp tục ứng tuyển bằng PDF gốc
            </Link>
          )}
          <CvDocumentReview
            document={viewingDocument}
            onEditing={setReviewDirty}
            onBusy={setBusy}
            onSaved={saved}
          />
          {jobId && viewingDocument.confirmedAt && !reviewDirty && !busy && (
            <Link className="button" to={jobMatchPath(jobId, viewingDocument.id)}>
              Tiếp tục đối chiếu công việc
            </Link>
          )}
        </Modal>
      )}
      {renamingDocument && (
        <Modal
          title="Đổi tên CV PDF"
          onClose={() => {
            if (!busy) setRenamingDocument(null)
          }}
        >
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault()
              void updateDocument(renamingDocument, 'rename')
            }}
          >
            <label>
              Tên CV
              <input
                value={newTitle}
                maxLength={100}
                required
                disabled={busy}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <button className="button" type="submit" disabled={busy || !newTitle.trim()}>
              Lưu tên
            </button>
          </form>
        </Modal>
      )}
    </section>
  )
}
