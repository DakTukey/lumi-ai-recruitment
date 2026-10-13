import { FileText, LockKeyhole } from 'lucide-react'
import type { ResumeInput } from '../../services/resume.service'
import { CvPreview } from './CvPreview'

export function SubmittedCvViewer({
  draft,
  caption,
  sample = false,
}: {
  draft: ResumeInput
  caption: string
  sample?: boolean
}) {
  return (
    <section className="cv-reviewer" aria-label="Trình xem CV đã nộp">
      <div className="cv-reviewer-toolbar">
        <div>
          <FileText size={19} aria-hidden="true" />
          <div>
            <strong>CV đã nộp</strong>
            <p>{caption}</p>
          </div>
        </div>
        <span className={`cv-reviewer-badge${sample ? ' is-sample' : ''}`}>
          <LockKeyhole size={13} aria-hidden="true" />
          {sample ? 'Dữ liệu mẫu' : 'Bản tại thời điểm nộp'}
        </span>
      </div>
      <div className="cv-reviewer-canvas">
        <CvPreview draft={draft} skills={draft.skills} presentation="reviewer" />
      </div>
    </section>
  )
}
