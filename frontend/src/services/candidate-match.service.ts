import { get, post } from './api'
import type { CandidateJobMatch } from '../features/jobs/candidate-job-match-model'

export type CandidateMatchResponse = CandidateJobMatch & {
  gaps?: Array<{
    skill: string
    currentLevel: string
    targetLevel: string
    roadmap: string
  }>
}

export async function getCachedJobMatch(
  jobId: string,
  documentId: string,
): Promise<CandidateJobMatch | null> {
  const res = await get<CandidateJobMatch | null>(
    `/candidate/jobs/${encodeURIComponent(jobId)}/match/pdf?documentId=${encodeURIComponent(documentId)}`,
  )
  return res.data ?? null
}

export async function analyzeJobMatch(
  jobId: string,
  documentId: string,
  documentVersion: number,
  force = false,
): Promise<CandidateJobMatch> {
  const res = await post<CandidateJobMatch>(
    `/candidate/jobs/${encodeURIComponent(jobId)}/match/pdf`,
    { documentId, documentVersion, force },
    { timeoutMs: 285000 },
  )
  return res.data
}
