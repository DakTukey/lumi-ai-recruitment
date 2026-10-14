import type { ApplicationStatus, JobStatus, UserRole, UserStatus } from '../../types/domain'

export type AdminAccount = {
  id: string
  fullName: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt: string
}
export type AdminDepartment = { id: string; name: string; description: string }
export type AdminJob = {
  id: string
  title: string
  departmentId: string
  location: string
  mode: string
  status: JobStatus
  headcount: number
  quotaStatus: 'PENDING' | 'APPROVED'
  quotaApprovedBy: string | null
  quotaApprovedAt: string | null
  createdById: string
  recruiterId: string | null
}
export type AdminJobApplication = {
  id: string
  jobId: string
  candidateId: string
  status: ApplicationStatus
}
export type AdminActivity = { id: string; action: string; target: string; at: string }

export const roleLabels: Record<UserRole, string> = {
  CANDIDATE: 'Ứng viên',
  RECRUITER: 'Nhân sự',
  COMPANY_ADMIN: 'Quản trị viên',
}
export const jobStatusLabels: Record<JobStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang tuyển',
  CLOSED: 'Đã đóng',
}
export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
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
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
