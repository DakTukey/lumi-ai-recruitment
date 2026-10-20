/* ============================================================
 *  GitHub Verification Service — Lumi Studio
 *  Kết nối API: GET và POST /recruiter/applications/{id}/github-verification
 * ============================================================ */

import { get, post } from './api'

export type VerifiedSkill = {
  skill: string
  evidence: string
}

export type UnverifiedSkill = {
  skill: string
  note: string
}

export type MatchedProject = {
  cvProject: string
  githubRepo: string
  confidence: string // 'cao' | 'trung bình' | 'thấp'
}

export type GithubVerification = {
  applicationId: string
  githubUsername: string
  verifiedSkills: VerifiedSkill[]
  unverifiedSkills: UnverifiedSkill[]
  matchedProjects: MatchedProject[]
  codeQualityScore: number // 1 - 10
  technicalSummary: string
  interviewSuggestions: string[]
  vibeCodingFlags: string[]
  hasTests: boolean
  hasDocker: boolean
  hasCi: boolean
  topLanguages: Record<string, number>
  modelName: string
  fetchedAt: string
}

/**
 * Lấy kết quả đối chiếu GitHub mới nhất. Trả về null nếu chưa thực hiện.
 */
export async function getGithubVerification(
  applicationId: string,
): Promise<GithubVerification | null> {
  const response = await get<GithubVerification | null>(
    `/recruiter/applications/${applicationId}/github-verification`,
  )
  return response.data ?? null
}

/**
 * Trigger phân tích và đối chiếu GitHub. Nếu đã có kết quả trong 24h và force=false → trả về bản lưu.
 */
export async function triggerGithubVerification(
  applicationId: string,
  force = false,
): Promise<GithubVerification> {
  const response = await post<GithubVerification>(
    `/recruiter/applications/${applicationId}/github-verification`,
    { force },
    { timeoutMs: 60000 },
  )
  return response.data
}

