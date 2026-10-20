import { get } from './api'
export type BenchmarkCriterion = {
  id: string
  name: string
  required: boolean
  weight: number
  ownScore: number | null
  ownStatus: string
  peerMedian: number | null
  peerEvidenceCount: number
  peerCount: number
  evidencePercent: number
  difference: number | null
  priority: number
  action: 'CLARIFY' | 'STRENGTHEN' | 'MAINTAIN' | 'INSUFFICIENT_EVIDENCE'
}
export type CandidateBenchmark = {
  status: 'READY' | 'INSUFFICIENT_DATA' | 'NEEDS_MATCH' | 'UNWEIGHTED'
  minimumPeers: number
  totalPeers: number
  analyzedPeers: number
  pendingPeers: number
  ownScore: number | null
  medianScore: number | null
  percentile: number | null
  lowerPercent: number | null
  equalPercent: number | null
  higherPercent: number | null
  criteria: BenchmarkCriterion[]
  asOf: string
}
export const getCandidateBenchmark = async (jobId: string, documentId: string) =>
  (
    await get<CandidateBenchmark>(
      `/candidate/jobs/${encodeURIComponent(jobId)}/benchmark/pdf?documentId=${encodeURIComponent(documentId)}`,
    )
  ).data
export type ApplicationAiStatus = {
  state: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'NOT_REQUESTED'
  attempts: number
  maxAttempts: number
  nextAttemptAt: string | null
  score: number | null
  summary: string | null
  evaluatedAt: string | null
}
export const getApplicationAiStatus = async (id: string, staff = false) =>
  (
    await get<ApplicationAiStatus>(
      `/${staff ? 'recruiter' : 'candidate'}/applications/${encodeURIComponent(id)}/ai-status`,
    )
  ).data
