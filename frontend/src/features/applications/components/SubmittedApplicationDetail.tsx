import { ApplicationAiStatus } from './ApplicationAiStatus'
import { useEffect, useState } from 'react'
import { SubmittedCvViewer } from '../../resumes/SubmittedCvViewer'
import {
  applicationStages,
  getApplication,
  submittedDate,
} from '../../../services/application.service'
import type { SubmittedApplication } from '../../../services/application.service'
import { ApplicationReviewActions } from './ApplicationReviewActions'
import { AiAssessmentTab } from './AiAssessmentTab'
import './applications.css'
const contracts: Record<string, string> = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  INTERNSHIP: 'Thực tập',
  CONTRACT: 'Hợp đồng',
}
const modes: Record<string, string> = {
  ONSITE: 'Tại văn phòng',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
}
const levels: Record<string, string> = {
  INTERN: 'Thực tập sinh',
  JUNIOR: 'Junior',
  MIDDLE: 'Middle',
  SENIOR: 'Senior',
}
export function SubmittedApplicationDetail({
  id,
  staff = false,
  initialTab = 'cv',
  onTabChange,
  onChanged,
}: {
  id: string
  staff?: boolean
  initialTab?: string
  onTabChange?: (tab: string) => void
  onChanged?: () => void
}) {
  const [localTab, setLocalTab] = useState(initialTab)
  const tab = onTabChange ? initialTab : localTab
  const setTab = onTabChange ?? setLocalTab
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data?: SubmittedApplication
    error?: string
  } | null>(null)
  const key = `${staff}:${id}:${retry}`
  const current = result?.key === key ? result : null
  useEffect(() => {
    let active = true
    getApplication(staff, id)
      .then((data) => {
        if (active) setResult({ key, data })
      })
      .catch((e) => {
        if (active)
          setResult({ key, error: e instanceof Error ? e.message : 'Không tải được hồ sơ.' })
      })
    return () => {
      active = false
    }
  }, [staff, id, key])
  if (!current) return <p role="status">Đang tải hồ sơ đã nộp…</p>
  if (!current.data)
    return (
      <div role="alert">
        <p>{current.error}</p>
        <button
          className={staff ? 'hr-button secondary' : 'button secondary'}
          onClick={() => setRetry(retry + 1)}
        >
          Thử lại
        </button>
      </div>
    )
  const app = current.data
  const events: (SubmittedApplication['history'][number] & {
    actorName?: string
    reason?: string | null
  })[] = staff && app.review ? app.review.history : app.history
  return (
    <div className="submitted-application">
      <div className="hr-application-header">
        <div>
          <h2>{app.resumeSnapshot.fullName}</h2>
          <p>
            {app.jobSnapshot.title} · Nộp {submittedDate(app.appliedAt)}
          </p>
        </div>
        <span className={`hr-stage hr-stage-${app.status.toLowerCase()}`}>
          {applicationStages[app.status]}
        </span>
      </div>
      {!staff && <ApplicationAiStatus key={id} applicationId={id} />}
      <div className="hr-detail-tabs" role="group" aria-label="Nội dung hồ sơ đã nộp">
        {[
          ['cv', 'CV đã nộp'],
          ['jd', 'Công việc lúc nộp'],
          ...(staff
            ? [
                ['workflow', 'Chuyển vòng'],
                ['notes', `Ghi chú (${app.review?.notes.length ?? 0})`],
                ['ai', 'Đánh giá AI'],
              ]
            : []),
          ['history', 'Lịch sử'],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={tab === value ? 'active' : ''}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {staff && (tab === 'workflow' || tab === 'notes') && (
        <ApplicationReviewActions
          app={app}
          tab={tab}
          onSaved={(data) => {
            setResult({ key, data })
            onChanged?.()
          }}
          onReload={() => {
            setRetry((n) => n + 1)
            onChanged?.()
          }}
        />
      )}
      {tab === 'cv' && (
        <>
          <SubmittedCvViewer
            draft={app.resumeSnapshot}
            caption={`${app.resumeSnapshot.title} · Đã gửi ngày ${submittedDate(app.appliedAt)}. Thay đổi CV gốc không làm đổi bản này.`}
          />
          {app.coverLetter && (
            <section className="submitted-jd">
              <h3>Thư ứng tuyển</h3>
              <p>{app.coverLetter}</p>
            </section>
          )}
        </>
      )}
      {tab === 'jd' && (
        <article className="submitted-jd">
          <h2>{app.jobSnapshot.title}</h2>
          <p>
            {app.jobSnapshot.departmentName} · {app.jobSnapshot.location} · Tuyển{' '}
            {app.jobSnapshot.headcount} người
          </p>
          <p>
            {contracts[app.jobSnapshot.employmentType] ?? app.jobSnapshot.employmentType} ·{' '}
            {modes[app.jobSnapshot.workMode] ?? app.jobSnapshot.workMode} ·{' '}
            {levels[app.jobSnapshot.experienceLevel] ?? app.jobSnapshot.experienceLevel}
          </p>
          <p>
            Lương:{' '}
            {app.jobSnapshot.salaryMin == null && app.jobSnapshot.salaryMax == null
              ? 'Thỏa thuận'
              : app.jobSnapshot.salaryMin != null && app.jobSnapshot.salaryMax != null
                ? `${app.jobSnapshot.salaryMin.toLocaleString('vi-VN')} – ${app.jobSnapshot.salaryMax.toLocaleString('vi-VN')} ${app.jobSnapshot.currency}`
                : app.jobSnapshot.salaryMin != null
                  ? `Từ ${app.jobSnapshot.salaryMin.toLocaleString('vi-VN')} ${app.jobSnapshot.currency}`
                  : `Đến ${app.jobSnapshot.salaryMax?.toLocaleString('vi-VN')} ${app.jobSnapshot.currency}`}
          </p>
          {[
            ['Mô tả công việc', app.jobSnapshot.description],
            ['Yêu cầu', app.jobSnapshot.requirements],
            ['Quyền lợi', app.jobSnapshot.benefits],
          ].map(
            ([label, text]) =>
              text && (
                <section key={label}>
                  <h3>{label}</h3>
                  <p>{text}</p>
                </section>
              ),
          )}
          {!!app.jobSnapshot.skills.length && (
            <section>
              <h3>Kỹ năng yêu cầu</h3>
              <ul>
                {app.jobSnapshot.skills.map((skill) => (
                  <li key={skill.id}>
                    {skill.name} · {skill.required ? 'Bắt buộc' : 'Ưu tiên'}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!!app.jobSnapshot.criteria.length && (
            <section>
              <h3>Tiêu chí tuyển dụng</h3>
              <ul>
                {app.jobSnapshot.criteria.map((c) => (
                  <li key={c.id}>
                    {c.description} · {c.required ? 'Bắt buộc' : 'Ưu tiên'}
                    {c.weight != null ? ` · Trọng số ${c.weight}` : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="submitted-caption">
            Yêu cầu được giữ tại lúc nộp · Phiên bản {app.jobVersion + 1}
            {app.jobSnapshot.applicationDeadline &&
              ` · Hạn nộp ${submittedDate(app.jobSnapshot.applicationDeadline)}`}
          </p>
        </article>
      )}
      {tab === 'ai' && (
        <AiAssessmentTab
          key={app.id}
          applicationId={app.id}
          jobSnapshot={app.jobSnapshot}
          onChanged={onChanged}
        />
      )}
      {tab === 'history' && (
        <section className="submitted-jd">
          <h3>Lịch sử đơn</h3>
          <ol>
            {events.map((h) => (
              <li key={h.id}>
                {h.fromStatus ? `${applicationStages[h.fromStatus]} → ` : ''}
                {applicationStages[h.toStatus]} · {submittedDate(h.at)}
                {staff && h.actorName && (
                  <>
                    <p className="submitted-caption">Người thực hiện: {h.actorName}</p>
                    {h.reason && (
                      <p className="application-internal-text">Lý do nội bộ: {h.reason}</p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      {staff && (
        <p className="submitted-caption">
          Ghi chú và lý do xử lý chỉ hiển thị cho HR. Chuyển vòng không tự gửi email hoặc tạo lịch
          phỏng vấn.
        </p>
      )}
    </div>
  )
}
