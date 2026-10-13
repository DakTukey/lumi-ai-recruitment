export type ChartCriterion = {
  skill: string
  status: 'MATCHED' | 'PARTIAL' | 'NO_EVIDENCE' | 'CLARIFY'
  points: number
  weight: number
  evidence: string
  reason: string
  source: string
  required?: boolean
}

export const evidenceLabels = {
  MATCHED: 'Khớp CV/JD',
  CLARIFY: 'Cần làm rõ',
  NO_EVIDENCE: 'Chưa có bằng chứng',
}
export type EvidenceGroup = keyof typeof evidenceLabels
export const evidenceGroup = (status: ChartCriterion['status']): EvidenceGroup =>
  status === 'PARTIAL' ? 'CLARIFY' : status

export function assessmentChartData(criteria: ChartCriterion[], sample: boolean) {
  const totalWeight = criteria.reduce((sum, item) => sum + item.weight, 0)
  const groups: Record<EvidenceGroup, number> = { MATCHED: 0, CLARIFY: 0, NO_EVIDENCE: 0 }
  const rows = criteria.map((item) => {
    groups[evidenceGroup(item.status)] += 1
    // Real API points are a 0–100 fit value, not an earned score out of the weight.
    // Sample fixtures already store earned points / maximum points.
    const maximum = sample ? item.weight : totalWeight > 0 ? (item.weight / totalWeight) * 100 : 0
    const earned = sample ? item.points : (maximum * item.points) / 100
    const fit = sample ? (item.weight > 0 ? (item.points / item.weight) * 100 : 0) : item.points
    return { ...item, maximum, earned, fit }
  })
  return { rows, groups }
}
