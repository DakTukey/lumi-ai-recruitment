import { useId } from 'react'
import { ChevronLeft, ChevronRight, CircleHelp, Check, ChevronRight as Arrow } from 'lucide-react'
import { radarGroups, radarLabel, radarPoint } from '../../applications/assessment-radar-model'
import type { JobMatchCriterion } from '../candidate-job-match-model'
import { jobMatchStatus } from '../candidate-job-match-model'

export function JobMatchScore({ score }: { score: number | null }) {
  const titleId = useId()
  return (
    <figure className="jm-score">
      <svg viewBox="0 0 120 120" role="img" aria-labelledby={titleId}>
        <title id={titleId}>
          {score == null ? 'Chưa có điểm đối chiếu' : `Mức đáp ứng CV–JD: ${score} trên 100`}
        </title>
        <circle cx="60" cy="60" r="49" className="jm-score-track" />
        {score != null && (
          <circle
            cx="60"
            cy="60"
            r="49"
            className="jm-score-value"
            pathLength="100"
            strokeDasharray={`${score} ${100 - score}`}
            transform="rotate(-90 60 60)"
          />
        )}
      </svg>
      <figcaption aria-hidden="true">
        <strong>{score ?? '—'}</strong>
        <span>/100</span>
      </figcaption>
    </figure>
  )
}

export function JobMatchBars({
  criteria,
  selected,
  onSelect,
  evidenceId,
}: {
  criteria: JobMatchCriterion[]
  selected: number
  onSelect: (index: number) => void
  evidenceId: string
}) {
  return (
    <div className="jm-bars">
      <p className="jm-chart-hint">
        Chọn tiêu chí để xem căn cứ trong CV. Thang mức đáp ứng 0–100.
      </p>
      <ul>
        {criteria.map((row, index) => (
          <li key={row.id}>
            <button
              type="button"
              aria-pressed={selected === index}
              aria-controls={evidenceId}
              onClick={() => onSelect(index)}
            >
              <span className="jm-bar-heading">
                <strong>{row.name}</strong>
                <span>
                  {row.score == null ? (
                    'Chưa đủ dữ liệu'
                  ) : (
                    <>
                      <b>{row.score}</b>/100
                    </>
                  )}
                  <Arrow size={13} />
                </span>
              </span>
              <span
                className={`jm-bar-track ${row.score == null ? 'is-unknown' : ''}`}
                aria-hidden="true"
              >
                <i
                  style={{
                    width: `${row.score ?? 0}%`,
                    background: jobMatchStatus[row.status].color,
                  }}
                />
              </span>
              <span className="jm-bar-caption">
                <span>{jobMatchStatus[row.status].label}</span>
                <span>{row.required ? 'Bắt buộc' : 'Ưu tiên'}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function JobMatchRadar({
  criteria,
  selected,
  onSelect,
  evidenceId,
}: {
  criteria: JobMatchCriterion[]
  selected: number
  onSelect: (index: number) => void
  evidenceId: string
}) {
  const titleId = useId(),
    descId = useId()
  const groups = radarGroups(criteria.length)
  const groupIndex = Math.max(
    0,
    groups.findIndex((group) => group.includes(selected)),
  )
  const indices = groups[groupIndex] ?? []
  if (indices.length < 3)
    return (
      <p className="jm-chart-hint">
        Radar cần ít nhất 3 tiêu chí. Chuyển sang thanh ngang để xem chi tiết.
      </p>
    )
  const points = (level: number) =>
    indices
      .map((_, axis) => {
        const point = radarPoint(axis, indices.length, level)
        return `${point.x},${point.y}`
      })
      .join(' ')
  const profile = indices
    .map((index, axis) => {
      const point = radarPoint(axis, indices.length, criteria[index].score ?? 0)
      return `${point.x},${point.y}`
    })
    .join(' ')
  return (
    <div className="jm-radar">
      {groups.length > 1 && (
        <div className="jm-radar-pages">
          <button
            type="button"
            aria-label="Nhóm tiêu chí trước"
            disabled={groupIndex === 0}
            onClick={() => onSelect(groups[groupIndex - 1][0])}
          >
            <ChevronLeft size={15} />
          </button>
          <span>
            Nhóm {groupIndex + 1}/{groups.length}
          </span>
          <button
            type="button"
            aria-label="Nhóm tiêu chí sau"
            disabled={groupIndex === groups.length - 1}
            onClick={() => onSelect(groups[groupIndex + 1][0])}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      <svg viewBox="0 0 360 340" role="img" aria-labelledby={`${titleId} ${descId}`}>
        <title id={titleId}>Radar mức đáp ứng CV với JD, thang 0–100</title>
        <desc id={descId}>
          {indices
            .map((i) => `${criteria[i].name}: ${criteria[i].score ?? 'chưa có bằng chứng'}`)
            .join('; ')}
          . Trục chưa có bằng chứng được đặt ở tâm và đánh dấu rỗng, không có nghĩa năng lực bằng
          không.
        </desc>
        {[25, 50, 75, 100].map((level) => (
          <polygon
            key={level}
            points={points(level)}
            className={`jm-radar-grid ${level === 100 ? 'jm-radar-target' : ''}`}
          />
        ))}
        {indices.map((index, axis) => {
          const end = radarPoint(axis, indices.length, 100),
            label = radarPoint(axis, indices.length, 100, 133)
          const lines = radarLabel(criteria[index].name)
          return (
            <g key={criteria[index].id}>
              <line x1="180" y1="170" x2={end.x} y2={end.y} className="jm-radar-spoke" />
              <text
                x={label.x}
                y={label.y - (lines.length - 1) * 6}
                textAnchor="middle"
                dominantBaseline="middle"
                className="jm-radar-label"
              >
                {lines.map((line, i) => (
                  <tspan key={i} x={label.x} dy={i === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          )
        })}
        <polygon points={profile} className="jm-radar-profile" />
        {[25, 50, 75, 100].map((level) => (
          <text key={level} x="186" y={170 - level + 3} className="jm-radar-tick">
            {level}
          </text>
        ))}
        {indices.map((index, axis) => {
          const row = criteria[index],
            point = radarPoint(axis, indices.length, row.score ?? 0)
          return (
            <circle
              key={row.id}
              cx={point.x}
              cy={point.y}
              r={selected === index ? 5 : 3.5}
              fill={row.score == null ? '#fffef9' : jobMatchStatus[row.status].color}
              stroke={jobMatchStatus[row.status].color}
              strokeWidth={2}
            />
          )
        })}
      </svg>
      <div className="jm-radar-legend">
        <span>
          <i />
          Mức đáp ứng từ CV
        </span>
        <span>
          <i />
          Mốc 100/100
        </span>
      </div>
      <div className="jm-radar-select" aria-label="Chọn tiêu chí radar">
        {indices.map((index) => (
          <button
            type="button"
            key={criteria[index].id}
            aria-pressed={selected === index}
            aria-controls={evidenceId}
            onClick={() => onSelect(index)}
          >
            {criteria[index].name}
            {criteria[index].score == null ? (
              <CircleHelp size={12} />
            ) : criteria[index].status === 'MATCHED' ? (
              <Check size={12} />
            ) : null}
          </button>
        ))}
      </div>
      <p className="jm-chart-hint">
        Điểm chưa nhân trọng số. Trục rỗng ở tâm là chưa có bằng chứng, không phải năng lực bằng 0.
      </p>
    </div>
  )
}
