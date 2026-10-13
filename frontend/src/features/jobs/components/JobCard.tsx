import { ArrowUpRight, Bookmark, MapPin, Clock3, Sparkles } from 'lucide-react'
import { useDemo } from '../../../app/providers/demo-context'
import { Link } from 'react-router-dom'
import type { Job } from '../../../types/domain'
export function CompanyMark({ job }: { job: Pick<Job, 'mark' | 'color'> }) {
  return <span className={`company-mark ${job.color}`}>{job.mark}</span>
}
export function JobCard({
  job,
  to,
  navigationState,
  onNavigate,
}: {
  job: Job
  to: string
  navigationState: { listKey: string; fromList: string }
  onNavigate: () => void
}) {
  const { saved, toggleSaved } = useDemo()
  const isSaved = saved.includes(job.id)
  return (
    <article className="job-card">
      <div className="job-card-top">
        <CompanyMark job={job} />
        <div className="company-name">
          {job.company}
          <span>{job.location}</span>
        </div>
        <button
          className={`icon-button save-button ${isSaved ? 'is-saved' : ''}`}
          aria-label={`${isSaved ? 'Bỏ lưu' : 'Lưu'} ${job.title}`}
          aria-pressed={isSaved}
          onClick={() => toggleSaved(job.id)}
        >
          <Bookmark size={19} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <Link className="job-title" to={to} state={navigationState} onClick={onNavigate}>
        {job.title}
        <ArrowUpRight size={19} />
      </Link>
      <div className="job-meta">
        {job.source !== 'database' && <span className="job-sample-badge">Tin mẫu</span>}
        <span>
          <MapPin size={13} />
          {job.mode}
        </span>
        <span>·</span>
        <span>{job.level}</span>
      </div>
      <div className="tags">
        {job.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="job-card-bottom">
        <strong>
          {job.salary}
          <small> / tháng</small>
        </strong>
        <span>
          <Clock3 size={12} />
          {job.posted}
        </span>
      </div>
      {job.featured && (
        <div className="job-featured">
          <Sparkles size={13} /> Cơ hội nổi bật <span>Đang tuyển</span>
        </div>
      )}
    </article>
  )
}
