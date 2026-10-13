import { useEffect, useRef, useState } from 'react'
import { CircleHelp, Sparkles } from 'lucide-react'
import { getAssessment, triggerAssessment } from '../../../services/assessment.service'
import type { AiAssessment } from '../../../services/assessment.service'
import { AssessmentCharts } from './AssessmentCharts'
import type { SubmittedApplication } from '../../../services/application.service'
import { submittedDate } from '../../../services/application.service'

export function AiAssessmentTab({
  applicationId,
  jobSnapshot,
  onChanged,
}: {
  applicationId: string
  jobSnapshot: SubmittedApplication['jobSnapshot']
  onChanged?: () => void
}) {
  const [assessment, setAssessment] = useState<AiAssessment | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const posting = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => {
    let active = true
    getAssessment(applicationId)
      .then((data) => {
        if (active) setAssessment(data)
      })
      .catch((e) => {
        if (active) setLoadError(e instanceof Error ? e.message : 'Không tải được kết quả AI.')
      })
    return () => {
      active = false
    }
  }, [applicationId, retry])
  async function analyze(force: boolean) {
    if (posting.current) return
    posting.current = true
    setLoading(true)
    setError('')
    try {
      const data = await triggerAssessment(applicationId, force)
      if (mounted.current) {
        setAssessment(data)
        onChanged?.()
      }
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : 'Không phân tích được. Hãy thử lại.')
    } finally {
      posting.current = false
      if (mounted.current) setLoading(false)
    }
  }
  if (loadError)
    return (
      <div className="hr-empty" role="alert">
        <p>{loadError}</p>
        <button
          className="hr-button secondary"
          onClick={() => {
            setLoadError('')
            setAssessment(undefined)
            setRetry((n) => n + 1)
          }}
        >
          Tải lại kết quả
        </button>
      </div>
    )
  if (assessment === undefined) return <p role="status">Đang kiểm tra kết quả AI…</p>
  return (
    <section className="hr-assessment">
      {error && (
        <div className="hr-form-error" role="alert">
          <p>{error}</p>
        </div>
      )}
      {!assessment ? (
        <div className="hr-empty">
          <Sparkles size={28} />
          <h3>Chưa có kết quả AI</h3>
          <p>Đối chiếu CV và JD lúc nộp, giải thích mức phù hợp và đề xuất câu hỏi kiểm chứng.</p>
          <button className="hr-button" onClick={() => void analyze(false)} disabled={loading}>
            <Sparkles size={16} />
            {loading ? 'Đang phân tích…' : 'Phân tích ngay'}
          </button>
        </div>
      ) : (
        <>
          <div className="hr-assessment-summary">
            <div className="hr-assessment-score">
              <strong>
                {assessment.score}
                <small>/100</small>
              </strong>
              <span>Điểm phù hợp tổng</span>
            </div>
            <div>
              <p>{assessment.summary}</p>
              <p className="submitted-caption">
                {assessment.modelName} · {submittedDate(assessment.createdAt)}
              </p>
              <button
                className="hr-button secondary"
                onClick={() => void analyze(true)}
                disabled={loading}
              >
                {loading ? 'Đang phân tích…' : 'Phân tích lại'}
              </button>
            </div>
          </div>
          <AssessmentCharts
            key={assessment.id}
            criteria={assessment.criteria.map((criterion) => {
              const matches = [
                ...jobSnapshot.skills.map((skill) => ({
                  name: skill.name,
                  required: skill.required,
                })),
                ...jobSnapshot.criteria.map((item) => ({
                  name: item.description,
                  required: item.required,
                })),
              ].filter(
                (item) =>
                  item.name.trim().toLocaleLowerCase('vi') ===
                  criterion.skill.trim().toLocaleLowerCase('vi'),
              )
              return {
                skill: criterion.skill,
                status: criterion.matchLevel,
                points: criterion.points,
                weight: criterion.weight,
                source: 'CV đã nộp · Bản lưu tại thời điểm ứng tuyển',
                evidence: criterion.evidence,
                reason: criterion.reason,
                required: matches.length === 1 ? matches[0].required : undefined,
              }
            })}
          />
          <section className="hr-assessment-method">
            <h3>Cách đọc điểm</h3>
            <p>
              Mỗi tiêu chí có mức phù hợp 0–100%. Điểm tổng là trung bình có trọng số. Kỹ năng bắt
              buộc có trọng số 2, ưu tiên là 1; tiêu chí khác dùng trọng số HR đã đặt trong JD.
              Trọng số 0 không cộng điểm.
            </p>
            <p>
              Đây là đối chiếu thông tin khai báo trong CV, chưa phải xác minh năng lực. Chưa có
              bằng chứng không đồng nghĩa ứng viên không có kỹ năng.
            </p>
          </section>
          {!!assessment.matchedSkills.length && (
            <section>
              <h3>Kỹ năng khớp</h3>
              <div className="hr-skill-tags">
                {assessment.matchedSkills.map((s) => (
                  <span key={s} className="skill-matched">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}
          {!!assessment.missingSkills.length && (
            <section>
              <h3>Kỹ năng cần làm rõ hoặc bổ sung</h3>
              <div className="hr-skill-tags">
                {assessment.missingSkills.map((s) => (
                  <span key={s} className="skill-missing">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}
          {!!assessment.gaps.length && (
            <section>
              <h3>Khoảng cách kỹ năng và gợi ý cải thiện</h3>
              <ul className="hr-gap-list">
                {assessment.gaps.map((g, i) => (
                  <li key={i}>
                    <strong>{g.skill}</strong>
                    <p className="submitted-caption">
                      {g.currentLevel} → {g.targetLevel}
                    </p>
                    <p>{g.roadmap}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!!assessment.interviewQuestions.length && (
            <section className="hr-assessment-questions">
              <h3>
                <CircleHelp size={17} />
                Câu hỏi phỏng vấn gợi ý
              </h3>
              <ol>
                {assessment.interviewQuestions.map((q, i) => (
                  <li key={i}>
                    <strong>{q.question}</strong>
                    <p>{q.reason}</p>
                    <small>Kỹ năng: {q.targetSkill}</small>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      <p className="hr-assessment-note">
        AI hỗ trợ đối chiếu. HR quyết định chuyển vòng; hệ thống không tự loại hồ sơ.
      </p>
    </section>
  )
}
