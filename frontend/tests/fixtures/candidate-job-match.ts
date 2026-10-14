import type { CandidateJobMatch, JobMatchCriterion } from '../../src/features/jobs/candidate-job-match-model'
export const sampleMatchResumes = [
  { id: 'sample-experienced', title: 'CV mẫu · Có kinh nghiệm', version: 2 },
  { id: 'sample-graduate', title: 'CV mẫu · Mới tốt nghiệp', version: 1 },
]

// Used exclusively by explicitly marked sample jobs. No actual CV enters this function.
export function sampleJobMatch(
  job: { id: string | number; tags: string[] },
  resumeId: string,
): CandidateJobMatch {
  const profile =
    sampleMatchResumes.find((resume) => resume.id === resumeId) ?? sampleMatchResumes[0]
  const junior = profile.id === 'sample-graduate'
  const scores = junior ? [68, 60, 30, 38, 62] : [92, 78, 65, 82, 70]
  const skills = [...new Set(job.tags)].slice(0, 3)
  const criteria: JobMatchCriterion[] = skills.map((name, index) => ({
    id: `skill-${index}`,
    name,
    required: index < 2,
    weight: index < 2 ? 3 : 2,
    score: scores[index],
    status: scores[index] >= 80 ? 'MATCHED' : 'PARTIAL',
    source: 'CV mẫu · Dự án & kỹ năng',
    evidence: junior
      ? `Sử dụng ${name} trong dự án môn học, phụ trách một phần chức năng của sản phẩm.`
      : `Ứng dụng ${name} trong dự án sản phẩm, tham gia phát triển và cải thiện chức năng.`,
    reason:
      scores[index] >= 80
        ? 'CV mẫu nêu kỹ năng cùng tình huống sử dụng trong dự án.'
        : 'Có nhắc đến kỹ năng nhưng phạm vi công việc và kết quả cần được mô tả rõ hơn.',
    suggestion: `Bổ sung vai trò, cách sử dụng ${name} và kết quả thực tế nếu bạn đã có trải nghiệm đó.`,
  }))
  criteria.push(
    {
      id: 'experience',
      name: 'Kinh nghiệm liên quan',
      required: true,
      weight: 2,
      score: scores[3],
      status: junior ? 'PARTIAL' : 'MATCHED',
      source: 'CV mẫu · Kinh nghiệm',
      evidence: junior
        ? 'Thực tập 3 tháng, tham gia phát triển tính năng theo hướng dẫn.'
        : 'Có 2 năm tham gia phát triển sản phẩm cùng đội ngũ chuyên môn.',
      reason: junior
        ? 'Kinh nghiệm trong CV mẫu còn tập trung ở giai đoạn thực tập.'
        : 'CV mẫu có kinh nghiệm liên quan, cần đối chiếu phạm vi trách nhiệm khi phỏng vấn.',
      suggestion: 'Nêu thời gian, trách nhiệm và kết quả của công việc liên quan.',
    },
    {
      id: 'projects',
      name: 'Bằng chứng dự án',
      required: false,
      weight: 1,
      score: scores[4],
      status: 'PARTIAL',
      source: 'CV mẫu · Dự án',
      evidence: 'Tham gia xây dựng sản phẩm theo nhóm, có mô tả công nghệ sử dụng.',
      reason: 'CV mẫu có dự án nhưng chưa nêu rõ đóng góp cá nhân hoặc kết quả đo lường.',
      suggestion: 'Bổ sung liên kết project, phần bạn phụ trách và kết quả có thể kiểm chứng.',
    },
    {
      id: 'collaboration',
      name: 'Phối hợp nhóm',
      required: true,
      weight: 1,
      score: null,
      status: 'NO_EVIDENCE',
      source: 'CV mẫu · Chưa có trích dẫn',
      evidence: null,
      reason:
        'Chưa thấy mô tả cụ thể về phối hợp, phản hồi hoặc giải quyết vấn đề cùng đội ngũ trong CV mẫu.',
      suggestion: 'Nếu đã có trải nghiệm, thêm một ví dụ phối hợp nhóm và đóng góp của bạn.',
    },
  )
  return {
    source: 'sample',
    jobId: String(job.id),
    resumeId: profile.id,
    resumeTitle: profile.title,
    resumeVersion: profile.version,
    criteria,
  }
}

