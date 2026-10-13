import { CircleHelp, Sparkles } from 'lucide-react'
import { AssessmentCharts } from '../../applications/components/AssessmentCharts'
import { assessmentLabels } from '../recruiter-model'
import type { ApplicationAssessment as Assessment } from '../recruiter-model'

export function AssessmentBadge({ assessment }: { assessment?: Assessment }) {
  const status = assessment?.status ?? 'NOT_ANALYZED'
  return (
    <span className={`hr-assessment-badge hr-assessment-${status.toLowerCase()}`}>
      {assessment?.status === 'COMPLETED'
        ? `${assessment.score}/100 · Mẫu`
        : `${assessmentLabels[status]}${assessment?.sample ? ' · Mẫu' : ''}`}
    </span>
  )
}

export function ApplicationAssessment({ assessment }: { assessment?: Assessment }) {
  if (!assessment || assessment.status !== 'COMPLETED') {
    return (
      <section className="hr-assessment-empty">
        <Sparkles size={26} />
        <h3>{assessmentLabels[assessment?.status ?? 'NOT_ANALYZED']}</h3>
        <p>
          {assessment?.status === 'PENDING'
            ? 'Đây là trạng thái đang phân tích minh họa. Không có tác vụ AI đang chạy và kết quả sẽ không tự cập nhật.'
            : assessment?.status === 'FAILED'
              ? 'Trạng thái lỗi minh họa. Chưa có kết quả để đánh giá hồ sơ.'
              : 'Chưa có kết quả đánh giá cho hồ sơ này. Không quy đổi thành điểm 0.'}
        </p>
        <p>Chưa kết nối AI. HR có thể tiếp tục xem CV, ghi chú và đánh giá hồ sơ.</p>
      </section>
    )
  }
  return (
    <article className="hr-assessment">
      <div className="hr-preview-label">
        <Sparkles size={17} /> Phân tích mẫu · Nội dung minh họa cố định
      </div>
      <section className="hr-assessment-summary">
        <div className="hr-assessment-score">
          <strong>
            {assessment.score}
            <small>/100</small>
          </strong>
          <span>Điểm phù hợp mẫu</span>
        </div>
        <div>
          <h3>Tổng hợp CV và yêu cầu công việc</h3>
          <p>{assessment.summary}</p>
        </div>
      </section>
      <p className="hr-assessment-note">
        Nguồn: CV mẫu đã nộp. Chưa kiểm chứng bằng GitHub, bài test hoặc phỏng vấn. Điểm phù hợp
        không phải mức độ thành thạo hay độ tin cậy của kỹ năng.
      </p>
      <AssessmentCharts
        sample
        criteria={assessment.criteria.map((criterion) => ({
          skill: criterion.skill,
          status: criterion.result,
          points: criterion.points,
          weight: criterion.weight,
          source: criterion.source,
          evidence: criterion.evidence,
          reason: criterion.explanation,
        }))}
      />
      <section className="hr-assessment-method">
        <h3>Cách tính điểm minh họa</h3>
        <p>
          {assessment.criteria.map((item) => item.points).join(' + ')} = {assessment.score}/100.
          Trọng số cố định cho ví dụ này; chưa sử dụng cấu hình chấm điểm thật của tin tuyển dụng.
        </p>
      </section>
      <section className="hr-assessment-questions">
        <h3>
          <CircleHelp size={17} /> Câu hỏi cần kiểm chứng
        </h3>
        <ol>
          {assessment.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      </section>
      <p className="hr-assessment-note">
        AI hỗ trợ đối chiếu. HR quyết định chuyển vòng hoặc loại hồ sơ; không có thao tác tự động từ
        kết quả mẫu.
      </p>
    </article>
  )
}
