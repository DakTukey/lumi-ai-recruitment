import { useId, useState } from 'react'
import { ChartNoAxesCombined, ChevronRight, FileText, ScanLine } from 'lucide-react'
import {
  assessmentChartData,
  evidenceGroup,
  evidenceLabels,
  type ChartCriterion,
  type EvidenceGroup,
} from '../assessment-chart-model'
import './assessment-charts.css'
import { AssessmentRadar } from './AssessmentRadar'

const colors: Record<EvidenceGroup, string> = {
  MATCHED: '#a7cbb0',
  CLARIFY: '#edcb8d',
  NO_EVIDENCE: '#adcdf4',
}
const number = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)

export function AssessmentCharts({
  criteria,
  sample = false,
}: {
  criteria: ChartCriterion[]
  sample?: boolean
}) {
  const [selected, setSelected] = useState(0)
  const panelId = useId()
  const titleId = useId()
  const { rows, groups } = assessmentChartData(criteria, sample)
  const selectedIndex = selected < rows.length ? selected : 0
  const active = rows[selectedIndex]
  if (!active)
    return <p className="hr-assessment-note">Chưa có dữ liệu từng tiêu chí để vẽ biểu đồ.</p>
  let offset = 0
  const segments = (Object.keys(groups) as EvidenceGroup[]).map((group) => {
    const length = (groups[group] / rows.length) * 100
    const segment = { group, length, offset }
    offset += length
    return segment
  })
  return (
    <section
      className="hr-criterion-insights"
      aria-label={`Biểu đồ đánh giá từng ứng viên${sample ? ' · Mẫu' : ''}`}
    >
      <AssessmentRadar
        rows={rows}
        selected={selectedIndex}
        onSelect={setSelected}
        panelId={panelId}
        sample={sample}
      />
      <section
        className="hr-selected-evidence"
        id={panelId}
        aria-label={`Bằng chứng và lý do: ${active.skill}`}
      >
        <div className="hr-selected-evidence-heading">
          <h3>{active.skill}</h3>
          <span style={{ color: colors[evidenceGroup(active.status)] }}>
            {evidenceLabels[evidenceGroup(active.status)]}
          </span>
        </div>
        <p className="hr-assessment-source">
          <FileText size={14} />
          {active.source}
        </p>
        <p className="hr-selected-evidence-score">
          {sample ? 'Điểm mẫu' : 'Điểm đóng góp'}:{' '}
          <strong>
            {number(active.earned)}/{number(active.maximum)}
          </strong>
          {!sample && (
            <>
              {' '}
              · Mức đáp ứng CV/JD: {number(active.fit)}/100 · Trọng số: {number(active.weight)}
            </>
          )}
          {active.weight === 0 && ' · Không cộng vào điểm tổng'}
        </p>
        <h4>Bằng chứng trong CV</h4>
        {active.evidence ? (
          <blockquote>{active.evidence}</blockquote>
        ) : (
          <p>Chưa có trích dẫn bằng chứng cho tiêu chí này.</p>
        )}
        <h4>Lý do chấm điểm</h4>
        <p>{active.reason || 'Chưa có giải thích chi tiết cho tiêu chí này.'}</p>
        {!sample && (
          <p className="hr-criterion-chart-footnote">
            Điểm đóng góp = mức đáp ứng × trọng số / tổng trọng số. Giá trị hiển thị được làm tròn;
            điểm tổng giữ nguyên từ kết quả đã lưu.
          </p>
        )}
      </section>
      <div className="hr-criterion-charts">
        <section className="hr-criterion-chart">
          <header>
            <ChartNoAxesCombined size={20} />
            <div>
              <h3>Điểm theo từng tiêu chí</h3>
              <p>Điểm đóng góp / điểm tối đa{sample ? ' · Mẫu' : ''}</p>
            </div>
          </header>
          <p className="hr-criterion-chart-hint">
            Chọn một thanh để xem bằng chứng và lý do chấm điểm.
          </p>
          <ul className="hr-criterion-bars">
            {rows.map((item, index) => (
              <li key={`${item.skill}:${index}`}>
                <button
                  type="button"
                  aria-pressed={selectedIndex === index}
                  aria-controls={panelId}
                  onClick={() => setSelected(index)}
                >
                  <span className="hr-criterion-bar-heading">
                    <strong>{item.skill}</strong>
                    <span>
                      {item.maximum > 0 ? (
                        <>
                          <b>{number(item.earned)}</b>/{number(item.maximum)}
                        </>
                      ) : (
                        'Không tính điểm'
                      )}
                      <ChevronRight size={14} />
                    </span>
                  </span>
                  <span className="hr-criterion-bar-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${item.maximum > 0 ? Math.min(100, Math.max(0, item.fit)) : 0}%`,
                        background: colors[evidenceGroup(item.status)],
                      }}
                    />
                  </span>
                  <span className="hr-criterion-bar-caption">
                    <span>{evidenceLabels[evidenceGroup(item.status)]}</span>
                    <span>
                      {item.required === undefined
                        ? `Trọng số ${number(item.weight)}`
                        : item.required
                          ? 'Bắt buộc'
                          : 'Ưu tiên'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="hr-criterion-chart-footnote">
            Độ dài thanh là tỷ lệ điểm đạt của tiêu chí. Điểm đóng góp phụ thuộc trọng số; không
            phải mức thành thạo kỹ năng.
          </p>
        </section>
        <figure className="hr-criterion-chart hr-evidence-chart">
          <figcaption>
            <ScanLine size={20} />
            <div>
              <h3>Kết quả đối chiếu</h3>
              <p>
                Phân bố {rows.length} tiêu chí{sample ? ' mẫu' : ''}
              </p>
            </div>
          </figcaption>
          <div className="hr-evidence-ring">
            <svg viewBox="0 0 160 160" role="img" aria-labelledby={titleId}>
              <title id={titleId}>
                {segments
                  .map(({ group }) => `${evidenceLabels[group]}: ${groups[group]} tiêu chí`)
                  .join('; ')}
              </title>
              <circle
                cx="80"
                cy="80"
                r="63"
                fill="none"
                stroke="var(--hr-raised)"
                strokeWidth="13"
              />
              {segments
                .filter((item) => item.length > 0)
                .map(({ group, length, offset: start }) => (
                  <circle
                    key={group}
                    cx="80"
                    cy="80"
                    r="63"
                    fill="none"
                    stroke={colors[group]}
                    strokeWidth="13"
                    pathLength="100"
                    strokeDasharray={`${length} ${100 - length}`}
                    strokeDashoffset={-start}
                    transform="rotate(-90 80 80)"
                  />
                ))}
            </svg>
            <div aria-hidden="true">
              <strong>{rows.length}</strong>
              <span>tiêu chí đối chiếu</span>
            </div>
          </div>
          <ul className="hr-evidence-legend">
            {segments.map(({ group }) => (
              <li key={group}>
                <span>
                  <i style={{ background: colors[group] }} />
                  {evidenceLabels[group]}
                </span>
                <strong>{groups[group]}</strong>
              </li>
            ))}
          </ul>
          <p className="hr-criterion-chart-footnote">
            Đếm theo tiêu chí, không theo trọng số. Chưa có bằng chứng không đồng nghĩa không có kỹ
            năng.
          </p>
        </figure>
      </div>
    </section>
  )
}
