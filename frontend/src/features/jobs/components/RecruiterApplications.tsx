import { SubmittedCvViewer } from '../../resumes/SubmittedCvViewer'
import { sampleResume } from '../sample-resume'
import { RecruiterRealApplications } from '../../applications/components/RecruiterRealApplications'
import { useState } from 'react'
import { ArrowRight, Plus, Search, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { ApplicationAssessment, AssessmentBadge } from './ApplicationAssessment'
import type { ApplicationStage, RecruiterJob, SampleApplication } from '../recruiter-model'
import { dateLabel, history, initials, normalize, stageLabels } from '../recruiter-model'

export function RecruiterApplications({
  applications,
  jobs,
  demo,
  onSelect,
  onSample,
  jobId,
  onJobId,
  lockedJob = false,
  refreshKey = 0,
}: {
  applications: SampleApplication[]
  jobs: RecruiterJob[]
  demo: boolean
  onSelect: (id: string, tab?: string) => void
  onSample: () => void
  jobId: string
  onJobId: (value: string) => void
  lockedJob?: boolean
  refreshKey?: number
}) {
  const [params, setParams] = useSearchParams()
  const query = params.get('search')?.slice(0, 200) ?? ''
  const stage = Object.keys(stageLabels).find((value) => value === params.get('stage')) ?? ''
  function updateFilters(values: Record<string, string>) {
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search)
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }
  if (!demo)
    return (
      <RecruiterRealApplications
        refreshKey={refreshKey}
        jobId={jobId}
        onJobId={onJobId}
        lockedJob={lockedJob}
        onSelect={onSelect}
      />
    )
  const scoped = applications.filter((item) => !jobId || item.jobId === jobId)
  const filtered = scoped.filter(
    (item) =>
      (!stage || item.stage === stage) &&
      normalize(`${item.name} ${item.role} ${item.email}`).includes(normalize(query)),
  )
  return (
    <>
      <section className="hr-panel">
        <div className="hr-panel-heading">
          <div>
            <h2>
              {lockedJob
                ? 'Hồ sơ ứng tuyển'
                : jobId
                  ? 'Đơn ứng tuyển theo công việc'
                  : 'Tất cả đơn ứng tuyển'}
              {demo && ' mẫu'}
            </h2>
            <p>
              {lockedJob
                ? 'Chỉ gồm đơn nộp vào tin này. Mỗi đơn giữ CV tại thời điểm nộp.'
                : 'Danh sách đơn trên toàn công ty, có thể lọc theo công việc và vòng tuyển dụng. Một ứng viên nộp nhiều công việc sẽ có các đơn riêng.'}
            </p>
          </div>
          {demo && <span className="hr-chip">{scoped.length} HỒ SƠ MẪU</span>}
        </div>
        {demo ? (
          <>
            <div className="hr-filter-bar">
              <label className="hr-search">
                <Search size={17} />
                <input
                  aria-label="Tìm ứng viên"
                  placeholder="Tên, email hoặc vị trí…"
                  value={query}
                  onChange={(event) => updateFilters({ search: event.target.value, page: '' })}
                />
              </label>
              {!lockedJob && (
                <select
                  aria-label="Lọc công việc ứng tuyển"
                  value={jobId}
                  onChange={(event) => onJobId(event.target.value)}
                >
                  <option value="">Tất cả công việc</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              )}
              <select
                aria-label="Lọc vòng tuyển dụng"
                value={stage}
                onChange={(event) => updateFilters({ stage: event.target.value, page: '' })}
              >
                <option value="">Tất cả các vòng</option>
                {Object.entries(stageLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="hr-pipeline" aria-label="Lọc theo vòng tuyển dụng">
              {['', ...Object.keys(stageLabels)].map((value) => (
                <button
                  key={value}
                  className={stage === value ? 'active' : ''}
                  data-stage={value || 'ALL'}
                  aria-pressed={stage === value}
                  onClick={() => updateFilters({ stage: stage === value ? '' : value, page: '' })}
                >
                  <span>{value ? stageLabels[value as ApplicationStage] : 'Tất cả'}</span>
                  <strong>
                    {value ? scoped.filter((item) => item.stage === value).length : scoped.length}
                  </strong>
                  <small>hồ sơ</small>
                </button>
              ))}
            </div>
            {filtered.length ? (
              <div className="hr-table-scroll">
                <table className="hr-table hr-applications-table">
                  <thead>
                    <tr>
                      <th scope="col">Ứng viên</th>
                      <th scope="col">Công việc ứng tuyển</th>
                      <th scope="col">Ngày nộp</th>
                      <th scope="col">Vòng tuyển dụng</th>
                      <th scope="col">Đánh giá AI</th>
                      <th scope="col">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id}>
                        <td data-label="Ứng viên">
                          <div className="hr-candidate-cell">
                            <span className={`hr-avatar ${item.color}`}>{initials(item.name)}</span>
                            <div>
                              <button className="hr-job-title" onClick={() => onSelect(item.id)}>
                                {item.name}
                              </button>
                              <small>{item.email}</small>
                            </div>
                          </div>
                        </td>
                        <td data-label="Công việc ứng tuyển">
                          {jobs.find((job) => String(job.id) === item.jobId)?.title ?? item.role}
                          <small>CV đã nộp · Bản mẫu</small>
                        </td>
                        <td data-label="Ngày nộp">{dateLabel(item.appliedAt)}</td>
                        <td data-label="Vòng tuyển dụng">
                          <span className={`hr-stage hr-stage-${item.stage.toLowerCase()}`}>
                            {stageLabels[item.stage]}
                          </span>
                        </td>
                        <td data-label="Đánh giá AI">
                          <button
                            className="hr-assessment-link"
                            aria-label={`Xem đánh giá AI của ${item.name}`}
                            onClick={() => onSelect(item.id, 'ai')}
                          >
                            <AssessmentBadge assessment={item.assessment} />
                          </button>
                        </td>
                        <td data-label="Chi tiết">
                          <button
                            className="hr-text-button hr-open-application"
                            aria-label={`Xem hồ sơ ${item.name}`}
                            onClick={() => onSelect(item.id)}
                          >
                            Xem hồ sơ <ArrowRight size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="hr-empty">
                <Search size={26} />
                <h3>Không tìm thấy hồ sơ</h3>
                <p>Thử thay đổi từ khóa, công việc hoặc vòng tuyển dụng.</p>
                <button
                  className="hr-button secondary"
                  onClick={() => {
                    updateFilters({
                      search: '',
                      stage: '',
                      page: '',
                      ...(!lockedJob ? { jobId: '' } : {}),
                    })
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
            <div className="hr-panel-note">
              Số lượng tính theo công việc đang chọn, trước khi lọc tên hoặc vòng. Đánh giá AI là
              mẫu, không tự chuyển vòng hay loại hồ sơ.
            </div>
          </>
        ) : (
          <div className="hr-empty">
            <Users size={28} />
            <h3>Chưa kết nối hồ sơ ứng tuyển</h3>
            <p>Chưa có dữ liệu để thống kê các vòng tuyển dụng.</p>
            <button className="hr-button secondary" onClick={onSample}>
              {lockedJob ? 'Xem tin mẫu' : 'Xem hồ sơ mẫu'}
            </button>
          </div>
        )}
      </section>
    </>
  )
}

export function ApplicationDetail({
  application,
  job,
  onUpdate,
  actor,
  initialTab,
  onTabChange,
}: {
  application: SampleApplication
  job?: RecruiterJob
  onUpdate: (application: SampleApplication) => void
  actor: string
  initialTab: string
  onTabChange?: (tab: string) => void
}) {
  const [localTab, setLocalTab] = useState(initialTab)
  const tab = onTabChange ? initialTab : localTab
  const setTab = onTabChange ?? setLocalTab
  const [nextStage, setNextStage] = useState<ApplicationStage>(application.stage)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  function move() {
    if (nextStage === application.stage) return
    if (!reason.trim()) {
      setError('Nhập lý do chuyển vòng để lưu vào lịch sử.')
      return
    }
    onUpdate({
      ...application,
      stage: nextStage,
      history: [
        ...application.history,
        history(
          `${stageLabels[application.stage]} → ${stageLabels[nextStage]}: ${reason.trim()}`,
          actor,
        ),
      ],
    })
    setReason('')
    setError('')
    setNotice('Đã chuyển vòng trong bản mẫu. Không gửi thông báo cho ứng viên.')
  }
  return (
    <div className="hr-application-detail">
      <div className="hr-application-header">
        <span className={`hr-avatar ${application.color}`}>{initials(application.name)}</span>
        <div>
          <h2>{application.name}</h2>
          <p>
            {job?.title ?? application.role} · Nộp ngày {dateLabel(application.appliedAt)}
          </p>
        </div>
        <span className={`hr-stage hr-stage-${application.stage.toLowerCase()}`}>
          {stageLabels[application.stage]}
        </span>
      </div>
      <div className="hr-detail-tabs" role="group" aria-label="Nội dung hồ sơ">
        {[
          ['cv', 'CV đã nộp'],
          ['ai', 'Đánh giá AI'],
          ['workflow', 'Chuyển vòng'],
          ['notes', `Ghi chú (${application.notes.length})`],
          ['history', 'Lịch sử'],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            className={tab === value ? 'active' : ''}
            onClick={() => {
              setTab(value)
              setError('')
              setNotice('')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className={`hr-application-grid${tab === 'cv' || tab === 'workflow' ? ' hr-application-grid-full' : ''}`}
      >
        <div hidden={tab === 'workflow'}>
          {tab === 'ai' && <ApplicationAssessment assessment={application.assessment} />}
          {tab === 'cv' && (
            <SubmittedCvViewer
              draft={sampleResume(application)}
              caption="CV minh họa tại thời điểm ứng tuyển · Không phải hồ sơ thật."
              sample
            />
          )}
          {tab === 'notes' && (
            <>
              <form
                className="hr-job-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!note.trim()) {
                    setError('Nhập nội dung ghi chú.')
                    return
                  }
                  onUpdate({
                    ...application,
                    notes: [...application.notes, history(note.trim(), actor)],
                  })
                  setNote('')
                  setError('')
                  setNotice('Đã thêm ghi chú nội bộ mẫu.')
                }}
              >
                <label>
                  Ghi chú nội bộ
                  <textarea
                    value={note}
                    maxLength={2000}
                    rows={4}
                    placeholder="Nhận xét hoặc nội dung cần làm rõ…"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <button className="hr-button" type="submit">
                  <Plus size={16} />
                  Thêm ghi chú mẫu
                </button>
              </form>
              {application.notes.length ? (
                <Timeline items={[...application.notes].reverse()} />
              ) : (
                <div className="hr-aside-empty">
                  <p>Chưa có ghi chú. Ghi chú chỉ dành cho nhân sự trong bản mẫu.</p>
                </div>
              )}
            </>
          )}
          {tab === 'history' && <Timeline items={[...application.history].reverse()} />}
        </div>
        {tab !== 'cv' && (
          <aside className="hr-application-side">
            <h3>Quản lý vòng tuyển dụng</h3>
            <p>
              Chuyển vòng là quyết định của HR. Bản mẫu không gửi email hoặc tạo lịch phỏng vấn.
            </p>
            <form
              className="hr-job-form"
              onSubmit={(event) => {
                event.preventDefault()
                move()
              }}
            >
              <label>
                Chuyển đến
                <select
                  value={nextStage}
                  disabled={application.stage === 'WITHDRAWN'}
                  onChange={(event) => setNextStage(event.target.value as ApplicationStage)}
                >
                  {Object.entries(stageLabels)
                    .filter(([value]) => value !== 'WITHDRAWN' || application.stage === 'WITHDRAWN')
                    .map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Lý do chuyển vòng
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={reason}
                  disabled={application.stage === 'WITHDRAWN'}
                  onChange={(event) => {
                    setReason(event.target.value)
                    setError('')
                  }}
                />
              </label>
              <button
                className="hr-button secondary"
                disabled={nextStage === application.stage || application.stage === 'WITHDRAWN'}
                type="submit"
              >
                Lưu vòng mẫu
              </button>
            </form>
            <hr />
            <h3>Yêu cầu công việc</h3>
            <div className="hr-skill-tags">
              {job?.draft.skills.map((skill) => (
                <span key={skill.name}>
                  {skill.name}
                  {skill.required ? ' *' : ''}
                </span>
              ))}
            </div>
            <small>
              * Kỹ năng bắt buộc. Kỹ năng trong CV là khai báo, chưa được AI kiểm chứng.
            </small>
          </aside>
        )}
      </div>
      {error && (
        <p className="hr-form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="hr-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  )
}

export function Timeline({
  items,
}: {
  items: { id: string; at: string; actor: string; text: string }[]
}) {
  return (
    <ol className="hr-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <small>
            {dateLabel(item.at, true)} · {item.actor}
          </small>
          <p>{item.text}</p>
        </li>
      ))}
    </ol>
  )
}
