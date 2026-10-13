/* ============================================================
 *  Assessment Service — Lumi Studio
 *  Kết nối API thật: GET và POST /recruiter/applications/{id}/assessment
 * ============================================================ */

import { get, post } from './api'

export type MatchLevel = 'MATCHED' | 'PARTIAL' | 'NO_EVIDENCE'

export type AssessmentCriterion = {
  skill: string
  matchLevel: MatchLevel
  evidence: string
  reason: string
  points: number
  weight: number
}

export type AssessmentGap = {
  skill: string
  currentLevel: string
  targetLevel: string
  roadmap: string
}

export type InterviewQuestion = {
  question: string
  reason: string
  targetSkill: string
}

export type AiAssessment = {
  id: string
  applicationId: string
  modelName: string
  promptVersion: string
  score: number
  summary: string
  matchedSkills: string[]
  missingSkills: string[]
  criteria: AssessmentCriterion[]
  gaps: AssessmentGap[]
  interviewQuestions: InterviewQuestion[]
  createdAt: string
}

/**
 * Lấy assessment mới nhất. Trả về null nếu chưa có.
 */
export async function getAssessment(applicationId: string): Promise<AiAssessment | null> {
  const response = await get<AiAssessment | null>(
    `/recruiter/applications/${applicationId}/assessment`,
  )
  return response.data ?? null
}

/**
 * Trigger phân tích AI. Nếu đã có kết quả trong 24h → trả về cái cũ.
 * Gọi khi HR bấm nút "Phân tích AI".
 */
export async function triggerAssessment(
  applicationId: string,
  force = false,
): Promise<AiAssessment> {
  const response = await post<AiAssessment>(
    `/recruiter/applications/${applicationId}/assessment`,
    { force },
    { timeoutMs: 40000 },
  )
  return response.data
}

/** Label tiếng Việt cho match level */
export const matchLevelLabel: Record<MatchLevel, string> = {
  MATCHED: 'Khớp',
  PARTIAL: 'Một phần',
  NO_EVIDENCE: 'Chưa có bằng chứng',
}

/** CSS class suffix cho match level */
export const matchLevelClass: Record<MatchLevel, string> = {
  MATCHED: 'matched',
  PARTIAL: 'partial',
  NO_EVIDENCE: 'no-evidence',
}

// ─── Top Candidates ───────────────────────────────────────────────────────────

export type TopCandidate = {
  applicationId: string
  candidateName: string
  candidateEmail: string
  resumeTitle: string | null
  score: number
  summary: string
  matchedSkills: string[]
  missingSkills: string[]
  applicationStatus: string
  assessedAt: string
}

/**
 * Lấy Top N ứng viên điểm AI cao nhất cho một job.
 * Chỉ trả về ứng viên đã được phân tích AI và chưa bị loại/rút.
 */
export async function getTopCandidates(jobId: string, limit = 5): Promise<TopCandidate[]> {
  try {
    const response = await get<TopCandidate[]>(
      `/recruiter/applications/top?jobId=${encodeURIComponent(jobId)}&limit=${limit}`,
    )
    return response.data ?? []
  } catch {
    return []
  }
}
