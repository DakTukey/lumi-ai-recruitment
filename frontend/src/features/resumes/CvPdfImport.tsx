import { PdfDocumentViewer } from './PdfDocumentViewer'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { cvDocumentUrl, getCvDocument, getCvDocuments, parseCvDocument, uploadCvDocument } from '../../services/resume.service'
import type { CvDocument } from '../../services/resume.service'
import { CvPreview } from './CvPreview'
import { importedDraft } from './pdf-import-model'
import './cv-pdf-import.css'

export function CvPdfImport({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [document, setDocument] = useState<CvDocument | null>(null)
  const [saved, setSaved] = useState<CvDocument[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  useEffect(() => { void getCvDocuments().then(setSaved).catch(() => setError('Chưa tải được danh sách PDF đã lưu.')) }, [])
  async function parse(existing?: CvDocument) {
    if (busy || (!file && !existing)) return
    setError(''); setConfirmed(false)
    let doc = existing
    try {
      setBusy(existing ? 'Đang đọc PDF bằng AI…' : 'Đang lưu PDF gốc…')
      if (!doc && file) doc = await uploadCvDocument(file)
      if (!doc) return
      setDocument(doc)
      setBusy('Đang đọc và trích xuất nội dung. Có thể mất khoảng một phút…')
      const result = await parseCvDocument(doc.id)
      setDocument(result)
      setSaved(await getCvDocuments())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa đọc được PDF.')
      if (doc) {
        const latest = await getCvDocument(doc.id).catch(() => null)
        if (latest) setDocument(latest)
      }
    } finally { setBusy('') }
  }
  const draft = document?.parsed ? importedDraft(document) : null
  return <Modal title="Nhập PDF thành CV mới" wide className="cv-pdf-modal" onClose={() => { if (!busy) onClose() }}>
    <div className="cv-pdf-import">
      <p className="cv-pdf-intro">Giữ PDF gốc, kiểm tra nội dung AI đọc được rồi mở một CV mới để chỉnh sửa. CV đang làm vẫn được giữ riêng.</p>
      <div className="cv-pdf-upload">
        <label>Chọn PDF · Tối đa 10 MB, 10 trang
          <input aria-label="Chọn PDF để nhập" type="file" accept=".pdf,application/pdf" disabled={!!busy} onChange={e => {
            const next = e.target.files?.[0]
            setError('');setConfirmed(false)
            if (next && (!next.name.toLowerCase().endsWith('.pdf') || next.size > 10 * 1024 * 1024 || !next.size)) {setError('Chọn PDF không rỗng, tối đa 10 MB.');setFile(null);return}
            setFile(next ?? null);setDocument(null)
          }} />
        </label>
        <p>Khi bấm đọc, nội dung PDF bao gồm thông tin liên hệ được gửi tới Gemini hoặc Groq để trích xuất. PDF scan được Gemini đọc trực tiếp. Chỉ bạn và HR nhận PDF khi bạn chọn gửi bản gốc trong đơn mới xem được file.</p>
        <button className="button" type="button" disabled={!file || !!busy} onClick={() => void parse()}>{busy || 'Lưu PDF và đọc bằng AI'}</button>
      </div>
      {!!saved.length && <details className="cv-pdf-saved"><summary>Tiếp tục với PDF đã tải ({saved.length})</summary>
        {saved.map(d => <button type="button" key={d.id} disabled={!!busy} onClick={() => {setDocument(d);setFile(null);setConfirmed(false);setError('')}}>{d.filename} · {d.status === 'PARSED' ? 'Đã đọc' : d.status === 'PROCESSING' ? 'Đang xử lý' : 'Chưa có kết quả'}</button>)}
      </details>}
      {busy && <p role="status">{busy}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {document && !draft && !busy && <div className="cv-pdf-actions">
        <a href={cvDocumentUrl(document.id)} target="_blank" rel="noreferrer">Xem PDF đã lưu</a>
        <button type="button" className="button secondary" disabled={document.attempts >= 3} onClick={() => void parse(document)}>Đọc / thử lại PDF đã lưu</button>
        <button type="button" className="button secondary" onClick={() => void getCvDocument(document.id).then(setDocument).catch(() => setError('Chưa cập nhật được kết quả.'))}>Cập nhật kết quả</button>
      </div>}
      {draft && document && <>
        <details className="cv-pdf-warnings"><summary>Cần kiểm tra trước khi lưu · {document.parsed?.warnings?.length || 1} lưu ý</summary>
          <ul>{(document.parsed?.warnings?.length ? document.parsed.warnings : ['Đối chiếu thông tin với PDF gốc. AI có thể bỏ sót hoặc đọc sai.']).map((w,i) => <li key={i}>{w}</li>)}</ul>
        </details>
        <div className="cv-pdf-compare">
          <section><h3>PDF gốc · {document.filename}</h3><a href={cvDocumentUrl(document.id)} target="_blank" rel="noreferrer">Mở PDF trong tab mới</a>
            <PdfDocumentViewer title="PDF gốc để đối chiếu" url={cvDocumentUrl(document.id)} />
          </section>
          <section><h3>Nội dung AI đã đọc</h3><p>Thông tin chưa rõ có thể sửa ở bước tiếp theo. Các mục ngoài mẫu nằm trong “Mục bổ sung”.</p>
            <div className="cv-pdf-parsed"><CvPreview draft={draft} skills={draft.skills} /></div>
          </section>
        </div>
        {!!document.parsed?.extractedText && <details><summary>Văn bản trích xuất theo trang</summary><pre className="cv-extracted-text">{document.parsed.extractedText}</pre></details>}
        <label className="cv-pdf-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Tôi sẽ kiểm tra và sửa thông tin trước khi hoàn tất CV.</label>
        {confirmed ? <Link className="button" target="_blank" rel="noopener" to={`/cv-builder?documentId=${encodeURIComponent(document.id)}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ''}`}>Mở CV mới để chỉnh sửa ↗</Link> : <button type="button" className="button" disabled>Mở CV mới để chỉnh sửa</button>}
        <p>CV mới mở trong tab riêng. Chỉ được lưu vào thư viện khi bạn bấm Lưu nháp hoặc Hoàn tất.</p>
      </>}
    </div>
  </Modal>
}
