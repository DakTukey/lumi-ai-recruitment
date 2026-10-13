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

