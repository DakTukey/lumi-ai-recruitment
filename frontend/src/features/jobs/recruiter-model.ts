import type { Job, JobStatus } from '../../types/domain'

export const jobStatusLabels: Record<JobStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang tuyển',
  CLOSED: 'Đã đóng',
}
export const contractLabels: Record<string, string> = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  INTERNSHIP: 'Thực tập',
  CONTRACT: 'Hợp đồng',
}
export const criterionLabels = {
  EXPERIENCE: 'Kinh nghiệm',
  EDUCATION: 'Học vấn',
  LANGUAGE: 'Ngoại ngữ',
  OTHER: 'Khác',
}
export type CriterionType = keyof typeof criterionLabels
export type SalaryMode = 'NEGOTIABLE' | 'RANGE' | 'FROM' | 'UP_TO'
export type SkillInput = { name: string; required: boolean }
export type CriterionInput = {
  id: string
  type: CriterionType
  description: string
  required: boolean
  weight: number
}
export type JobDraft = {
  departmentId?: string
  positionId?: string
  positionName?: string
  title: string
  headcount: string
  category: string
  location: string
  level: string
  mode: string
  employmentType: string
  salaryMode: SalaryMode
  salaryMin: string
  salaryMax: string
  deadline: string
  skills: SkillInput[]
  criteria: CriterionInput[]
  description: string
  requirements: string
  benefits: string
}
export type HistoryItem = { id: string; at: string; actor: string; text: string }
export type RecruiterJob = Job & {
  status: JobStatus
  version?: number
  draft: JobDraft
  updatedAt: string
  history: HistoryItem[]
}
export type ApplicationStage =
  'SUBMITTED' | 'REVIEWING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN'
export const stageLabels: Record<ApplicationStage, string> = {
  SUBMITTED: 'Đã nộp',
  REVIEWING: 'Đang xem xét',
  INTERVIEW: 'Phỏng vấn',
  OFFER: 'Offer',
  HIRED: 'Đã tuyển',
  REJECTED: 'Đã loại',
  WITHDRAWN: 'Đã rút',
}
export const activeStages: ApplicationStage[] = [
  'SUBMITTED',
  'REVIEWING',
  'INTERVIEW',
  'OFFER',
  'HIRED',
]
export type SampleApplication = {
  id: string
  jobId: string
  name: string
  email: string
  phone: string
  role: string
  color: string
  stage: ApplicationStage
  appliedAt: string
  skills: string[]
  summary: string
  experience: string
  education: string
  project: string
  notes: HistoryItem[]
  history: HistoryItem[]
  assessment?: ApplicationAssessment
}
export type ApplicationAssessment =
  | { status: 'NOT_ANALYZED' | 'PENDING' | 'FAILED'; sample: true }
  | {
      status: 'COMPLETED'
      sample: true
      score: number
      summary: string
      criteria: {
        skill: string
        result: 'MATCHED' | 'NO_EVIDENCE' | 'CLARIFY'
        points: number
        weight: number
        source: string
        evidence: string
        explanation: string
      }[]
      questions: string[]
    }
export const assessmentLabels = {
  NOT_ANALYZED: 'Chưa phân tích',
  PENDING: 'Đang phân tích',
  FAILED: 'Phân tích lỗi',
  COMPLETED: 'Có đánh giá',
}
export type HrProfile = {
  phone: string
  employeeCode: string
  jobTitle: string
  department: string
  avatarUrl: string
}

