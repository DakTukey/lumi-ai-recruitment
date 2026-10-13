import { get, put } from './api'

export type RecruiterProfileData = {
  userId: string
  fullName: string
  email: string
  role: string
  phone: string | null
  employeeCode: string | null
  jobTitle: string | null
  departmentId: string | null
  departmentName: string | null
  departmentActive: boolean
  avatarUrl: string | null
  version: number
  createdAt: string | null
  updatedAt: string | null
}
export type RecruiterProfileDraft = {
  phone: string
  employeeCode: string
  jobTitle: string
  departmentId: string
  avatarUrl: string
}
export function profileDraft(profile: RecruiterProfileData): RecruiterProfileDraft {
  return {
    phone: profile.phone ?? '',
    employeeCode: profile.employeeCode ?? '',
    jobTitle: profile.jobTitle ?? '',
    departmentId: profile.departmentId ?? '',
    avatarUrl: profile.avatarUrl ?? '',
  }
}
export function validateProfile(draft: RecruiterProfileDraft): string {
  const phone = draft.phone.trim()
  if (phone && (!/^\+?[\d\s().-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, '')))) {
    return 'Số điện thoại cần 7–15 chữ số, có thể có + và dấu phân cách.'
  }
  if (draft.avatarUrl.trim()) {
    try {
      const url = new URL(draft.avatarUrl.trim())
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      )
        throw new Error()
    } catch {
      return 'Đường dẫn ảnh cần là URL http/https hợp lệ, không chứa tài khoản hoặc mật khẩu.'
    }
  }
  return ''
}
export async function getRecruiterProfile(): Promise<RecruiterProfileData> {
  return (await get<RecruiterProfileData>('/recruiter/profile')).data
}
export async function saveRecruiterProfile(
  draft: RecruiterProfileDraft,
  version: number,
): Promise<RecruiterProfileData> {
  const clean = (s: string) => s.trim() || null
  return (
    await put<RecruiterProfileData>('/recruiter/profile', {
      version,
      phone: clean(draft.phone),
      employeeCode: clean(draft.employeeCode),
      jobTitle: clean(draft.jobTitle),
      departmentId: clean(draft.departmentId),
      avatarUrl: clean(draft.avatarUrl),
    })
  ).data
}
