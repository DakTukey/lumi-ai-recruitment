import { useId } from 'react'
import { ChartNoAxesCombined, ScanLine } from 'lucide-react'
import { stageLabels, type ApplicationStage } from '../recruiter-model'
import '../styles/job-application-charts.css'

const stageColors: Record<ApplicationStage, string> = {
  SUBMITTED: '#adcdf4',
  REVIEWING: '#d1b9ef',
  INTERVIEW: '#edcb8d',
  OFFER: '#9fd8de',
  HIRED: '#a7cbb0',
  REJECTED: '#efb1ba',
  WITHDRAWN: '#8793a5',
}

export function JobApplicationCharts({
  total,
  assessed,
  stages,
  sample = false,
}: {
  total: number
  assessed: number
  stages: Partial<Record<ApplicationStage, number>>
  sample?: boolean
}) {
  const titleId = useId()
  const completed = Math.min(total, Math.max(0, assessed))
  const pending = total - completed
  const percentage = total ? Math.round((completed / total) * 100) : 0
  return (
    <section
      className="hr-summary-charts"
      aria-label={`Biểu đồ đơn ứng tuyển của tin${sample ? ' · Mẫu' : ''}`}
    >
      <figure className="hr-summary-chart">
        <figcaption>
          <span className="hr-chart-icon">
            <ChartNoAxesCombined size={18} />
          </span>
          <div>
            <h3>Ứng viên ở các vòng</h3>
            <p>
              Phân bố {total} đơn của tin{sample ? ' · Mẫu' : ''}
            </p>
          </div>
        </figcaption>
        <ul className="hr-stage-chart">
          {(Object.entries(stageLabels) as [ApplicationStage, string][]).map(([stage, label]) => {
            const count = stages[stage] ?? 0
            const share = total ? (count / total) * 100 : 0
            return (
              <li key={stage} title={`${label}: ${count} đơn (${Math.round(share)}%)`}>
                <span className="hr-chart-stage-label">{label}</span>
                <div className="hr-chart-bar-track" aria-hidden="true">
                  <span style={{ width: `${share}%`, background: stageColors[stage] }} />
                </div>
                <span className="hr-chart-stage-value">
                  <strong>{count}</strong>
                  <small>{Math.round(share)}%</small>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="hr-chart-footnote">
          {total
            ? 'Tỷ lệ tính trên tổng đơn của tin, không phải tỷ lệ chuyển vòng.'
            : 'Chưa có đơn ứng tuyển cho tin này.'}
        </p>
      </figure>
      <figure className="hr-summary-chart hr-ai-coverage-chart">
        <figcaption>
          <span className="hr-chart-icon violet">
            <ScanLine size={18} />
          </span>
          <div>
            <h3>Tiến độ đánh giá AI</h3>
            <p>Số đơn đã có kết quả{sample ? ' mẫu' : ''}</p>
          </div>
        </figcaption>
        <div className="hr-coverage-ring">
          <svg viewBox="0 0 160 160" role="img" aria-labelledby={titleId}>
            <title id={titleId}>
              {total
                ? `${completed} trên ${total} đơn có kết quả AI, ${pending} đơn chưa có kết quả.`
                : 'Chưa có đơn để đánh giá AI.'}
            </title>
            <circle className="hr-ring-track" cx="80" cy="80" r="65" strokeWidth="12" fill="none" />
            {completed > 0 && (
              <circle
                className="hr-ring-progress"
                cx="80"
                cy="80"
                r="65"
                strokeWidth="12"
                fill="none"
                pathLength="100"
                strokeDasharray={`${(completed / total) * 100} 100`}
                transform="rotate(-90 80 80)"
              />
            )}
          </svg>
          <div aria-hidden="true">
            <strong>{total ? `${percentage}%` : '—'}</strong>
            <span>{total ? 'đã có kết quả' : 'chưa có đơn'}</span>
          </div>
        </div>
        <ul className="hr-coverage-legend">
          <li>
            <span>
              <i />
              Có kết quả AI
            </span>
            <strong>
              {completed} <small>đơn</small>
            </strong>
          </li>
          <li>
            <span>
              <i />
              Chưa có kết quả
            </span>
            <strong>
              {pending} <small>đơn</small>
            </strong>
          </li>
        </ul>
        <p className="hr-chart-footnote">Tỷ lệ có kết quả, không phải điểm phù hợp của ứng viên.</p>
      </figure>
    </section>
  )
}
