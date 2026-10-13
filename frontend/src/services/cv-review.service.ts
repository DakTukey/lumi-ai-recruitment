import type { ResumeInput } from './resume.service'
import { post } from './api'

export type CvReviewContext = Pick<
  ResumeInput,
  | 'desiredPosition'
  | 'summary'
  | 'skills'
  | 'experiences'
  | 'educations'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'awards'
  | 'activities'
>
export type CvReviewTarget = { section: 'summary' | 'experience' | 'project'; index: number }
export type CvReviewKind = 'ADD' | 'CLARIFY' | 'REWRITE'
export type CvReviewItem = CvReviewTarget & {
  kind: CvReviewKind
  reason: string
  evidence: string
  job_evidence: string
  question: string
  suggestion: string
}
export type CvReviewResult = {
  overview: string
  items: CvReviewItem[]
  model_name: string
  prompt_version: string
}
export type CvRefinedResult = {
  suggestion: string
  questions: string[]
  model_name: string
  prompt_version: string
}
export const reviewCv = async (resume: CvReviewContext, jobId: string | null) =>
  (await post<CvReviewResult>('/candidate/cv-review', { resume, jobId }, { timeoutMs: 45000 })).data
export const refineCv = async (
  resume: CvReviewContext,
  jobId: string | null,
  target: CvReviewTarget,
  answer: string,
) =>
  (
    await post<CvRefinedResult>(
      '/candidate/cv-review/refine',
      { resume, jobId, target: { section: target.section, index: target.index }, answer },
      { timeoutMs: 45000 },
    )
  ).data
