import type { InterviewScorecard } from '../../services/interview-scorecard.service'
import type { ApplicationStatus } from '../../types/domain'

export function canWorkOnInterviewScorecard(stage: ApplicationStatus) {
  return stage === 'INTERVIEW'
}

export function scorecardStageMessage(stage: ApplicationStatus) {
  if (stage === 'SUBMITTED' || stage === 'REVIEWING')
    return 'HR cần duyệt sơ tuyển và chuyển hồ sơ sang vòng Phỏng vấn trước khi tạo hoặc chấm phiếu. Điểm AI không tự chuyển vòng.'
  if (stage === 'REJECTED' || stage === 'WITHDRAWN')
    return 'Hồ sơ đã kết thúc quy trình tuyển dụng. Phiếu đã lưu được giữ để xem lại; không tạo mới hoặc chỉnh sửa.'
  if (stage === 'OFFER' || stage === 'HIRED')
    return 'Hồ sơ đã chuyển khỏi vòng Phỏng vấn. Phiếu đã lưu được giữ để xem lại; không tạo mới hoặc chỉnh sửa.'
  return 'Phiếu dành cho HR ghi nhận và đánh giá trong buổi phỏng vấn.'
}

export function canRegenerateScorecard(card: InterviewScorecard) {
  return (
    card.status !== 'COMPLETED' &&
    card.overallScore == null &&
    !card.recommendation &&
    !card.overallNotes?.trim() &&
    card.sections.every((section) =>
      section.questions.every((question) => question.score == null && !question.notes?.trim()),
    )
  )
}
export function canCompleteScorecard(card: InterviewScorecard) {
  const questions = card.sections.flatMap((section) => section.questions)
  return (
    card.status !== 'COMPLETED' &&
    !!card.recommendation &&
    questions.length > 0 &&
    questions.every(
      (question) => question.score != null && question.score >= 1 && question.score <= 5,
    )
  )
}
