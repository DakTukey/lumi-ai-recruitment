import { BriefcaseBusiness, CalendarDays, MapPin, Wallet, Users } from 'lucide-react'
import type { Job } from '../../../types/domain'
import type { RecruiterJob } from '../recruiter-model'
import { contractLabels, criterionLabels, dateLabel, expired } from '../recruiter-model'

export function RecruiterJobPreview({
  job,
  internal = false,
  showHeading = true,
}: {
  job: Job & Partial<RecruiterJob>
  internal?: boolean
  showHeading?: boolean
}) {
  return (
    <div className="hr-job-detail hr-preview">
      <span className="hr-eyebrow">LUMI STUDIO · {job.category}</span>
      {showHeading && <h2>{job.title || 'Tên vị trí tuyển dụng'}</h2>}
      <p>
        {job.level} · {job.mode}
      </p>
      <div className="hr-preview-facts">
        <span>
          <Users size={18} />
          <span>
            <small>Số lượng cần tuyển</small>
            <strong>{job.headcount != null ? `${job.headcount} người` : 'Chưa cung cấp'}</strong>
          </span>
        </span>
        <span>
          <Wallet size={18} />
          <span>
            <small>Mức lương</small>
            <strong>{job.salary}</strong>
          </span>
        </span>
        <span>
          <MapPin size={18} />
          <span>
            <small>Địa điểm</small>
            <strong>{job.location}</strong>
          </span>
        </span>
        <span>
          <BriefcaseBusiness size={18} />
          <span>
            <small>Hình thức hợp đồng</small>
            <strong>{contractLabels[job.employmentType ?? ''] ?? 'Chưa cung cấp'}</strong>
          </span>
        </span>
        <span>
          <CalendarDays size={18} />
          <span>
            <small>Hạn nộp hồ sơ</small>
            <strong className={expired(job.deadline) ? 'hr-warning-text' : ''}>
              {job.deadline ? dateLabel(job.deadline) : 'Không giới hạn'}
              {expired(job.deadline) && ' · Đã hết hạn'}
            </strong>
          </span>
        </span>
      </div>
      {job.draft ? (
        <div className="hr-preview-skills">
          {[true, false].map((required) => {
            const skills = job.draft?.skills.filter((item) => item.required === required) ?? []
            return (
              skills.length > 0 && (
                <section key={String(required)}>
                  <h3>{required ? 'Kỹ năng bắt buộc' : 'Kỹ năng ưu tiên'}</h3>
                  <div className="hr-skill-tags">
                    {skills.map((item) => (
                      <span key={item.name}>{item.name}</span>
                    ))}
                  </div>
                </section>
              )
            )
          })}
        </div>
      ) : (
        <section>
          <h3>Kỹ năng</h3>
          <div className="hr-skill-tags">
            {job.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>
      )}
      {[
        ['Mô tả công việc', job.description],
        ['Yêu cầu ứng viên', job.requirements],
        ['Quyền lợi', job.benefits],
      ].map(
        ([label, content]) =>
          content && (
            <section key={label}>
              <h3>{label}</h3>
              <p>{content}</p>
            </section>
          ),
      )}
      {!!job.draft?.criteria.length && (
        <section>
          <h3>Tiêu chí tuyển dụng</h3>
          <div className="hr-criteria-preview">
            {job.draft.criteria.map((item) => (
              <div key={item.id}>
                <span className="hr-chip">{criterionLabels[item.type]}</span>
                <p>{item.description}</p>
                <small>
                  {item.required ? 'Bắt buộc' : 'Ưu tiên'}
                  {internal && ` · Trọng số ${item.weight}`}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
