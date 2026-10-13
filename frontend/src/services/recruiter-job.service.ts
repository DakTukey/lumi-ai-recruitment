import { get, post, put } from './api'
import type { Department } from './job.service'
import type { PaginatedResponse } from '../types/api'
import type { JobStatus } from '../types/domain'
import type { JobDraft, RecruiterJob, CriterionInput } from '../features/jobs/recruiter-model'
import { salaryLabel } from '../features/jobs/recruiter-model'

type RecruiterJobDto = {
  id: string
  departmentId: string
  departmentName: string
  positionId: string | null
  positionName: string | null
  title: string
  headcount: number
  description: string
  requirements: string
  benefits: string
  location: string
  employmentType: string
  workMode: string
  experienceLevel: string
  salaryMin: number | null
  salaryMax: number | null
  status: JobStatus
  applicationDeadline: string | null
  updatedAt: string
  version: number
  skills: { id: string; name: string; required: boolean }[]
  criteria: (CriterionInput & { sortOrder: number })[]
  history: { id: string; actor: string; note: string; at: string }[]
}
export function createJobPayload(draft: JobDraft) {
  return {
    departmentId: draft.departmentId,
    positionId: draft.positionId,
    title: draft.title.trim(),
    headcount: Number(draft.headcount),
    location: draft.location.trim(),
    employmentType: draft.employmentType,
    workMode: { Hybrid: 'HYBRID', Remote: 'REMOTE', 'Tại văn phòng': 'ONSITE' }[draft.mode],
    experienceLevel: draft.level.toUpperCase(),
    salaryMin: ['RANGE', 'FROM'].includes(draft.salaryMode) ? Number(draft.salaryMin) : null,
    salaryMax: ['RANGE', 'UP_TO'].includes(draft.salaryMode) ? Number(draft.salaryMax) : null,
    applicationDeadline: draft.deadline || null,
    description: draft.description.trim(),
    requirements: draft.requirements.trim(),
    benefits: draft.benefits.trim(),
    skills: draft.skills.map(({ name, required }) => ({ name, required })),
    criteria: draft.criteria.map(({ type, description, required, weight }) => ({
      type,
      description,
      required,
      weight,
    })),
  }
}
const mapRecruiterJob = (dto: RecruiterJobDto): RecruiterJob => {
  const deadline = dto.applicationDeadline
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(dto.applicationDeadline))
    : ''
  const draft: JobDraft = {
    departmentId: dto.departmentId,
    positionId: dto.positionId ?? '',
    positionName: dto.positionName ?? '',
    category: dto.departmentName,
    title: dto.title,
    headcount: String(dto.headcount),
    location: dto.location,
    level: dto.experienceLevel.charAt(0) + dto.experienceLevel.slice(1).toLowerCase(),
    mode:
      { HYBRID: 'Hybrid', REMOTE: 'Remote', ONSITE: 'Tại văn phòng' }[dto.workMode] ?? dto.workMode,
    employmentType: dto.employmentType,
    salaryMode:
      dto.salaryMin != null && dto.salaryMax != null
        ? 'RANGE'
        : dto.salaryMin != null
          ? 'FROM'
          : dto.salaryMax != null
            ? 'UP_TO'
            : 'NEGOTIABLE',
    salaryMin: dto.salaryMin == null ? '' : String(dto.salaryMin),
    salaryMax: dto.salaryMax == null ? '' : String(dto.salaryMax),
    deadline,
    description: dto.description,
    requirements: dto.requirements,
    benefits: dto.benefits,
    skills: dto.skills.map(({ name, required }) => ({ name, required })),
    criteria: dto.criteria,
  }
  return {
    id: dto.id,
    source: 'database',
    company: 'Lumi Studio',
    mark: 'lumi',
    color: 'violet',
    title: dto.title,
    headcount: dto.headcount,
    category: dto.departmentName,
    level: draft.level,
    mode: draft.mode,
    location: dto.location,
    employmentType: dto.employmentType,
    deadline: dto.applicationDeadline,
    salary: salaryLabel(draft),
    minSalary: (dto.salaryMin ?? 0) / 1000000,
    tags: dto.skills.map((item) => item.name),
    description: dto.description,
    requirements: dto.requirements,
    benefits: dto.benefits,
    status: dto.status,
    version: dto.version,
    draft,
    updatedAt: dto.updatedAt,
    ageHours: 0,
    posted: '',
    history: dto.history.map((h) => ({ id: h.id, actor: h.actor, text: h.note, at: h.at })),
  }
}
export async function createRecruiterJob(draft: JobDraft) {
  return mapRecruiterJob(
    (await post<RecruiterJobDto>('/recruiter/jobs', createJobPayload(draft))).data,
  )
}
export async function getRecruiterJobs(
  params: URLSearchParams,
): Promise<PaginatedResponse<RecruiterJob>> {
  const result = (await get<PaginatedResponse<RecruiterJobDto>>(`/recruiter/jobs?${params}`)).data
  return { ...result, content: result.content.map(mapRecruiterJob) }
}
export async function getRecruiterJob(id: string) {
  return mapRecruiterJob(
    (await get<RecruiterJobDto>(`/recruiter/jobs/${encodeURIComponent(id)}`)).data,
  )
}
export async function createRecruiterDepartment(name: string) {
  return (await post<Department>('/recruiter/departments', { name })).data
}

export type JobPosition = { id: string; departmentId: string; name: string }
export async function getRecruiterPositions(departmentId: string) {
  return (await get<JobPosition[]>(`/recruiter/positions?${new URLSearchParams({ departmentId })}`))
    .data
}

export async function updateRecruiterJob(job: RecruiterJob, draft: JobDraft) {
  return mapRecruiterJob(
    (
      await put<RecruiterJobDto>(`/recruiter/jobs/${encodeURIComponent(job.id)}`, {
        version: job.version,
        content: createJobPayload(draft),
      })
    ).data,
  )
}
export async function transitionRecruiterJob(
  job: RecruiterJob,
  action: 'publish' | 'close' | 'reopen',
) {
  return mapRecruiterJob(
    (
      await post<RecruiterJobDto>(`/recruiter/jobs/${encodeURIComponent(job.id)}/${action}`, {
        version: job.version,
      })
    ).data,
  )
}
