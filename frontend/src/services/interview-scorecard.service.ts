/* ============================================================
 *  Interview Scorecard Service — Lumi Studio
 *  Quản lý Phiếu phỏng vấn chuẩn hóa kết hợp AI
 * ============================================================ */

import { get, post, put } from './api'

export type ScorecardQuestion = {
  id: string
  question: string
  target_skill: string
  context: string
  rubric_good: string
  rubric_poor: string
  score: number | null // 1 - 5
  notes: string
}

export type ScorecardSection = {
  title: string
  questions: ScorecardQuestion[]
}

export type RecommendationType = 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'NO_HIRE'

export type InterviewScorecard = {
  applicationId: string
  interviewerId: string | null
  interviewerName: string | null
  status: 'DRAFT' | 'COMPLETED'
  overallScore: number | null
  recommendation: RecommendationType | null
  overallNotes: string | null
  sections: ScorecardSection[]
  createdAt: string
  updatedAt: string
}

export type ScorecardSavePayload = {
  status: 'DRAFT' | 'COMPLETED'
  recommendation: RecommendationType | null
  overallNotes: string | null
  sections: ScorecardSection[]
}

export const RECOMMENDATION_LABELS: Record<RecommendationType, string> = {
  STRONG_HIRE: 'Tuyển dụng ngay (Strong Hire)',
  HIRE: 'Đạt yêu cầu (Hire)',
  CONSIDER: 'Cân nhắc thêm (Consider)',
  NO_HIRE: 'Không đạt (No Hire)',
}

export async function getInterviewScorecard(
  applicationId: string,
): Promise<InterviewScorecard | null> {
  const response = await get<InterviewScorecard | null>(
    `/recruiter/applications/${applicationId}/scorecard`,
  )
  return response.data ?? null
}

export async function generateInterviewScorecard(
  applicationId: string,
  force = false,
): Promise<InterviewScorecard> {
  const response = await post<InterviewScorecard>(
    `/recruiter/applications/${applicationId}/scorecard/generate`,
    { force },
    { timeoutMs: 60000 },
  )
  return response.data
}

export async function saveInterviewScorecard(
  applicationId: string,
  data: ScorecardSavePayload,
): Promise<InterviewScorecard> {
  const response = await put<InterviewScorecard>(
    `/recruiter/applications/${applicationId}/scorecard`,
    data,
  )
  return response.data
}

