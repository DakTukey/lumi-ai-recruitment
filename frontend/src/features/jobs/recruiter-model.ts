import type { Job, JobStatus } from '../../types/domain'
import { initialJobs } from './data/jobs'

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
export function history(text: string, actor = 'Nhân sự mẫu'): HistoryItem {
  return { id: crypto.randomUUID(), text, actor, at: new Date().toISOString() }
}
export function jobFromDraft(
  draft: JobDraft,
  previous?: RecruiterJob,
  publish = false,
  actor?: string,
): RecruiterJob {
  const cleaned: JobDraft = {
    ...draft,
    title: draft.title.trim(),
    location: draft.location.trim(),
    description: draft.description.trim(),
    requirements: draft.requirements.trim(),
    benefits: draft.benefits.trim(),
    salaryMin:
      draft.salaryMode === 'NEGOTIABLE' || draft.salaryMode === 'UP_TO' ? '' : draft.salaryMin,
    salaryMax:
      draft.salaryMode === 'NEGOTIABLE' || draft.salaryMode === 'FROM' ? '' : draft.salaryMax,
    criteria: draft.criteria.map((item) => ({ ...item, description: item.description.trim() })),
  }
  const status = publish ? 'PUBLISHED' : (previous?.status ?? 'DRAFT')
  const text = previous
    ? publish && previous.status !== 'PUBLISHED'
      ? 'Đăng tin mẫu.'
      : 'Cập nhật nội dung tin mẫu.'
    : publish
      ? 'Tạo và đăng tin mẫu.'
      : 'Tạo bản nháp mẫu.'
  return {
    ...previous,
    id: previous?.id ?? `demo-${crypto.randomUUID()}`,
    title: cleaned.title,
    headcount: Number(cleaned.headcount),
    company: 'Lumi Studio',
    mark: 'lumi',
    color: 'violet',
    category: cleaned.category,
    level: cleaned.level,
    mode: cleaned.mode,
    employmentType: cleaned.employmentType,
    location: cleaned.location,
    salary: salaryLabel(cleaned),
    minSalary: Number(cleaned.salaryMin || 0) / 1000000,
    deadline: cleaned.deadline || null,
    tags: cleaned.skills.map((item) => item.name),
    description: cleaned.description,
    requirements: cleaned.requirements,
    benefits: cleaned.benefits,
    posted: 'Trong phiên mẫu',
    ageHours: 0,
    status,
    draft: cleaned,
    updatedAt: new Date().toISOString(),
    history: [...(previous?.history ?? []), history(text, actor)],
  }
}
export function seedJobs(): RecruiterJob[] {
  return initialJobs.map((job, index) => {
    const salary = job.salary.match(/\d+/g) ?? []
    const draft: JobDraft = {
      ...emptyDraft(),
      title: job.title,
      category: job.category,
      location: job.location,
      level: job.level,
      mode: job.mode,
      employmentType: job.level === 'Intern' ? 'INTERNSHIP' : 'FULL_TIME',
      salaryMode: 'RANGE',
      salaryMin: String(Number(salary[0]) * 1000000),
      salaryMax: String(Number(salary[1]) * 1000000),
      deadline: dateInput(20 + index),
      description: job.description,
      requirements:
        'Có kiến thức chuyên môn phù hợp vị trí, chủ động học hỏi và phối hợp làm việc nhóm.',
      benefits: 'Mentor đồng hành, môi trường cởi mở và cơ hội phát triển chuyên môn.',
      skills: job.tags.map((name, i) => ({ name, required: i < 2 })),
      criteria: [
        {
          id: `criterion-${index}`,
          type: 'EXPERIENCE',
          description:
            job.level === 'Intern'
              ? 'Có project cá nhân hoặc bài tập thực tế.'
              : 'Có kinh nghiệm thực tế phù hợp với cấp độ tuyển dụng.',
          required: true,
          weight: 1,
        },
      ],
    }
    return {
      ...jobFromDraft(draft),
      id: String(job.id),
      status: index === 3 ? 'DRAFT' : index === 5 ? 'CLOSED' : 'PUBLISHED',
      history: [history('Khởi tạo tin minh họa.')],
      updatedAt: new Date(Date.now() - job.ageHours * 3600000).toISOString(),
    }
  })
}
export function seedApplications(): SampleApplication[] {
  return [
    {
      id: 'app-1',
      jobId: '1',
      name: 'Minh Anh',
      email: 'minhanh@example.test',
      phone: '0900000001',
      role: 'Frontend Developer',
      color: 'violet',
      stage: 'SUBMITTED' as const,
      skills: ['React', 'TypeScript', 'REST API'],
      summary:
        'Phát triển giao diện web với React, chú trọng trải nghiệm người dùng và khả năng bảo trì.',
      experience:
        'Frontend Developer · Dự án học tập và thực tập\nXây dựng component, tích hợp REST API, phối hợp review code.',
      education: 'Cử nhân Công nghệ thông tin · 2022–2026',
      project:
        'Ứng dụng quản lý công việc\nReact, TypeScript, REST API · Phát triển giao diện tìm kiếm, phân trang và quản lý phiên.',
      assessment: {
        status: 'COMPLETED',
        sample: true,
        score: 78,
        summary:
          'CV mẫu có đề cập React, TypeScript và tích hợp REST API. Chưa có bằng chứng cụ thể về UI/UX; cần làm rõ mức độ đóng góp và kinh nghiệm thực tế.',
        criteria: [
          {
            skill: 'React',
            result: 'MATCHED',
            points: 40,
            weight: 40,
            source: 'CV mẫu · Dự án',
            evidence:
              'Ứng dụng quản lý công việc\nReact, TypeScript, REST API · Phát triển giao diện tìm kiếm, phân trang và quản lý phiên.',
            explanation: 'Project có đề cập React, đáp ứng tiêu chí minh họa về công nghệ.',
          },
          {
            skill: 'TypeScript',
            result: 'MATCHED',
            points: 30,
            weight: 30,
            source: 'CV mẫu · Kỹ năng và dự án',
            evidence: 'React, TypeScript, REST API',
            explanation:
              'Có khai báo và đề cập TypeScript trong project; chưa kiểm chứng mức độ thành thạo.',
          },
          {
            skill: 'UI/UX',
            result: 'NO_EVIDENCE',
            points: 0,
            weight: 20,
            source: 'CV mẫu · Kỹ năng và dự án',
            evidence: 'Chưa có mô tả về nghiên cứu người dùng, thiết kế hoặc kiểm thử trải nghiệm.',
            explanation:
              'Chưa cộng 20 điểm vì thiếu thông tin trong CV. Không đồng nghĩa ứng viên không có kỹ năng này.',
          },
          {
            skill: 'Kinh nghiệm thực tế',
            result: 'CLARIFY',
            points: 8,
            weight: 10,
            source: 'CV mẫu · Kinh nghiệm',
            evidence:
              'Frontend Developer · Dự án học tập và thực tập\nXây dựng component, tích hợp REST API, phối hợp review code.',
            explanation:
              'Có mô tả công việc liên quan; còn 2 điểm chưa cộng vì chưa rõ thời gian và mức độ đóng góp.',
          },
        ],
        questions: [
          'Bạn đã dùng TypeScript để xử lý dữ liệu REST API trong project như thế nào?',
          'Bạn đảm nhiệm phần nào của project, trong bao lâu và kết quả cụ thể là gì?',
          'Bạn đã từng đánh giá hoặc cải thiện UI/UX bằng phản hồi người dùng chưa?',
        ],
      } satisfies ApplicationAssessment,
    },
    {
      id: 'app-2',
      jobId: '1',
      name: 'Quang Huy',
      email: 'quanghuy@example.test',
      phone: '0900000002',
      role: 'Frontend Developer',
      color: 'blue',
      stage: 'REVIEWING' as const,
      skills: ['React', 'TypeScript', 'Git'],
      summary: 'Có kinh nghiệm xây dựng giao diện và phối hợp nhóm phát triển sản phẩm.',
      experience:
        'Frontend Developer · Project cá nhân\nThiết kế component tái sử dụng và quản lý trạng thái.',
      education: 'Cử nhân Kỹ thuật phần mềm · 2021–2025',
      project:
        'Dashboard theo dõi sản phẩm\nReact, TypeScript, Git · Xây dựng bảng dữ liệu và bộ lọc.',
      assessment: { status: 'PENDING', sample: true } satisfies ApplicationAssessment,
    },
    {
      id: 'app-3',
      jobId: '3',
      name: 'Thu Hà',
      email: 'thuha@example.test',
      phone: '0900000003',
      role: 'Backend Developer',
      color: 'orange',
      stage: 'INTERVIEW' as const,
      skills: ['Java', 'Spring Boot', 'PostgreSQL'],
      summary:
        'Phát triển API với Java và Spring Boot, quan tâm đến thiết kế dữ liệu và hiệu suất.',
      experience:
        'Backend Developer · Project nhóm\nThiết kế API, xác thực phiên và viết truy vấn PostgreSQL.',
      education: 'Cử nhân Công nghệ thông tin · 2021–2025',
      project:
        'API quản lý công việc\nJava, Spring Boot, PostgreSQL · Phân quyền và kiểm tra dữ liệu đầu vào.',
      assessment: { status: 'NOT_ANALYZED', sample: true } satisfies ApplicationAssessment,
    },
  ].map((item) => ({
    ...item,
    appliedAt: new Date(Date.now() - 86400000).toISOString(),
    notes: [],
    history: [
      {
        ...history('Nộp đơn và lưu CV mẫu tại thời điểm ứng tuyển.', item.name),
        at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  }))
}
