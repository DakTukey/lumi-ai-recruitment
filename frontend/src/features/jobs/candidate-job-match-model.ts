// Candidate-owned pre-application assessment presentation contract.
// Scores express documented CV/JD fit, never a hiring probability or verified proficiency.
export type JobMatchCriterion = {
  id: string
  name: string
  required: boolean
  weight: number
  score: number | null
  status: 'MATCHED' | 'PARTIAL' | 'NO_EVIDENCE'
  source: string
  evidence: string | null
  reason: string
  suggestion: string
  jobEvidence?: string
}
export const jobMatchStatus = {
  MATCHED: { label: 'Có bằng chứng phù hợp', color: '#49725e' },
  PARTIAL: { label: 'Phù hợp một phần', color: '#ad7a3f' },
  NO_EVIDENCE: { label: 'Chưa có bằng chứng', color: '#87939e' },
}
export type CandidateJobMatch = {
  source: 'sample' | 'assessment'
  jobId: string
  resumeId: string
  resumeTitle: string
  resumeVersion: number
  score?: number | null
  summary?: string
  criteria: JobMatchCriterion[]
  evaluatedAt?: string
  jobVersion?: number
  modelName?: string
  promptVersion?: string
  gaps?: { skill: string; currentLevel: string; targetLevel: string; roadmap: string }[]
}

export function jobMatchOverview(criteria: JobMatchCriterion[]) {
  const weight = criteria.reduce((sum, row) => sum + Math.max(0, row.weight), 0)
  const score =
    weight > 0
      ? Math.round(
          criteria.reduce((sum, row) => sum + Math.max(0, row.weight) * (row.score ?? 0), 0) /
            weight,
        )
      : null
  return {
    score,
    matched: criteria.filter((row) => row.status === 'MATCHED').length,
    partial: criteria.filter((row) => row.status === 'PARTIAL').length,
    unknown: criteria.filter((row) => row.status === 'NO_EVIDENCE').length,
    requiredUnknown: criteria.filter((row) => row.required && row.status === 'NO_EVIDENCE').length,
  }
}

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

export function isCurrentJobMatch(
  result: CandidateJobMatch,
  jobId: string,
  resume: { id: string; version: number },
) {
  return (
    result.jobId === jobId &&
    result.resumeId === resume.id &&
    result.resumeVersion === resume.version
  )
}
