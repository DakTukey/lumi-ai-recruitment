import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Award,
  Check,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  Loader2,
  RotateCw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import {
  generateInterviewScorecard,
  getInterviewScorecard,
  RECOMMENDATION_LABELS,
  saveInterviewScorecard,
} from '../../../services/interview-scorecard.service'
import type {
  InterviewScorecard as ScorecardData,
  RecommendationType,
  ScorecardSection,
} from '../../../services/interview-scorecard.service'
import { submittedDate } from '../../../services/application.service'
import './interview-scorecard.css'

export function InterviewScorecard({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<ScorecardData | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true
    getInterviewScorecard(applicationId)
      .then((res) => {
        if (active) setData(res)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được phiếu phỏng vấn.')
      })
    return () => {
      active = false
    }
  }, [applicationId])

  async function handleGenerate(force: boolean) {
    if (loading) return
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await generateInterviewScorecard(applicationId, force)
      if (mounted.current) {
        setData(res)
        setSuccessMsg(force ? 'Đã tạo mới lại phiếu phỏng vấn AI.' : 'Đã tạo phiếu phỏng vấn AI thành công.')
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Không thể tạo phiếu phỏng vấn AI lúc này.')
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  function handleScoreChange(secIdx: number, qIdx: number, score: number) {
    if (!data) return
    const newSections: ScorecardSection[] = JSON.parse(JSON.stringify(data.sections))
    const current = newSections[secIdx].questions[qIdx].score
    newSections[secIdx].questions[qIdx].score = current === score ? null : score
    setData({ ...data, sections: newSections })
  }

  function handleQuestionNotesChange(secIdx: number, qIdx: number, notes: string) {
    if (!data) return
    const newSections: ScorecardSection[] = JSON.parse(JSON.stringify(data.sections))
    newSections[secIdx].questions[qIdx].notes = notes
    setData({ ...data, sections: newSections })
  }

  function handleRecommendationChange(rec: RecommendationType) {
    if (!data) return
    setData({ ...data, recommendation: data.recommendation === rec ? null : rec })
  }

  function handleOverallNotesChange(notes: string) {
    if (!data) return
    setData({ ...data, overallNotes: notes })
  }

  async function handleSave(status: 'DRAFT' | 'COMPLETED') {
    if (!data || saving) return
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const res = await saveInterviewScorecard(applicationId, {
        status,
        recommendation: data.recommendation,
        overallNotes: data.overallNotes,
        sections: data.sections,
      })
      if (mounted.current) {
        setData(res)
        setSuccessMsg(
          status === 'COMPLETED'
            ? 'Đã hoàn tất và lưu phiếu phỏng vấn thành công!'
            : 'Đã lưu bản nháp phiếu phỏng vấn.',
        )
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Không thể lưu phiếu phỏng vấn.')
      }
    } finally {
      if (mounted.current) setSaving(false)
    }
  }

  if (data === undefined) {
    return <p role="status">Đang tải phiếu phỏng vấn…</p>
  }

  if (!data) {
    return (
      <div className="hr-empty">
        <ClipboardList size={36} />
        <h3>Chưa có phiếu phỏng vấn cho ứng viên này</h3>
        <p>
          AI sẽ tổng hợp các kỹ năng còn thiếu trong CV, điểm nghi vấn mã nguồn từ GitHub và các
          thông tin làm rõ để soạn sẵn bộ câu hỏi phỏng vấn chuẩn hóa kèm tiêu chí chấm điểm
          (Rubric).
        </p>
        {error && (
          <div className="hr-form-error" role="alert" style={{ marginBottom: 16 }}>
            <p>{error}</p>
          </div>
        )}
        <button
          type="button"
          className="hr-button"
          onClick={() => void handleGenerate(false)}
          disabled={loading}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'Đang soạn câu hỏi phỏng vấn…' : 'Tạo phiếu phỏng vấn AI'}
        </button>
      </div>
    )
  }

  // Tính điểm trung bình hiển thị
  let ratedCount = 0
  let totalPoints = 0
  for (const s of data.sections) {
    for (const q of s.questions) {
      if (q.score) {
        ratedCount++
        totalPoints += q.score
      }
    }
  }
  const avgScore = ratedCount > 0 ? (totalPoints / ratedCount).toFixed(1) : null

  return (
    <div className="scorecard-tab">
      {error && (
        <div className="hr-form-error" role="alert">
          <p>{error}</p>
        </div>
      )}
      {successMsg && (
        <div
          role="status"
          style={{
            background: '#ecfdf5',
            color: '#065f46',
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #a7f3d0',
            fontSize: '0.9rem',
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Hero Header */}
      <div className="scorecard-hero">
        <div className="scorecard-hero-left">
          <div className="scorecard-icon-badge">
            <ClipboardList size={26} />
          </div>
          <div className="scorecard-hero-meta">
            <h3>
              Phiếu phỏng vấn ứng viên
              <span
                className={`scorecard-status-badge ${
                  data.status === 'COMPLETED' ? 'completed' : 'draft'
                }`}
              >
                {data.status === 'COMPLETED' ? 'Đã hoàn tất' : 'Bản nháp'}
              </span>
            </h3>
            <span className="submitted-caption">
              Người phỏng vấn: {data.interviewerName || 'Chưa gán'} · Cập nhật:{' '}
              {submittedDate(data.updatedAt)}
            </span>
          </div>
        </div>

        <div className="scorecard-hero-right">
          <div className="scorecard-overall-score">
            <span className="score-star-number">
              {avgScore ? (
                <>
                  {avgScore} <Star size={20} fill="#f59e0b" color="#f59e0b" />
                </>
              ) : (
                '--'
              )}
            </span>
            <span className="score-label">
              Điểm TB ({ratedCount}/
              {data.sections.reduce((acc, s) => acc + s.questions.length, 0)} câu)
            </span>
          </div>

          <button
            type="button"
            className="hr-button secondary"
            onClick={() => void handleGenerate(true)}
            disabled={loading}
            title="Tạo lại bộ câu hỏi AI mới"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
            {loading ? 'Đang tạo…' : 'Tạo lại câu hỏi AI'}
          </button>
        </div>
      </div>

      {/* Sections and Questions */}
      {data.sections.map((section, secIdx) => (
        <div key={secIdx} className="scorecard-section">
          <h4 className="scorecard-section-title">
            <Award size={18} />
            {section.title}
          </h4>

          {section.questions.map((q, qIdx) => (
            <div key={q.id || qIdx} className="scorecard-question-card">
              <div className="scorecard-question-header">
                <p className="scorecard-q-text">
                  <strong>Câu {qIdx + 1}:</strong> {q.question}
                </p>
                <span className="scorecard-target-tag">{q.target_skill}</span>
              </div>

              {q.context && (
                <div className="scorecard-context-box">
                  <strong>Mục tiêu kiểm chứng:</strong> {q.context}
                </div>
              )}

              {/* Rubric Guidance */}
              <div className="scorecard-rubrics-grid">
                <div className="rubric-card good">
                  <div className="rubric-title">
                    <CheckCircle2 size={14} /> Tiêu chuẩn câu trả lời Đạt:
                  </div>
                  <div>{q.rubric_good}</div>
                </div>
                <div className="rubric-card poor">
                  <div className="rubric-title">
                    <AlertCircle size={14} /> Dấu hiệu cảnh báo / Chưa đạt:
                  </div>
                  <div>{q.rubric_poor}</div>
                </div>
              </div>

              {/* Star Rating */}
              <div className="scorecard-rating-row">
                <span className="scorecard-rating-label">Đánh giá câu trả lời:</span>
                <div className="rating-stars-group">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-rate-btn ${q.score && q.score >= star ? 'active' : ''}`}
                      onClick={() => handleScoreChange(secIdx, qIdx, star)}
                      title={`${star} sao`}
                    >
                      <Star
                        size={22}
                        fill={q.score && q.score >= star ? '#f59e0b' : 'none'}
                        color={q.score && q.score >= star ? '#f59e0b' : '#9ca3af'}
                      />
                    </button>
                  ))}
                </div>
                {q.score && (
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
                    {q.score === 1
                      ? '1 - Rất kém'
                      : q.score === 2
                        ? '2 - Dưới kỳ vọng'
                        : q.score === 3
                          ? '3 - Đạt yêu cầu'
                          : q.score === 4
                            ? '4 - Tốt'
                            : '5 - Xuất sắc'}
                  </span>
                )}
              </div>

              {/* Notes Input */}
              <textarea
                rows={2}
                className="scorecard-notes-input"
                placeholder="Ghi chú chi tiết câu trả lời của ứng viên tại câu này..."
                value={q.notes || ''}
                onChange={(e) => handleQuestionNotesChange(secIdx, qIdx, e.target.value)}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Decision Section */}
      <div className="scorecard-decision-section">
        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#355a36' }}>
          Đánh giá & Quyết định tuyển dụng
        </h4>

        <div>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: 8 }}>
            Đề xuất tuyển dụng (Recommendation):
          </label>
          <div className="recommendations-grid">
            {(['STRONG_HIRE', 'HIRE', 'CONSIDER', 'NO_HIRE'] as RecommendationType[]).map((rec) => (
              <button
                key={rec}
                type="button"
                className={`recommendation-btn ${rec} ${
                  data.recommendation === rec ? 'selected' : ''
                }`}
                onClick={() => handleRecommendationChange(rec)}
              >
                {rec === 'STRONG_HIRE' ? (
                  <ThumbsUp size={16} />
                ) : rec === 'HIRE' ? (
                  <Check size={16} />
                ) : rec === 'CONSIDER' ? (
                  <HelpCircle size={16} />
                ) : (
                  <ThumbsDown size={16} />
                )}
                {RECOMMENDATION_LABELS[rec]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, marginBottom: 8 }}>
            Tổng kết nhận xét buổi phỏng vấn:
          </label>
          <textarea
            rows={4}
            className="scorecard-notes-input"
            placeholder="Nhận xét tổng quan về tác phong, thái độ, tư duy và định hướng của ứng viên..."
            value={data.overallNotes || ''}
            onChange={(e) => handleOverallNotesChange(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="scorecard-action-bar">
          <button
            type="button"
            className="hr-button secondary"
            onClick={() => void handleSave('DRAFT')}
            disabled={saving}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Lưu bản nháp
          </button>
          <button
            type="button"
            className="hr-button"
            onClick={() => void handleSave('COMPLETED')}
            disabled={saving}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Hoàn tất phiếu phỏng vấn
          </button>
        </div>
      </div>
    </div>
  )
}

