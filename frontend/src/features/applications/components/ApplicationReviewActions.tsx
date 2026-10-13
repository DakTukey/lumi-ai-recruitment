import { useRef, useState } from 'react'
import {
  addApplicationNote,
  applicationStages,
  changeApplicationStatus,
  submittedDate,
} from '../../../services/application.service'
import type { SubmittedApplication } from '../../../services/application.service'
import type { ApplicationStatus } from '../../../types/domain'
import { ApiError } from '../../../services/api'

export function ApplicationReviewActions({
  app,
  tab,
  onSaved,
  onReload,
}: {
  app: SubmittedApplication
  tab: string
  onSaved: (app: SubmittedApplication) => void
  onReload: () => void
}) {
  const [target, setTarget] = useState<ApplicationStatus | ''>('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)
  const [notice, setNotice] = useState('')
  const posting = useRef(false)
  const noteRequest = useRef<{ body: string; id: string } | null>(null)
  const allowed = app.review?.allowedTransitions ?? []
  const selected = allowed.includes(target as ApplicationStatus) ? target : ''
  async function save(kind: 'note' | 'status') {
    if (posting.current) return
    posting.current = true
    setBusy(true)
    setError('')
    setStale(false)
    setNotice('')
    try {
      let data: SubmittedApplication
      if (kind === 'note') {
        const body = note.trim()
        if (!body) {
          setError('Hãy nhập nội dung ghi chú.')
          return
        }
        if (noteRequest.current?.body !== body)
          noteRequest.current = { body, id: crypto.randomUUID() }
        data = await addApplicationNote(app.id, body, noteRequest.current.id)
        setNote('')
        noteRequest.current = null
      } else {
        if (!selected || (selected === 'REJECTED' && !reason.trim())) {
          setError('Chọn vòng hợp lệ và ghi lý do khi loại hồ sơ.')
          return
        }
        data = await changeApplicationStatus(app.id, app.version, selected, reason.trim())
        setConfirm(false)
        setReason('')
        setTarget('')
      }
      onSaved(data)
      setNotice(
        kind === 'note'
          ? 'Đã lưu ghi chú nội bộ.'
          : `Đã chuyển sang ${applicationStages[data.status]}.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được thay đổi. Vui lòng thử lại.')
      setStale(kind === 'status' && e instanceof ApiError && e.status === 409)
    } finally {
      posting.current = false
      setBusy(false)
    }
  }
  return (
    <section className="application-review">
      {notice && (
        <p className="hr-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="hr-form-error" role="alert">
          <p>{error}</p>
          {stale && (
            <button type="button" className="hr-button secondary" onClick={onReload}>
              Tải lại hồ sơ
            </button>
          )}
        </div>
      )}
      {tab === 'workflow' && (
        <>
          <h3>Chuyển vòng tuyển dụng</h3>
          <p className="submitted-caption">
            Hiện tại: {applicationStages[app.status]}. HR quyết định chuyển vòng; kết quả AI không
            tự thay đổi trạng thái.
          </p>
          {allowed.length ? (
            <form
              className="hr-job-form"
              onSubmit={(e) => {
                e.preventDefault()
                setError('')
                setNotice('')
                if (!selected || (selected === 'REJECTED' && !reason.trim())) {
                  setError('Chọn vòng và nhập lý do khi loại hồ sơ.')
                  return
                }
                setConfirm(true)
              }}
            >
              <fieldset disabled={busy || confirm}>
                <label>
                  Chuyển đến <span>*</span>
                  <select
                    required
                    aria-label="Chuyển đến"
                    value={selected}
                    onChange={(e) => {
                      setTarget(e.target.value as ApplicationStatus)
                      setError('')
                      setConfirm(false)
                    }}
                  >
                    <option value="">Chọn vòng tiếp theo</option>
                    {allowed.map((s) => (
                      <option key={s} value={s}>
                        {applicationStages[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Lý do nội bộ {selected === 'REJECTED' && <span>*</span>}
                  <textarea
                    aria-label="Lý do nội bộ"
                    maxLength={2000}
                    required={selected === 'REJECTED'}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Nhận xét cho quyết định chuyển vòng…"
                  />
                  <small>{reason.length}/2000 ký tự · Ứng viên không thấy lý do này.</small>
                </label>
              </fieldset>
              {confirm ? (
                <div className="application-review-confirm">
                  <h4>Xác nhận chuyển vòng</h4>
                  <p>
                    {applicationStages[app.status]} → {selected && applicationStages[selected]}
                  </p>
                  {reason.trim() && <p className="application-internal-text">{reason.trim()}</p>}
                  <div className="hr-row-actions">
                    <button
                      type="button"
                      className="hr-button secondary"
                      disabled={busy}
                      onClick={() => setConfirm(false)}
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      className="hr-button"
                      disabled={busy || stale}
                      onClick={() => void save('status')}
                    >
                      {busy ? 'Đang lưu…' : 'Xác nhận chuyển vòng'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button className="hr-button" disabled={busy || !selected || stale} type="submit">
                    Kiểm tra chuyển vòng
                  </button>
                </div>
              )}
            </form>
          ) : (
            <p className="hr-preview-label">
              Hồ sơ đã kết thúc ở trạng thái {applicationStages[app.status]}. Bạn vẫn có thể xem
              lịch sử và thêm ghi chú nội bộ.
            </p>
          )}
        </>
      )}
      {tab === 'notes' && (
        <>
          <h3>Ghi chú nội bộ</h3>
          <p className="submitted-caption">
            Chỉ HR và quản trị công ty xem được. Ghi chú đã lưu được giữ trong lịch sử xử lý.
          </p>
          <form
            className="hr-job-form"
            onSubmit={(e) => {
              e.preventDefault()
              void save('note')
            }}
          >
            <label>
              Nội dung ghi chú <span>*</span>
              <textarea
                aria-label="Nội dung ghi chú"
                required
                maxLength={4000}
                rows={4}
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi nhận điểm cần làm rõ, nhận xét CV hoặc kết quả trao đổi…"
              />
              <small>{note.length}/4000 ký tự</small>
            </label>
            <div>
              <button className="hr-button" type="submit" disabled={busy || !note.trim()}>
                {busy ? 'Đang lưu…' : 'Lưu ghi chú'}
              </button>
            </div>
          </form>
          <ol className="application-note-list">
            {app.review?.notes.map((n) => (
              <li key={n.id}>
                <strong>{n.authorName}</strong> <time dateTime={n.at}>{submittedDate(n.at)}</time>
                <p className="application-internal-text">{n.body}</p>
              </li>
            ))}
          </ol>
          {!app.review?.notes.length && (
            <p className="submitted-caption">Chưa có ghi chú nội bộ.</p>
          )}
        </>
      )}
    </section>
  )
}
