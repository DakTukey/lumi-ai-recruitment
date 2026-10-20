import type { ApplicationStatus, Resume } from '../types/domain'
import { get, post } from './api'

export const applicationStages: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Đã nộp',
  REVIEWING: 'Đang xem xét',
  INTERVIEW: 'Phỏng vấn',
  OFFER: 'Offer',
  HIRED: 'Đã tuyển',
  REJECTED: 'Đã loại',
  WITHDRAWN: 'Đã rút',
}
export type ApplicationItem = {
  id: string
  jobId: string
  jobTitle: string
  name: string
  email: string
  resumeTitle: string
  status: ApplicationStatus
  appliedAt: string
  aiScore: number | null
  aiSummary: string | null
  assessedAt: string | null
}
export type ApplicationPage = {
  content: ApplicationItem[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
export type ApplicationSummary = {
  total: number
  assessed: number
  priority: ApplicationItem[]
  stages: Record<ApplicationStatus, number>
  jobs: { jobId: string; title: string; count: number }[]
}
export type ApplicationReview = {
  notes: { id: string; body: string; authorId: string; authorName: string; at: string }[]
  history: {
    id: string
    fromStatus: ApplicationStatus | null
    toStatus: ApplicationStatus
    actorId: string
    actorName: string
    reason: string | null
    at: string
  }[]
  allowedTransitions: ApplicationStatus[]
}
type ReviewResponse = ApplicationReview & { application: SubmittedApplication }
export type SubmittedApplication = {
  submissionFormat?: 'BUILDER' | 'ORIGINAL_PDF'
  sourceDocumentId?: string | null
  review?: ApplicationReview
  id: string
  jobId: string
  candidateId: string
  resumeId: string | null
  status: ApplicationStatus
  coverLetter: string | null
  jobVersion: number
  version: number
  appliedAt: string
  updatedAt: string
  resumeSnapshot: Resume
  jobSnapshot: {
    id: string
    title: string
    description: string
    requirements: string
    benefits: string
    departmentName: string
    location: string
    headcount: number
    employmentType: string
    workMode: string
    experienceLevel: string
    salaryMin: number | null
    salaryMax: number | null
    currency: string
    applicationDeadline: string | null
    version: number
    skills: { id: string; name: string; required: boolean }[]
    criteria: {
      id: string
      type: string
      description: string
      required: boolean
      weight: number | null
      sortOrder: number
    }[]
  }
  history: {
    id: string
    fromStatus: ApplicationStatus | null
    toStatus: ApplicationStatus
    at: string
  }[]
}
export const applyToJob = async (
  jobId: string,
  resumeId: string | null,
  resumeVersion: number | null,
  coverLetter?: string,
  submissionFormat: 'BUILDER' | 'ORIGINAL_PDF' = 'BUILDER',
  sourceDocumentId?: string,
  documentVersion?: number,
) =>
  (
    await post<SubmittedApplication>('/candidate/applications', {
      jobId,
      resumeId,
      resumeVersion,
      coverLetter,
      submissionFormat,
      sourceDocumentId,
      documentVersion,
    })
  ).data
export const getApplications = async (staff: boolean, params = new URLSearchParams()) =>
  (await get<ApplicationPage>(`/${staff ? 'recruiter' : 'candidate'}/applications?${params}`)).data
const reviewedApplication = ({ application, ...review }: ReviewResponse): SubmittedApplication => ({
  ...application,
  review,
})
export const getApplication = async (staff: boolean, id: string) =>
  staff
    ? reviewedApplication((await get<ReviewResponse>(`/recruiter/applications/${id}/review`)).data)
    : (await get<SubmittedApplication>(`/candidate/applications/${id}`)).data
export const addApplicationNote = async (id: string, body: string, requestId: string) =>
  reviewedApplication(
    (await post<ReviewResponse>(`/recruiter/applications/${id}/notes`, { body, requestId })).data,
  )
export const changeApplicationStatus = async (
  id: string,
  version: number,
  status: ApplicationStatus,
  reason: string,
) =>
  reviewedApplication(
    (
      await post<ReviewResponse>(`/recruiter/applications/${id}/status`, {
        version,
        status,
        reason,
      })
    ).data,
  )
export const getApplicationSummary = async (jobId = '') =>
  (
    await get<ApplicationSummary>(
      `/recruiter/applications/summary${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`,
    )
  ).data

export const submittedDate = (at: string) => new Date(at).toLocaleString('vi-VN')

export type EmailTemplateType = 'INTERVIEW' | 'REJECTION' | 'OFFER' | 'INFO_REQUEST'

export type GenerateEmailRequest = {
  templateType: EmailTemplateType
  interviewTime?: string
  interviewFormat?: string
  interviewLocation?: string
  salaryOffer?: string
  startDate?: string
  rejectionReason?: string
  additionalNotes?: string
  tone?: 'professional' | 'friendly' | 'formal'
}

export type GeneratedEmailResult = {
  subject: string
  body: string
  candidateName: string
  candidateEmail: string
  jobTitle: string
}

export const generateRecruitmentEmail = async (id: string, req: GenerateEmailRequest) =>
  (
    await post<GeneratedEmailResult>(`/recruiter/applications/${id}/ai-email`, req, {
      timeoutMs: 45000,
    })
  ).data
