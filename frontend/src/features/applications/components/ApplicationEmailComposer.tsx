import { useState } from 'react'
import { Check, Copy, ExternalLink, FileCheck2, Loader2, Mail, Sparkles } from 'lucide-react'
import { addApplicationNote, generateRecruitmentEmail } from '../../../services/application.service'
import type { EmailTemplateType, SubmittedApplication } from '../../../services/application.service'

const templates: { id: EmailTemplateType; label: string; desc: string }[] = [
  {
    id: 'INTERVIEW',
    label: 'Mời phỏng vấn',
    desc: 'Hẹn lịch phỏng vấn online hoặc tại văn phòng kèm link/địa điểm.',
  },
  {
    id: 'REJECTION',
    label: 'Thư từ chối khéo léo',
    desc: 'Cảm ơn, từ chối lịch sự, động viên và lưu hồ sơ vào Talent Pool.',
  },
  {
    id: 'OFFER',
    label: 'Thư mời nhận việc (Offer)',
    desc: 'Chúc mừng, thông báo mức lương, ngày bắt đầu và hạn phản hồi.',
  },
  {
    id: 'INFO_REQUEST',
    label: 'Yêu cầu bổ sung thông tin',
    desc: 'Hỏi thêm portfolio, bằng cấp hoặc thời gian sẵn sàng nhận việc.',
  },
]

