import type { Resume } from '../types/domain'
import { get, post, put, del } from './api'

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
export const createResume = async (input: ResumeInput) =>
  withOptionalSections((await post<Resume>(path, input)).data)
export const saveResume = async (id: string, input: ResumeInput) =>
  withOptionalSections((await put<Resume>(`${path}/${id}`, input)).data)
export const setDefaultResume = async (id: string, version: number) =>
  withOptionalSections((await put<Resume>(`${path}/${id}/default`, { version })).data)
export const deleteResume = async (id: string, version: number) => {
  await del(`${path}/${id}?version=${version}`)
}

export const getResumePositionOptions = async () =>
  (await get<string[]>(`${path}/position-options`)).data

export const getResumeSkillOptions = async () =>
  (await get<string[]>(`${path}/skill-options`)).data

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
  status: 'UPLOADED' | 'PROCESSING' | 'PARSED' | 'FAILED'
  parsed: ParsedResume | null
  attempts: number
  createdAt: string
}
export const getCvDocuments = async () => (await get<CvDocument[]>('/candidate/cv-documents')).data
export const getCvDocument = async (id: string) => (await get<CvDocument>(`/candidate/cv-documents/${encodeURIComponent(id)}`)).data
export const uploadCvDocument = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return (await import('./api').then(api => api.upload<CvDocument>('/candidate/cv-documents', form))).data
}
export const parseCvDocument = async (id: string) => (await post<CvDocument>(`/candidate/cv-documents/${encodeURIComponent(id)}/parse`, {}, { timeoutMs: 65000 })).data
export const cvDocumentUrl = (id: string) => `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/candidate/cv-documents/${encodeURIComponent(id)}/file`
export const submittedPdfUrl = (id: string) => `${import.meta.env.VITE_API_BASE_URL ?? '/api'}/recruiter/applications/${encodeURIComponent(id)}/cv-file`
