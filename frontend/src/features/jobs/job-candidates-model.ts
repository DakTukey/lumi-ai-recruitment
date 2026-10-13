import type { SampleApplication } from './recruiter-model'

export function jobApplicationSummary(applications: SampleApplication[], jobId: string) {
  const scoped = applications.filter((item) => item.jobId === jobId)
  const assessed = scoped.filter((item) => item.assessment?.status === 'COMPLETED')
  const ranked = assessed
    .filter((item) => ['SUBMITTED', 'REVIEWING', 'INTERVIEW'].includes(item.stage))
    .sort((a, b) => {
      const score = (item: SampleApplication) =>
        item.assessment?.status === 'COMPLETED' ? item.assessment.score : 0
      return score(b) - score(a) || a.id.localeCompare(b.id)
    })
  return { scoped, assessed, ranked }
}
