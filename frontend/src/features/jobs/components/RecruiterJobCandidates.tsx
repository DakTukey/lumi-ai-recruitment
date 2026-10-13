import { RecruiterRealJobSummary } from '../../applications/components/RecruiterRealApplications'
import { ArrowRight, Sparkles } from 'lucide-react'
import { AssessmentBadge } from './ApplicationAssessment'
import { JobApplicationCharts } from './JobApplicationCharts'
import { stageLabels } from '../recruiter-model'
import { jobApplicationSummary } from '../job-candidates-model'
import type { SampleApplication } from '../recruiter-model'

export function RecruiterJobCandidates({
  applications,
  jobId,
  title,
  demo,
  onSelect,
  onAll,
  onSample,
  refreshKey = 0,
}: {
  applications: SampleApplication[]
  jobId: string
  title: string
  demo: boolean
  onSelect: (id: string, tab?: string) => void
  onAll: () => void
  onSample: () => void
  refreshKey?: number
}) {
  if (!demo)
    return (
      <RecruiterRealJobSummary
        onSelect={onSelect}
        refreshKey={refreshKey}
        jobId={jobId}
        title={title}
        onAll={onAll}
      />
    )
  const { scoped, assessed, ranked } = jobApplicationSummary(demo ? applications : [], jobId)
  const stages: Partial<Record<SampleApplication['stage'], number>> = {}
  scoped.forEach((item) => {
    stages[item.stage] = (stages[item.stage] ?? 0) + 1
  })
  return (
    <section className="hr-job-candidates">
      <h2>{title}</h2>
      <div className="hr-preview-label">
        <Sparkles size={17} />
        {demo
          ? 'Tổng hợp từ đánh giá mẫu · Chưa kết nối AI thật'
          : 'Chưa kết nối hồ sơ và đánh giá AI'}
      </div>
      {demo ? (
        <>
          <div className="hr-job-candidate-stats">
            <div>
              <strong>{scoped.length}</strong>
              <span>Hồ sơ của tin này</span>
            </div>
            <div>
              <strong>{scoped.length ? `${assessed.length}/${scoped.length}` : '—'}</strong>
              <span>Có đánh giá mẫu</span>
            </div>
            <div>
              <strong>{scoped.length - assessed.length}</strong>
              <span>Chưa có kết quả</span>
            </div>
          </div>
          <JobApplicationCharts
            total={scoped.length}
            assessed={assessed.length}
            stages={stages}
            sample
          />
          <h3>Ứng viên ưu tiên xem · Mẫu</h3>
          <p>
            Sắp xếp theo điểm phù hợp mẫu đã có. Chỉ gồm hồ sơ đang ở vòng đã nộp, xem xét hoặc
            phỏng vấn; chưa đánh giá không tính thành điểm 0.
          </p>
          {ranked.length ? (
            <div className="hr-job-candidate-list">
              {ranked.slice(0, 5).map((application) => (
                <article key={application.id}>
                  <div className="hr-job-candidate-heading">
                    <h4>{application.name}</h4>
                    <AssessmentBadge assessment={application.assessment} />
                  </div>
                  <span className={`hr-stage hr-stage-${application.stage.toLowerCase()}`}>
                    {stageLabels[application.stage]}
                  </span>
                  <p>
                    {application.assessment?.status === 'COMPLETED'
                      ? application.assessment.summary
                      : ''}
                  </p>
                  <div className="hr-row-actions">
                    <button className="hr-text-button" onClick={() => onSelect(application.id)}>
                      Xem hồ sơ <ArrowRight size={16} />
                    </button>
                    <button
                      className="hr-text-button"
                      onClick={() => onSelect(application.id, 'ai')}
                    >
                      Xem đánh giá AI <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="hr-aside-empty">
              <h3>
                {scoped.length
                  ? 'Chưa có hồ sơ phù hợp để xếp ưu tiên'
                  : 'Tin này chưa có hồ sơ mẫu'}
              </h3>
              <p>
                {scoped.length
                  ? 'Hồ sơ chưa có đánh giá hoặc đã chuyển sang offer, đã tuyển, đã loại, đã rút. Xem tất cả để kiểm tra đầy đủ.'
                  : 'Không dùng hồ sơ của công việc khác để thay thế.'}
              </p>
            </div>
          )}
          <p className="hr-assessment-note">
            Hiển thị tối đa 5 hồ sơ ưu tiên từ kết quả hiện có. Đây chưa phải kết luận về toàn bộ
            ứng viên. HR vẫn xem được tất cả hồ sơ và quyết định chuyển vòng.
          </p>
          <button className="hr-button secondary" onClick={onAll}>
            Xem tất cả {scoped.length} hồ sơ của tin <ArrowRight size={16} />
          </button>
        </>
      ) : (
        <div className="hr-empty">
          <h3>Chưa có dữ liệu để tổng hợp</h3>
          <p>
            Tin tuyển dụng đang dùng dữ liệu thật. Chưa thể thống kê hoặc xếp ưu tiên ứng viên cho
            tin này.
          </p>
          <button className="hr-button secondary" onClick={onSample}>
            Xem tin mẫu
          </button>
        </div>
      )}
    </section>
  )
}
