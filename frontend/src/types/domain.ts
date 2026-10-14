/* ============================================================
 *  Domain Types — Lumi Studio AI Recruitment Assistant
 *  Đồng bộ với docs/database-design.md
 * ============================================================ */

// ─── Enums ───────────────────────────────────────────────────

export type UserRole = 'CANDIDATE' | 'RECRUITER' | 'COMPANY_ADMIN'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED'

export type WorkMode = 'Tại văn phòng' | 'Hybrid' | 'Remote'

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'INTERNSHIP' | 'CONTRACT'

export type ExperienceLevel = 'Intern' | 'Junior' | 'Middle' | 'Senior'

export type ApplicationStatus =
  'SUBMITTED' | 'REVIEWING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED' | 'WITHDRAWN'

export type MatchLevel = 'STRONG' | 'PARTIAL' | 'WEAK' | 'UNKNOWN'

export type QuestionStatus = 'SUGGESTED' | 'ACCEPTED' | 'REJECTED'

// ─── Users ───────────────────────────────────────────────────

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'

export type User = {
  id: string
  email: string
  fullName: string
  role: UserRole
  status: UserStatus
  createdAt: string
  onboardingStatus: OnboardingStatus | null
}

export type CandidateProfile = {
  userId: string
  headline: string
  phone: string
  skills: string[]
  experienceYears: number
  updatedAt: string
}

// ─── Jobs ────────────────────────────────────────────────────

export type JobLocation = {
  id: string
  name: string
  address: string
  city: string
  isActive: boolean
}

export type JobRequirement = {
  id: string
  jobId: string
  name: string
  type: string
  isRequired: boolean
  weight: number
  description: string
}

/**
 * Type dùng cho giao diện hiện tại (dữ liệu mock).
 * Khi kết nối API, sẽ map từ response backend sang type này
 * hoặc dần dần chuyển component sang dùng `JobDetail` bên dưới.
 */
export type Job = {
  applicationCount?: number
  positionName?: string | null
  skills?: string[]
  id: string | number
  headcount?: number
  source?: 'database'
  requirements?: string
  benefits?: string
  deadline?: string | null
  employmentType?: string
  title: string
  company: string
  mark: string
  color: string
  location: string
  salary: string
  minSalary: number
  category: string
  level: string
  mode: string
  tags: string[]
  featured?: boolean
  posted: string
  ageHours: number
  description: string
}

/**
 * Type phản ánh bảng `jobs` trong database.
 * Sử dụng khi kết nối API thực tế.
 */
export type JobEntity = {
  id: string
  headcount: number
  title: string
  description: string
  locationId: string
  location?: JobLocation
  workMode: WorkMode
  employmentType: EmploymentType
  level: ExperienceLevel
  salaryMin: number | null
  salaryMax: number | null
  status: JobStatus
  createdBy: string
  publishedAt: string | null
  deadline: string | null
  requirements?: JobRequirement[]
}

// ─── Resumes ─────────────────────────────────────────────────

export type Resume = {
  id: string
  candidateId: string
  title: string
  fullName: string | null
  email: string | null
  phone: string | null
  location: string | null
  desiredPosition: string | null
  summary: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  skills: string[]
  experiences: ResumeExperience[]
  educations: ResumeEducation[]
  projects: ResumeProject[]
  certifications: ResumeCertification[]
  languages: ResumeLanguage[]
  awards: ResumeAward[]
  activities: ResumeActivity[]
  sourceDocumentId?: string | null
  extraSections?: { title: string; content: string }[]
  template: 'classic' | 'modern'
  status: 'DRAFT' | 'READY'
  isDefault: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type ResumeExperience = {
  company: string
  position: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}
export type ResumeEducation = {
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
  description: string
  gpa?: number | null
  gpaScale?: number | null
}
export type ResumeProject = {
  name: string
  role: string
  url: string
  description: string
  startDate?: string
  endDate?: string
  current?: boolean
  technologies?: string[]
}
export type ResumeCertification = {
  name: string
  issuer: string
  issuedDate: string
  credentialUrl: string
}

export type ResumeLanguage = { name: string; proficiency: string; certification: string }
export type ResumeAward = {
  title: string
  issuer: string
  awardedDate: string
  description: string
}
export type ResumeActivity = {
  name: string
  organization: string
  role: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

export type ResumeExtraction = {
  id: string
  resumeId: string
  parserVersion: string
  content: Record<string, unknown>
  createdAt: string
}

// ─── Applications ────────────────────────────────────────────

/**
 * Type dùng cho giao diện hiện tại (dữ liệu mock).
 */
export type Application = {
  jobId: string | number
  job?: Job
  status: string
  name: string
}

/**
 * Type phản ánh bảng `applications` trong database.
 */
export type ApplicationEntity = {
  id: string
  jobId: string
  candidateId: string
  resumeId: string
  coverLetter: string | null
  status: ApplicationStatus
  appliedAt: string
  updatedAt: string
}

export type ApplicationStatusHistory = {
  id: string
  applicationId: string
  fromStatus: ApplicationStatus | null
  toStatus: ApplicationStatus
  changedBy: string
  note: string | null
  createdAt: string
}

// ─── AI Assessments ──────────────────────────────────────────

export type AiAssessment = {
  id: string
  applicationId: string
  modelName: string
  promptVersion: string
  score: number
  summary: string
  riskNote: string | null
  createdAt: string
}

export type RequirementResult = {
  id: string
  assessmentId: string
  requirementId: string
  matchLevel: MatchLevel
  evidence: string
  reason: string
}

export type InterviewQuestion = {
  id: string
  applicationId: string
  assessmentId: string | null
  question: string
  reason: string
  status: QuestionStatus
}
