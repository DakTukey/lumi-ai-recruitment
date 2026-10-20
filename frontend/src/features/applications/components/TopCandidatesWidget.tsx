import { useEffect, useState } from 'react'
import { ArrowRight, Sparkles, Trophy } from 'lucide-react'
import { getTopCandidates } from '../../../services/assessment.service'
import type { TopCandidate } from '../../../services/assessment.service'
import { applicationStages } from '../../../services/application.service'

const scoreColor = (score: number) =>
  score >= 75 ? 'top-score-green' : score >= 50 ? 'top-score-orange' : 'top-score-red'

const medal = ['🥇', '🥈', '🥉']

/**
 * Widget "Top ứng viên được AI gợi ý" — hiển thị đầu trang danh sách hồ sơ
 * khi HR đang lọc theo một job cụ thể và job đó đã có ứng viên được phân tích.
 */
export function TopCandidatesWidget({
  jobId,
  refreshKey = 0,
  onSelect,
}: {
  jobId: string
  refreshKey?: number
  onSelect: (applicationId: string, tab?: string) => void
}) {
  const [result, setResult] = useState<{ key: string; items: TopCandidate[] } | null>(null)
  const key = `${jobId}:${refreshKey}`
  const candidates = result?.key === key ? result.items : null

  useEffect(() => {
    if (!jobId) return
    let active = true
    getTopCandidates(jobId, 5)
      .then((data) => {
        if (active) setResult({ key, items: data })
      })
      .catch(() => {
        if (active) setResult({ key, items: [] })
      })
    return () => {
      active = false
    }
  }, [jobId, key])

  // Ẩn widget nếu không có job được chọn hoặc chưa có ai được phân tích
  if (!jobId || !candidates || candidates.length === 0) return null

  return (
    <section className="top-candidates-widget">
      <div className="top-candidates-header">
        <span className="top-candidates-title">
          <Sparkles size={16} />
          AI gợi ý · Top {candidates.length} ứng viên tiềm năng nhất
        </span>
        <span className="top-candidates-note">Dựa trên điểm phân tích CV × JD</span>
      </div>

      <div className="top-candidates-list">
        {candidates.map((c, i) => (
          <div key={c.applicationId} className="top-candidate-card">
            {/* Rank medal */}
            <span className="top-candidate-rank">{medal[i] ?? `#${i + 1}`}</span>

            {/* Score */}
            <div className={`top-candidate-score ${scoreColor(c.score)}`}>
              <strong>{c.score}</strong>
              <small>/100</small>
            </div>

            {/* Info */}
            <div className="top-candidate-info">
              <button className="top-candidate-name" onClick={() => onSelect(c.applicationId)}>
                {c.candidateName}
              </button>
              <p className="top-candidate-summary">{c.summary}</p>

              {/* Matched skills */}
              {c.matchedSkills.length > 0 && (
                <div className="top-candidate-skills">
                  {c.matchedSkills.slice(0, 4).map((s) => (
                    <span key={s} className="skill-matched">
                      {s}
                    </span>
                  ))}
                  {c.matchedSkills.length > 4 && (
                    <span className="top-candidate-more">+{c.matchedSkills.length - 4}</span>
                  )}
                </div>
              )}
            </div>

            {/* Status + action */}
            <div className="top-candidate-actions">
              <span className={`hr-stage hr-stage-${c.applicationStatus.toLowerCase()}`}>
                {applicationStages[c.applicationStatus as keyof typeof applicationStages] ??
                  c.applicationStatus}
              </span>
              <button
                className="hr-text-button"
                onClick={() => onSelect(c.applicationId, 'ai')}
                aria-label={`Xem đánh giá AI của ${c.candidateName}`}
              >
                Chi tiết AI <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="top-candidates-footer">
        <Trophy size={13} />
        Chỉ hiển thị ứng viên đã được AI phân tích · Bấm tên để xem hồ sơ đầy đủ
      </p>
    </section>
  )
}
