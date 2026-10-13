import { useId } from 'react'
import { ChevronLeft, ChevronRight, Radar } from 'lucide-react'
import { evidenceGroup, evidenceLabels, type assessmentChartData } from '../assessment-chart-model'
import { radarGroups, radarLabel, radarPoint } from '../assessment-radar-model'

type RadarRow = ReturnType<typeof assessmentChartData>['rows'][number]
const colors = { MATCHED: '#a7cbb0', CLARIFY: '#edcb8d', NO_EVIDENCE: '#adcdf4' }
const number = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)

export function AssessmentRadar({
  rows,
  selected,
  onSelect,
  panelId,
  sample,
}: {
  rows: RadarRow[]
  selected: number
  onSelect: (index: number) => void
  panelId: string
  sample: boolean
}) {
  const titleId = useId()
  const descriptionId = useId()
  const groups = radarGroups(rows.length)
  const groupIndex = Math.max(
    0,
    groups.findIndex((group) => group.includes(selected)),
  )
  const indices = groups[groupIndex] ?? []
  const points = (value: number) =>
    indices
      .map((_, axis) => {
        const point = radarPoint(axis, indices.length, value)
        return `${point.x},${point.y}`
      })
      .join(' ')
  const profile = indices
    .map((index, axis) => {
      const point = radarPoint(axis, indices.length, rows[index].fit)
      return `${point.x},${point.y}`
    })
    .join(' ')
  return (
    <section
      className="hr-criterion-chart hr-assessment-radar"
      aria-label="Radar mức đáp ứng CV và JD"
    >
      <header>
        <Radar size={20} />
        <div>
          <h3>Tổng quan mức đáp ứng CV/JD</h3>
          <p>Radar theo tiêu chí · Thang 0–100{sample ? ' · Mẫu' : ''}</p>
        </div>
      </header>
      {indices.length < 3 ? (
        <p className="hr-criterion-chart-hint">
          Cần ít nhất 3 tiêu chí để hiển thị radar. Bạn vẫn có thể xem điểm và bằng chứng ở các
          thanh bên dưới.
        </p>
      ) : (
        <>
          {groups.length > 1 && (
            <div className="hr-radar-pagination" aria-label="Nhóm tiêu chí radar">
              <button
                type="button"
                disabled={groupIndex === 0}
                aria-label="Nhóm tiêu chí trước"
                onClick={() => onSelect(groups[groupIndex - 1][0])}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Nhóm {groupIndex + 1}/{groups.length} · {indices.length}/{rows.length} tiêu chí
              </span>
              <button
                type="button"
                disabled={groupIndex === groups.length - 1}
                aria-label="Nhóm tiêu chí tiếp theo"
                onClick={() => onSelect(groups[groupIndex + 1][0])}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <div className="hr-radar-content">
            <figure className="hr-radar-figure">
              <svg viewBox="0 0 360 340" role="img" aria-labelledby={`${titleId} ${descriptionId}`}>
                <title id={titleId}>
                  Mức đáp ứng các tiêu chí so với JD{sample ? ' · Dữ liệu mẫu' : ''}
                </title>
                <desc id={descriptionId}>
                  {indices
                    .map(
                      (index) =>
                        `${rows[index].skill}: ${number(rows[index].fit)}/100, ${evidenceLabels[evidenceGroup(rows[index].status)]}`,
                    )
                    .join('; ')}
                  . Vòng ngoài là mức đáp ứng 100/100. Đây không phải mức thành thạo đã xác minh.
                </desc>
                {[25, 50, 75, 100].map((level) => (
                  <polygon
                    key={level}
                    points={points(level)}
                    className={`hr-radar-grid ${level === 100 ? 'hr-radar-target' : ''}`}
                  />
                ))}
                {indices.map((index, axis) => {
                  const end = radarPoint(axis, indices.length, 100)
                  const label = radarPoint(axis, indices.length, 100, 132)
                  const lines = radarLabel(rows[index].skill)
                  return (
                    <g key={index}>
                      <line x1="180" y1="170" x2={end.x} y2={end.y} className="hr-radar-spoke" />
                      <text
                        x={label.x}
                        y={label.y - (lines.length - 1) * 6}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className={`hr-radar-label ${selected === index ? 'is-selected' : ''}`}
                      >
                        {lines.map((line, lineIndex) => (
                          <tspan key={lineIndex} x={label.x} dy={lineIndex === 0 ? 0 : 13}>
                            {line}
                          </tspan>
                        ))}
                      </text>
                    </g>
                  )
                })}
                <polygon points={profile} className="hr-radar-profile" />
                {[25, 50, 75, 100].map((level) => (
                  <text key={level} x="186" y={170 - level + 3} className="hr-radar-tick">
                    {level}
                  </text>
                ))}
                <text x="180" y="183" textAnchor="middle" className="hr-radar-tick">
                  0
                </text>
                {indices.map((index, axis) => {
                  const point = radarPoint(axis, indices.length, rows[index].fit)
                  return (
                    <circle
                      key={index}
                      cx={point.x}
                      cy={point.y}
                      r={selected === index ? 5 : 3.5}
                      fill={colors[evidenceGroup(rows[index].status)]}
                      className={selected === index ? 'hr-radar-selected-dot' : 'hr-radar-dot'}
                    />
                  )
                })}
              </svg>
              <figcaption className="hr-radar-legend">
                <span>
                  <i className="hr-radar-legend-profile" />
                  Mức đáp ứng từ CV
                </span>
                <span>
                  <i className="hr-radar-legend-target" />
                  Mốc 100/100
                </span>
              </figcaption>
            </figure>
            <div className="hr-radar-criteria">
              <p className="hr-criterion-chart-hint">
                Chọn tiêu chí để xem bằng chứng và lý do bên dưới.
              </p>
              <ul>
                {indices.map((index) => {
                  const item = rows[index]
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        aria-pressed={selected === index}
                        aria-controls={panelId}
                        onClick={() => onSelect(index)}
                      >
                        <span className="hr-radar-criterion-heading">
                          <strong>{item.skill}</strong>
                          <b>
                            {number(item.fit)}
                            <small>/100</small>
                          </b>
                        </span>
                        <span className="hr-radar-criterion-status">
                          <i style={{ background: colors[evidenceGroup(item.status)] }} />
                          {evidenceLabels[evidenceGroup(item.status)]}
                          {item.weight === 0 && ' · Không cộng điểm'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <p className="hr-criterion-chart-footnote">
            Các trục dùng cùng thang mức đáp ứng 0–100, chưa nhân trọng số. Hình radar không biểu
            thị điểm tổng hay năng lực đã xác minh. Chưa có bằng chứng không đồng nghĩa không có kỹ
            năng.
          </p>
        </>
      )}
    </section>
  )
}
