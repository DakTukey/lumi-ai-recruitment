import { get, post } from './api'

export type SummaryCategory = 'responsibilities' | 'required' | 'preferred' | 'notes'
export type JobSummary = {
  jobId: string
  sourceHash: string
  promptVersion: string
  modelName: string
  generatedAt: string
  items: { category: SummaryCategory; text: string; source_id: string; quote: string }[]
  sources: { id: string; label: string; text: string; categories: SummaryCategory[] }[]
}

export async function getJobSummary(jobId: string) {
  return (await get<JobSummary | null>(`/jobs/${encodeURIComponent(jobId)}/ai-summary`)).data
}
export async function generateJobSummary(jobId: string) {
  return (
    await post<JobSummary>(`/jobs/${encodeURIComponent(jobId)}/ai-summary`, undefined, {
      timeoutMs: 45000,
    })
  ).data
}
