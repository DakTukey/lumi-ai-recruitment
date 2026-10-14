import type { ResumeInput } from '../../services/resume.service'

export const skillIdentity = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()

/** Preserve spelling and report skipped items instead of silently truncating a skill. */
export function mergeSkills(existing: string[], incoming: string[]) {
  const skills: string[] = []
  const seen = new Set<string>()
  let tooLong = 0
  let overflow = 0
  for (const value of [...existing, ...incoming]) {
    const name = value.trim().replace(/\s+/g, ' ')
    if (!name || seen.has(skillIdentity(name))) continue
    if (name.length > 100) {
      tooLong++
      continue
    }
    if (skills.length >= 100) {
      overflow++
      continue
    }
    seen.add(skillIdentity(name))
    skills.push(name)
  }
  return { skills, tooLong, overflow }
}

export const profileSkillNames = (value: string | null | undefined) => (value ?? '').split(/[,\n]/)

export type CvIssue = { field: string; step: number; message: string }
export function validateCv(draft: ResumeInput): CvIssue[] {
  const issues: CvIssue[] = []
  const add = (field: string, step: number, message: string) =>
    issues.push({ field, step, message })
  const url = (value: unknown, field: string, step: number) => {
    if (typeof value === 'string' && value.trim() && !/^https?:\/\/[^\s]+$/i.test(value.trim()))
      add(field, step, 'Liên kết cần bắt đầu bằng https:// hoặc http:// và không có khoảng trắng.')
  }
  if (draft.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
    add('email', 0, 'Nhập email hợp lệ, ví dụ ten@example.com.')
  if (draft.phone?.trim() && !/^[0-9+().\s-]+$/.test(draft.phone.trim()))
    add('phone', 0, 'Số điện thoại chỉ gồm số, khoảng trắng và các dấu + ( ) . - .')
  for (const key of ['githubUrl', 'linkedinUrl', 'portfolioUrl'] as const) url(draft[key], key, 0)
  if ((draft.extraSections ?? []).some(s => !s.title.trim() || !s.content.trim() || s.title.length > 255 || s.content.length > 12000))
    add('extraSections', 3, 'Mục bổ sung cần tiêu đề và nội dung, tối đa 255/12000 ký tự.')
  if (draft.skills.length > 100 || draft.skills.some((s) => !s.trim() || s.length > 100))
    add('skills', 1, 'Tối đa 100 kỹ năng; mỗi kỹ năng từ 1 đến 100 ký tự.')
  const groups = [
    ['educations', 2],
    ['experiences', 2],
    ['projects', 2],
    ['languages', 1],
    ['certifications', 3],
    ['awards', 3],
    ['activities', 3],
  ] as const
  for (const [group, step] of groups) {
    for (const [index, entry] of draft[group].entries()) {
      const row = entry as unknown as Record<string, unknown>
      const field = (key: string) => `${group}-${index}-${key}`
      for (const key of ['startDate', 'endDate', 'issuedDate', 'awardedDate']) {
        if (row[key] && !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(String(row[key])))
          add(field(key), step, 'Nhập tháng/năm hợp lệ.')
      }
      if (row.startDate && row.endDate && String(row.startDate) > String(row.endDate))
        add(field('endDate'), step, 'Tháng kết thúc phải từ tháng bắt đầu trở đi.')
      if (row.current && row.endDate)
        add(field('endDate'), step, 'Mục đang thực hiện không có ngày kết thúc.')
      url(row.url, field('url'), step)
      url(row.credentialUrl, field('credentialUrl'), step)
      if (group === 'educations' && (row.gpa != null || row.gpaScale != null)) {
        if (
          row.gpa == null ||
          !Number.isFinite(row.gpa) ||
          Number(row.gpa) < 0 ||
          Math.abs(Number(row.gpa) * 100 - Math.round(Number(row.gpa) * 100)) > 0.000001
        )
          add(field('gpa'), step, 'Nhập GPA không âm, tối đa 2 chữ số thập phân.')
        if (![4, 10, 100].includes(Number(row.gpaScale)))
          add(field('gpaScale'), step, 'Chọn thang điểm 4, 10 hoặc 100.')
        else if (Number(row.gpa) > Number(row.gpaScale))
          add(field('gpa'), step, 'GPA không được vượt quá thang điểm đã chọn.')
      }
      if (
        Array.isArray(row.technologies) &&
        (row.technologies.length > 100 ||
          row.technologies.some((s) => typeof s !== 'string' || !s.trim() || s.length > 100))
      )
        add(field('technologies'), step, 'Tối đa 100 công nghệ; mỗi tên từ 1 đến 100 ký tự.')
    }
  }
  return issues
}

/** Suggestions, not a score or a requirement to invent work experience. */
export function cvQualityHints(draft: ResumeInput): CvIssue[] {
  const hints: CvIssue[] = []
  if (!draft.summary?.trim())
    hints.push({
      field: 'summary',
      step: 1,
      message: 'Thêm vài dòng giới thiệu hoặc mục tiêu nghề nghiệp.',
    })
  if (!draft.skills.length)
    hints.push({ field: 'skills', step: 1, message: 'Bổ sung những kỹ năng bạn thực sự có.' })
  if (
    !draft.educations.some((e) => e.school?.trim()) &&
    !draft.experiences.some(
      (e) => (e.company?.trim() || e.position?.trim()) && e.description?.trim(),
    ) &&
    !draft.projects.some((p) => p.name?.trim() && p.description?.trim())
  )
    hints.push({
      field: 'educations',
      step: 2,
      message:
        'Thêm học vấn, hoặc kinh nghiệm/dự án có mô tả đóng góp. Chưa đi làm có thể dùng dự án học tập.',
    })
  for (const [group, key, title, step] of [
    ['educations', 'school', 'Học vấn', 2],
    ['experiences', 'company', 'Kinh nghiệm', 2],
    ['projects', 'name', 'Dự án', 2],
    ['languages', 'name', 'Ngoại ngữ', 1],
    ['certifications', 'name', 'Chứng chỉ', 3],
    ['awards', 'title', 'Giải thưởng', 3],
    ['activities', 'name', 'Hoạt động', 3],
  ] as const) {
    draft[group].forEach((entry, index) => {
      const row = entry as unknown as Record<string, unknown>
      const hasContent = Object.values(row).some((v) =>
        typeof v === 'string'
          ? !!v.trim()
          : typeof v === 'number' || (Array.isArray(v) && v.length > 0),
      )
      if (hasContent && !String(row[key] ?? '').trim())
        hints.push({
          field: `${group}-${index}-${key}`,
          step,
          message: `${title} ${index + 1}: bổ sung ${key === 'company' ? 'tên công ty/tổ chức' : key === 'school' ? 'tên trường' : 'tên mục'} để nội dung rõ ràng.`,
        })
    })
  }
  return hints
}