export function ApplicationEmailComposer({
  app,
  onNoteAdded,
}: {
  app: SubmittedApplication
  onNoteAdded?: () => void
}) {
  const [templateType, setTemplateType] = useState<EmailTemplateType>('INTERVIEW')
  const [interviewTime, setInterviewTime] = useState('09:00 Thứ Sáu, tuần tới')
  const [interviewFormat, setInterviewFormat] = useState('Online qua Google Meet')
  const [interviewLocation, setInterviewLocation] = useState('https://meet.google.com/abc-xyz-123')
  const [salaryOffer, setSalaryOffer] = useState('')
  const [startDate, setStartDate] = useState('')
  const [rejectionReason, setRejectionReason] = useState(
    'Ưu tiên ứng viên có thêm kinh nghiệm phù hợp với dự án',
  )
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [tone, setTone] = useState<'professional' | 'friendly' | 'formal'>('professional')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [copied, setCopied] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [noteNotice, setNoteNotice] = useState('')

  const candidateName = app.resumeSnapshot?.fullName || 'Ứng viên'
  const candidateEmail = app.resumeSnapshot?.email || ''
  const jobTitle = app.jobSnapshot?.title || 'Vị trí tuyển dụng'

  async function handleGenerate() {
    setLoading(true)
    setError('')
    setNoteNotice('')
    setCopied(false)
    try {
      const res = await generateRecruitmentEmail(app.id, {
        templateType,
        interviewTime,
        interviewFormat,
        interviewLocation,
        salaryOffer,
        startDate,
        rejectionReason,
        additionalNotes,
        tone,
      })
      setSubject(res.subject)
      setBody(res.body)
    } catch (e: any) {
      setError(e.message || 'Không thể soạn email bằng AI lúc này. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!body) return
    const fullText = `Tiêu đề: ${subject}\n\n${body}`
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      setError('Không thể tự động sao chép. Vui lòng chọn và copy thủ công.')
    }
  }

  function handleMailTo() {
    if (!candidateEmail) {
      setError('Hồ sơ ứng viên không có email hợp lệ.')
      return
    }
    const mailto = `mailto:${encodeURIComponent(candidateEmail)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`
    window.open(mailto, '_blank')
  }

  async function handleSaveAsNote() {
    if (!body) return
    setSavingNote(true)
    setNoteNotice('')
    try {
      const noteContent = `[Bản thảo email AI - ${templateType}]\nTiêu đề: ${subject}\n\n${body}`
      await addApplicationNote(app.id, noteContent, crypto.randomUUID())
      setNoteNotice('Đã lưu bản thảo email vào ghi chú nội bộ của ứng viên!')
      onNoteAdded?.()
      setTimeout(() => setNoteNotice(''), 4000)
    } catch (e: any) {
      setError(e.message || 'Không thể lưu vào ghi chú.')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="hr-email-composer">
      <div className="hr-email-header">
        <div>
          <h3>Soạn email tuyển dụng với AI</h3>
          <p className="submitted-caption">
            AI soạn bản nháp dựa trên thông tin ứng viên ({candidateName}) và vị trí ({jobTitle}).
            Bạn luôn có thể chỉnh sửa trước khi gửi.
          </p>
        </div>
      </div>

      <div className="hr-email-templates">
        {templates.map((tpl) => (
          <button
            type="button"
            key={tpl.id}
            className={`hr-email-tpl-btn ${templateType === tpl.id ? 'active' : ''}`}
            onClick={() => setTemplateType(tpl.id)}
          >
            <strong>{tpl.label}</strong>
            <small>{tpl.desc}</small>
          </button>
        ))}
      </div>

      <div className="hr-email-inputs-grid">
        {templateType === 'INTERVIEW' && (
          <>
            <label className="hr-input-field">
              <span>Thời gian phỏng vấn:</span>
              <input
                type="text"
                value={interviewTime}
                onChange={(e) => setInterviewTime(e.target.value)}
                placeholder="VD: 09:30 Thứ Sáu, ngày 24/10/2026"
              />
            </label>
            <label className="hr-input-field">
              <span>Hình thức:</span>
              <select value={interviewFormat} onChange={(e) => setInterviewFormat(e.target.value)}>
                <option value="Online qua Google Meet">Online qua Google Meet</option>
                <option value="Online qua Microsoft Teams">Online qua Microsoft Teams</option>
                <option value="Trực tiếp tại văn phòng">Trực tiếp tại văn phòng</option>
              </select>
            </label>
            <label className="hr-input-field hr-span-2">
              <span>Địa điểm hoặc Link họp trực tuyến:</span>
              <input
                type="text"
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
                placeholder="VD: https://meet.google.com/xyz hoặc Tầng 5, Tòa nhà Lumi Studio"
              />
            </label>
          </>
        )}

        {templateType === 'REJECTION' && (
          <label className="hr-input-field hr-span-2">
            <span>Lý do hoặc ghi chú cảm ơn (AI sẽ diễn đạt khéo léo):</span>
            <input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="VD: Chưa phù hợp kinh nghiệm ở thời điểm hiện tại, đã đủ chỉ tiêu..."
            />
          </label>
        )}

        {templateType === 'OFFER' && (
          <>
            <label className="hr-input-field">
              <span>Mức đãi ngộ / Lương đề xuất:</span>
              <input
                type="text"
                value={salaryOffer}
                onChange={(e) => setSalaryOffer(e.target.value)}
                placeholder="VD: 25.000.000 VNĐ / tháng (Gross) + Thưởng"
              />
            </label>
            <label className="hr-input-field">
              <span>Ngày bắt đầu dự kiến:</span>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="VD: Thứ Hai, 02/11/2026"
              />
            </label>
          </>
        )}

        <label className="hr-input-field">
          <span>Phong cách hành văn:</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as any)}>
            <option value="professional">Chuyên nghiệp & Hiện đại</option>
            <option value="friendly">Thân thiện & Cởi mở</option>
            <option value="formal">Trang trọng & Chuẩn mực</option>
          </select>
        </label>

        <label className="hr-input-field">
          <span>Ghi chú thêm cho AI (tùy chọn):</span>
          <input
            type="text"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="VD: Nhắc ứng viên đem theo laptop, hoặc người liên hệ..."
          />
        </label>
      </div>

      <div className="hr-email-action-row">
        <button type="button" className="hr-button" disabled={loading} onClick={handleGenerate}>
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Đang soạn thảo email qua AI…
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Soạn thảo email bằng AI
            </>
          )}
        </button>
        <span className="submitted-caption" style={{ margin: 0 }}>
          Gửi tới: <strong>{candidateEmail || 'Chưa có email'}</strong>
        </span>
      </div>

      {error && (
        <div className="hr-form-error" role="alert" style={{ marginTop: '1rem' }}>
          <p>{error}</p>
        </div>
      )}

      {noteNotice && (
        <p className="hr-notice" role="status" style={{ marginTop: '1rem' }}>
          {noteNotice}
        </p>
      )}

      {body && (
        <div className="hr-email-preview-card">
          <div className="hr-email-preview-head">
            <Mail size={18} />
            <strong>Bản nháp email được đề xuất</strong>
          </div>

          <label className="hr-email-subject-label">
            <span>Tiêu đề email (Subject):</span>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>

          <label className="hr-email-body-label">
            <span>Nội dung email (Body - bạn có thể chỉnh sửa trực tiếp):</span>
            <textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>

          <div className="hr-email-bottom-actions">
            <button type="button" className="hr-button" onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Đã sao chép vào bộ nhớ!' : 'Sao chép nội dung'}
            </button>

            <button
              type="button"
              className="hr-button secondary"
              onClick={handleMailTo}
              disabled={!candidateEmail}
            >
              <ExternalLink size={16} />
              Mở ứng dụng Email
            </button>

            <button
              type="button"
              className="hr-button secondary"
              disabled={savingNote}
              onClick={handleSaveAsNote}
            >
              <FileCheck2 size={16} />
              {savingNote ? 'Đang lưu…' : 'Lưu vào ghi chú nội bộ'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
