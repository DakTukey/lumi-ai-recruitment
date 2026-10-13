import { get } from './api'
import type { PaginatedResponse } from '../types/api'
import type { Job } from '../types/domain'
export type Department = { id: string; name: string; description: string | null }
type JobDto = {
  id: string
  departmentId: string
  departmentName: string
  title: string
  positionName?: string | null
  headcount: number
  applicationCount: number
  description: string
  requirements: string
  benefits: string
  skills: string[]
  location: string
  employmentType: string
  workMode: string
  experienceLevel: string
  salaryMin: number | null
  salaryMax: number | null
  currency: string
  featured: boolean
  publishedAt: string
  applicationDeadline: string | null
}
export const workModes: Record<string, string> = {
  'Tại văn phòng': 'ONSITE',
  Hybrid: 'HYBRID',
  Remote: 'REMOTE',
}
const levels: Record<string, string> = {
  INTERN: 'Intern',
  JUNIOR: 'Junior',
  MIDDLE: 'Middle',
  SENIOR: 'Senior',
}
const mapJob = (j: JobDto): Job => {
  const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n / 1000000)
  const salary =
    j.salaryMin != null && j.salaryMax != null
      ? `${money(j.salaryMin)} – ${money(j.salaryMax)} triệu`
      : j.salaryMin != null
        ? `Từ ${money(j.salaryMin)} triệu`
        : j.salaryMax != null
          ? `Đến ${money(j.salaryMax)} triệu`
          : 'Thỏa thuận'
  return {
    id: j.id,
    source: 'database',
    title: j.title,
    positionName: j.positionName,
    headcount: j.headcount,
    applicationCount: j.applicationCount,
    company: 'Lumi Studio',
    mark: 'lumi',
    color: 'violet',
    location: j.location,
    salary,
    minSalary: (j.salaryMin ?? 0) / 1000000,
    category: j.departmentName,
    level: levels[j.experienceLevel] ?? j.experienceLevel,
    mode: Object.keys(workModes).find((key) => workModes[key] === j.workMode) ?? j.workMode,
    tags: j.skills,
    skills: j.skills,
    description: j.description,
    requirements: j.requirements,
    benefits: j.benefits,
    featured: j.featured,
    posted: new Date(j.publishedAt).toLocaleDateString('vi-VN'),
    ageHours: Math.max(0, (Date.now() - Date.parse(j.publishedAt)) / 3600000),
    deadline: j.applicationDeadline,
    employmentType: j.employmentType,
  }
}
export async function getJobs(params: URLSearchParams): Promise<PaginatedResponse<Job>> {
  const response = await get<PaginatedResponse<JobDto>>(`/jobs?${params.toString()}`)
  return { ...response.data, content: response.data.content.map(mapJob) }
}
export const getJobById = async (id: string) =>
  mapJob((await get<JobDto>(`/jobs/${encodeURIComponent(id)}`)).data)
export const getDepartments = async () => (await get<Department[]>('/departments')).data
