import type { Resume } from '../types/domain'
import { get, post, put } from './api'

export type ResumeInput = Omit<
  Resume,
  'id' | 'candidateId' | 'isDefault' | 'createdAt' | 'updatedAt' | 'version'
> & { version: number | null }
const path = '/candidate/resumes'
const withOptionalSections = (resume: Resume): Resume => ({
  ...resume,
  languages: resume.languages ?? [],
  awards: resume.awards ?? [],
  activities: resume.activities ?? [],
})
export const getMyResumes = async () => (await get<Resume[]>(path)).data.map(withOptionalSections)
export const getResume = async (id: string) =>
  withOptionalSections((await get<Resume>(`${path}/${id}`)).data)
export const getResumePositionOptions = async () =>
  (await get<string[]>(`${path}/position-options`)).data

export const getResumeSkillOptions = async () => (await get<string[]>(`${path}/skill-options`)).data

export type UniversityOption = {
  name: string
  code?: string
  englishName?: string
}

export const getResumeUniversityOptions = async () =>
  (await get<UniversityOption[]>(`${path}/university-options`)).data

export type ParsedResume = {
  title?: string
  fullName?: string
  email?: string
  phone?: string
  location?: string
  desiredPosition?: string
  summary?: string
  githubUrl?: string
  linkedinUrl?: string
  portfolioUrl?: string
  skills?: string[]
  experiences?: Resume['experiences']
  educations?: Resume['educations']
  projects?: Resume['projects']
  certifications?: Resume['certifications']
  languages?: Resume['languages']
  awards?: Resume['awards']
  activities?: Resume['activities']
  extraSections?: { title: string; content: string }[]
  warnings?: string[]
  extractedText?: string
  pageCount?: number
  sources?: { path: string; quote: string; page: number; verified: boolean }[]
}

export const parseResumePdf = async (file: File): Promise<ParsedResume> => {
  const formData = new FormData()
  formData.append('file', file)
  const res = await import('./api').then((api) =>
    api.upload<ParsedResume>('/candidate/cv-parser', formData),
  )
  return res.data
}

export type CvDocument = {
  id: string
  filename: string
  title: string
  isDefault: boolean
  status: 'UPLOADED' | 'PROCESSING' | 'PARSED' | 'FAILED'
  parsed: ParsedResume | null
  attempts: number
  createdAt: string
  reviewed: ParsedResume | null
  reviewVersion: number
  confirmedAt: string | null
  issues: { path: string; severity: 'ERROR' | 'WARNING'; message: string }[]
}
export const getCvDocuments = async () => (await get<CvDocument[]>('/candidate/cv-documents')).data
export const getCvDocument = async (id: string) =>
  (await get<CvDocument>(`/candidate/cv-documents/${encodeURIComponent(id)}`)).data
export const renameCvDocument = async (id: string, title: string) =>
  (await put<CvDocument>(`/candidate/cv-documents/${encodeURIComponent(id)}/name`, { title })).data
export const setDefaultCvDocument = async (id: string) =>
  (await put<CvDocument>(`/candidate/cv-documents/${encodeURIComponent(id)}/default`, {})).data
export const uploadCvDocument = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return (
    await import('./api').then((api) => api.upload<CvDocument>('/candidate/cv-documents', form))
  ).data
}
export const parseCvDocument = async (id: string) =>
  (
    await post<CvDocument>(
      `/candidate/cv-documents/${encodeURIComponent(id)}/parse`,
      {},
      { timeoutMs: 270000 },
    )
  ).data
export const reviewCvDocument = async (
  id: string,
  content: ParsedResume,
  version: number,
  confirm: boolean,
) =>
  (
    await put<CvDocument>(`/candidate/cv-documents/${encodeURIComponent(id)}/review`, {
      content,
      version,
      confirm,
    })
  ).data
export const cvDocumentUrl = (id: string) =>
  `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/candidate/cv-documents/${encodeURIComponent(id)}/file`
export const submittedPdfUrl = (id: string) =>
  `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/recruiter/applications/${encodeURIComponent(id)}/cv-file`
export const getSubmittedPdfExtraction = async (applicationId: string) =>
  (
    await get<{
      status: CvDocument['status']
      parsed: ParsedResume | null
      confirmedAt: string | null
      analysisState: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'NOT_REQUESTED'
    }>(`/recruiter/applications/${encodeURIComponent(applicationId)}/cv-extraction`)
  ).data
