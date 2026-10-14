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