export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
}
export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
export function dateLabel(value?: string | null, withTime = false) {
  if (!value) return '—'
  const date = new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? ({ hour: '2-digit', minute: '2-digit' } as const) : {}),
  }).format(date)
}
export function dateInput(days = 0) {
  const date = new Date(Date.now() + days * 86400000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function expired(deadline?: string | null) {
  if (!deadline) return false
  return Date.parse(deadline.length === 10 ? `${deadline}T23:59:59+07:00` : deadline) <= Date.now()
}
export function money(value: string | number) {
  return new Intl.NumberFormat('vi-VN').format(Number(value))
}
export function salaryLabel(draft: JobDraft) {
  if (draft.salaryMode === 'NEGOTIABLE') return 'Thỏa thuận'
  if (draft.salaryMode === 'FROM') return `Từ ${money(draft.salaryMin)} ₫/tháng`
  if (draft.salaryMode === 'UP_TO') return `Đến ${money(draft.salaryMax)} ₫/tháng`
  return `${money(draft.salaryMin)} – ${money(draft.salaryMax)} ₫/tháng`
}
export function emptyDraft(): JobDraft {
  return {
    title: '',
    headcount: '1',
    category: 'Công nghệ',
    location: jobWorkLocation('Hybrid'),
    level: 'Junior',
    mode: 'Hybrid',
    employmentType: 'FULL_TIME',
    salaryMode: 'NEGOTIABLE',
    salaryMin: '',
    salaryMax: '',
    deadline: '',
    skills: [],
    criteria: [],
    description: '',
    requirements: '',
    benefits: '',
  }
}
// The company currently has one office. Keep form, preview and saved draft consistent.
export function jobWorkLocation(mode: string) {
  return mode === 'Remote' ? 'Làm việc từ xa' : 'Đà Nẵng'
}
export function validateDraft(draft: JobDraft, publish = false): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.title.trim()) errors.title = 'Nhập tiêu đề tin tuyển dụng.'
  if (draft.title.trim().length > 255) errors.title = 'Tiêu đề tin tối đa 255 ký tự.'
  if (!draft.location.trim()) errors.location = 'Nhập địa điểm làm việc.'
  if (draft.location.trim().length > 255) errors.location = 'Địa điểm tối đa 255 ký tự.'
  if (!/^\d+$/.test(draft.headcount) || Number(draft.headcount) < 1)
    errors.headcount = 'Số lượng cần tuyển phải là số nguyên lớn hơn 0.'
  else if (Number(draft.headcount) > 2147483647)
    errors.headcount = 'Số lượng cần tuyển vượt giới hạn cho phép.'
  if (draft.salaryMode === 'RANGE' || draft.salaryMode === 'FROM') {
    if (
      !draft.salaryMin ||
      !Number.isFinite(Number(draft.salaryMin)) ||
      Number(draft.salaryMin) < 0
    )
      errors.salaryMin = 'Nhập mức lương từ hợp lệ, không âm.'
  }
  if (draft.salaryMode === 'RANGE' || draft.salaryMode === 'UP_TO') {
    if (
      !draft.salaryMax ||
      !Number.isFinite(Number(draft.salaryMax)) ||
      Number(draft.salaryMax) < 0
    )
      errors.salaryMax = 'Nhập mức lương đến hợp lệ, không âm.'
  }
  if (
    draft.salaryMode === 'RANGE' &&
    !errors.salaryMin &&
    !errors.salaryMax &&
    Number(draft.salaryMax) < Number(draft.salaryMin)
  )
    errors.salaryMax = 'Mức lương đến phải bằng hoặc lớn hơn mức lương từ.'
  for (const key of ['salaryMin', 'salaryMax'] as const) {
    if (
      (key === 'salaryMin' && ['RANGE', 'FROM'].includes(draft.salaryMode)) ||
      (key === 'salaryMax' && ['RANGE', 'UP_TO'].includes(draft.salaryMode))
    ) {
      if (Number(draft[key]) > 9999999999999.99 || !/^\d+(\.\d{1,2})?$/.test(draft[key]))
        errors[key] = 'Mức lương tối đa 9.999.999.999.999,99 VND, có tối đa 2 chữ số thập phân.'
    }
  }
  if (draft.deadline && !Number.isFinite(Date.parse(`${draft.deadline}T23:59:59+07:00`)))
    errors.deadline = 'Hạn nộp không hợp lệ.'
  if (publish && expired(draft.deadline))
    errors.deadline = 'Cập nhật hạn nộp trước khi đăng hoặc mở lại tin.'
  if (!draft.skills.length) errors.skills = 'Thêm ít nhất một kỹ năng.'
  if (
    draft.skills.length > 100 ||
    draft.skills.some((item) => !item.name.trim() || item.name.length > 100)
  )
    errors.skills = 'Tối đa 100 kỹ năng, mỗi tên từ 1 đến 100 ký tự.'
  if (!draft.description.trim()) errors.description = 'Nhập mô tả công việc.'
  if (!draft.requirements.trim()) errors.requirements = 'Nhập yêu cầu ứng viên.'
  for (const key of ['description', 'requirements', 'benefits'] as const)
    if (draft[key].length > 20000) errors[key] = 'Nội dung tối đa 20.000 ký tự.'
  if (
    draft.criteria.some(
      (item) =>
        !item.description.trim() ||
        item.description.length > 20000 ||
        !Number.isFinite(item.weight) ||
        item.weight < 0 ||
        item.weight > 100,
    )
  )
    errors.criteria = 'Mỗi tiêu chí cần mô tả và trọng số từ 0 đến 100.'
  if (draft.criteria.length > 100) errors.criteria = 'Tối đa 100 tiêu chí.'
  return errors
}
