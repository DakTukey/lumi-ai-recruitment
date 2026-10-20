import { useState } from 'react'
import type { CvDocument, ParsedResume } from '../../services/resume.service'
import {
  cvDocumentUrl,
  getCvDocument,
  parseCvDocument,
  reviewCvDocument,
} from '../../services/resume.service'
import { PdfDocumentViewer } from './PdfDocumentViewer'
import {
  contactFields,
  moveReviewEntry,
  readablePdfWarnings,
  reviewLabel,
  reviewSections,
} from './pdf-review-model'
import type { ReviewField } from './pdf-review-model'
import './cv-pdf-import.css'

type Props = {
  document: CvDocument
  onSaved: (document: CvDocument) => void
  onEditing?: (dirty: boolean) => void
  onBusy?: (busy: boolean) => void
}
export function CvDocumentReview(props: Props) {
  return (
    <ReviewEditor
      key={`${props.document.id}:${props.document.status}:${props.document.reviewVersion}`}
      {...props}
    />
  )
}

function ReviewEditor({ document, onSaved, onEditing, onBusy }: Props) {
  const [content, setContent] = useState<ParsedResume>(() =>
    structuredClone(document.reviewed ?? document.parsed ?? {}),
  )
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [checked, setChecked] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const ready = !!document.confirmedAt && !dirty
  const warnings = readablePdfWarnings(document.parsed?.warnings)
  const actionHintId = `${document.id}-review-action-hint`
  const values = content as Record<string, unknown>
  function edit(next: ParsedResume) {
    setContent(next)
    setDirty(true)
    setChecked(false)
    setNotice('')
    onEditing?.(true)
  }
  async function run(action: 'parse' | 'save' | 'confirm' | 'reload') {
    if (busy) return
    setBusy(true)
    onBusy?.(true)
    setError('')
    setNotice('')
    try {
      const next =
        action === 'parse'
          ? await parseCvDocument(document.id)
          : action === 'reload'
            ? await getCvDocument(document.id)
            : await reviewCvDocument(
                document.id,
                normalizeLists(),
                document.reviewVersion,
                action === 'confirm',
              )
      onSaved(next)
      onEditing?.(false)
      setContent(structuredClone(next.reviewed ?? next.parsed ?? {}))
      setDirty(false)
      setChecked(false)
      setNotice(
        action === 'confirm'
          ? 'Đã xác nhận thông tin để đánh giá.'
          : action === 'save'
            ? 'Đã lưu bản sửa. Xác nhận để dùng dữ liệu này khi đối chiếu công việc; bạn vẫn có thể nộp PDF gốc ngay.'
            : '',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa cập nhật được thông tin PDF.')
    } finally {
      setBusy(false)
      onBusy?.(false)
    }
  }
  function field(
    def: ReviewField,
    value: unknown,
    update: (value: unknown) => void,
    prefix: string,
  ) {
    const id = `${document.id}-${prefix}-${def.key}`
    const text =
      def.kind === 'list' ? (Array.isArray(value) ? value.join('\n') : '') : String(value ?? '')
    const change = (raw: string) =>
      update(
        def.kind === 'list'
          ? raw.split('\n')
          : def.kind === 'number'
            ? raw === ''
              ? null
              : Number(raw)
            : raw,
      )
    return (
      <label key={def.key} htmlFor={id}>
        <span>{def.label}</span>
        {def.kind === 'boolean' ? (
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => update(e.target.checked)}
          />
        ) : def.kind === 'long' || def.kind === 'list' ? (
          <textarea
            id={id}
            rows={def.kind === 'long' ? 4 : 3}
            maxLength={def.max ?? (def.kind === 'list' ? 10100 : 6000)}
            value={text}
            onChange={(e) => change(e.target.value)}
          />
        ) : (
          <input
            id={id}
            type={def.kind === 'month' ? 'month' : def.kind === 'number' ? 'number' : 'text'}
            step={def.kind === 'number' ? 'any' : undefined}
            maxLength={def.max ?? 255}
            value={text}
            onChange={(e) => change(e.target.value)}
          />
        )}
      </label>
    )
  }
  // Trim list entries only on save, so typing a new line remains possible.
  function normalizeLists() {
    const next = structuredClone(content)
    next.skills = (next.skills ?? []).map((s) => s.trim()).filter(Boolean)
    next.projects = next.projects?.map((p) => ({
      ...p,
      technologies: (p.technologies ?? []).map((s) => s.trim()).filter(Boolean),
    }))
    return next
  }
  return (
    <div className="cv-document-review">
      <p role="status" className="cv-review-status">
        {ready
          ? `Ứng viên đã xác nhận · ${new Date(document.confirmedAt!).toLocaleString('vi-VN')}`
          : dirty
            ? 'Có chỉnh sửa chưa lưu và xác nhận'
            : document.reviewed
              ? 'Đã lưu bản sửa · Chưa xác nhận'
              : document.parsed
                ? 'AI đã đọc · Chưa xác nhận'
                : 'Chưa đọc thông tin từ PDF'}
      </p>
      <p>
        Bạn có thể nộp PDF gốc ngay. Kiểm tra và xác nhận để dùng dữ liệu đã sửa khi đối chiếu công
        việc hoặc gửi kèm đơn mới; đơn đã nộp được giữ nguyên.
      </p>
      {error && !document.parsed && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {busy && (
        <p role="status">
          {document.parsed ? 'Đang lưu thông tin…' : 'Đang đọc PDF, có thể mất vài phút…'}
        </p>
      )}
      {!document.parsed ? (
        <div className="cv-pdf-actions">
          <button
            type="button"
            className="button"
            disabled={busy || document.attempts >= 3 || document.status === 'PROCESSING'}
            onClick={() => void run('parse')}
          >
            Đọc thông tin từ PDF
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void run('reload')}
          >
            Cập nhật kết quả
          </button>
          <PdfDocumentViewer title="CV PDF gốc" url={cvDocumentUrl(document.id)} />
        </div>
      ) : (
        <>
          {!!document.issues?.length && (
            <div className="cv-pdf-warnings" role="status">
              <strong>Thông tin cần kiểm tra</strong>
              <ul>
                {document.issues.map((issue, i) => (
                  <li key={i}>
                    {reviewLabel(issue.path)}: {issue.message}
                    {issue.severity === 'ERROR' ? ' (Cần sửa trước khi xác nhận)' : ''}
                  </li>
                ))}
              </ul>
              <p>Danh sách được kiểm tra lại khi lưu hoặc xác nhận.</p>
            </div>
          )}
          <div className="cv-pdf-compare">
            <div className="cv-review-original">
              <h3>PDF gốc · {document.filename}</h3>
              <PdfDocumentViewer
                title="PDF gốc để kiểm tra thông tin"
                url={cvDocumentUrl(document.id)}
                page={page}
                onPageChange={setPage}
              />
              <details className="cv-review-sources">
                <summary>
                  Nguồn AI trích ban đầu · {document.parsed.sources?.length ?? 0} mục
                </summary>
                <p>
                  Nguồn thuộc kết quả AI ban đầu. Các mục bạn chuyển hoặc sửa bên cạnh cần được đối
                  chiếu lại.
                </p>
                {document.parsed.sources?.length ? (
                  document.parsed.sources.map((source, i) => (
                    <div key={i}>
                      <button type="button" onClick={() => setPage(source.page)}>
                        {reviewLabel(source.path)} · Trang {source.page}
                      </button>
                      <blockquote>{source.quote}</blockquote>
                      <small>
                        {source.verified
                          ? 'Đoạn trích khớp văn bản trên trang; cần kiểm tra cách phân loại.'
                          : 'Chưa kiểm chứng bằng văn bản; cần xem trang PDF.'}
                      </small>
                    </div>
                  ))
                ) : (
                  <p>
                    Bản trích xuất này chưa có nguồn theo trường. Hãy kiểm tra trực tiếp PDF gốc.
                  </p>
                )}
              </details>
            </div>
            <fieldset className="cv-review-fields" disabled={busy}>
              <legend>Thông tin dùng để đánh giá</legend>
              {contactFields.map((def) =>
                field(
                  def,
                  values[def.key],
                  (value) => edit({ ...content, [def.key]: value }),
                  'contact',
                ),
              )}
              {reviewSections.map((section) => {
                const items = (values[section.key] ?? []) as Record<string, unknown>[]
                return (
                  <details key={section.key} open={items.length > 0}>
                    <summary>
                      {section.label} ({items.length})
                    </summary>
                    {items.map((item, index) => (
                      <div className="cv-review-entry" key={index}>
                        <h4>
                          {section.label} {index + 1}
                        </h4>
                        {section.fields.map((def) =>
                          field(
                            def,
                            item[def.key],
                            (value) =>
                              edit({
                                ...content,
                                [section.key]: items.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        [def.key]: value,
                                        ...(def.key === 'current' && value ? { endDate: '' } : {}),
                                      }
                                    : entry,
                                ),
                              }),
                            `${section.key}-${index}`,
                          ),
                        )}
                        <div className="cv-pdf-actions">
                          <button
                            type="button"
                            onClick={() =>
                              edit({
                                ...content,
                                [section.key]: items.filter((_, i) => i !== index),
                              })
                            }
                          >
                            Xóa mục
                          </button>
                          {(section.key === 'experiences' || section.key === 'projects') && (
                            <button
                              type="button"
                              disabled={
                                ((section.key === 'experiences'
                                  ? content.projects
                                  : content.experiences
                                )?.length ?? 0) >= 30
                              }
                              onClick={() =>
                                edit(
                                  moveReviewEntry(
                                    content,
                                    section.key as 'experiences' | 'projects',
                                    index,
                                  ),
                                )
                              }
                            >
                              Chuyển sang {section.key === 'experiences' ? 'Dự án' : 'Kinh nghiệm'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={items.length >= 30}
                      onClick={() =>
                        edit({
                          ...content,
                          [section.key]: [
                            ...items,
                            Object.fromEntries(
                              section.fields.map((f) => [
                                f.key,
                                f.kind === 'boolean'
                                  ? false
                                  : f.kind === 'list'
                                    ? []
                                    : f.kind === 'number'
                                      ? null
                                      : '',
                              ]),
                            ),
                          ],
                        })
                      }
                    >
                      Thêm {section.label.toLowerCase()}
                    </button>
                  </details>
                )
              })}
            </fieldset>
          </div>
          {warnings.length > 0 && (
            <details className="cv-pdf-warnings">
              <summary>Lưu ý khi đọc PDF</summary>
              <ul>
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="cv-review-confirmation">
            <p id={actionHintId} className="cv-review-action-hint">
              <span>
                {dirty
                  ? 'Bạn có thể lưu bản sửa để tiếp tục sau. Xác nhận thông tin cũng sẽ lưu toàn bộ chỉnh sửa.'
                  : ready
                    ? 'Thông tin đã được xác nhận. Chỉ cần xác nhận lại nếu bạn chỉnh sửa.'
                    : 'Chưa có chỉnh sửa mới để lưu. Nếu thông tin đã đúng, bạn có thể xác nhận trực tiếp.'}
              </span>
              {!checked && !ready && (
                <span>Tích ô đối chiếu bên dưới để bật nút “Xác nhận thông tin”.</span>
              )}
            </p>
            <label className="cv-pdf-confirm">
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                aria-describedby={actionHintId}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <span>Tôi đã đối chiếu thông tin với PDF gốc và chỉnh sửa nếu cần.</span>
            </label>
            <div className="cv-pdf-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy || !dirty}
                title={!dirty ? 'Chưa có chỉnh sửa mới để lưu' : undefined}
                aria-describedby={actionHintId}
                onClick={() => void run('save')}
              >
                Lưu bản sửa
              </button>
              <button
                type="button"
                className="button"
                disabled={busy || !checked}
                title={!checked ? 'Tích ô đối chiếu PDF ở trên để xác nhận' : undefined}
                aria-describedby={actionHintId}
                onClick={() => void run('confirm')}
              >
                Xác nhận thông tin
              </button>
              {error && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!dirty || window.confirm('Tải lại sẽ bỏ các sửa đổi chưa lưu. Tiếp tục?'))
                      void run('reload')
                  }}
                >
                  Tải lại bản đã lưu
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
