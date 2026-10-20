import type { ParsedResume } from '../../services/resume.service'

// Older extractions may contain empty or bullet-only model warnings.
export function readablePdfWarnings(warnings: unknown): string[] {
  if (!Array.isArray(warnings)) return []
  return [
    ...new Set(
      warnings
        .filter((warning): warning is string => typeof warning === 'string')
        .map((warning) => warning.replace(/[\u200B-\u200D\uFEFF]/g, '').trim())
        .filter((warning) => warning.replace(/[\s•*–—.-]/g, '').length > 0),
    ),
  ]
}

export type ReviewField = {
  key: string
  label: string
  kind?: 'long' | 'month' | 'boolean' | 'list' | 'number'
  max?: number
}
export const contactFields: ReviewField[] = [
  { key: 'title', label: 'Tên CV', max: 100 },
  { key: 'fullName', label: 'Họ tên', max: 150 },
  { key: 'email', label: 'Email', max: 255 },
  { key: 'phone', label: 'Điện thoại', max: 30 },
  { key: 'location', label: 'Nơi ở' },
  { key: 'desiredPosition', label: 'Vị trí mong muốn' },
  { key: 'summary', label: 'Giới thiệu', kind: 'long' },
  ...['github', 'linkedin', 'portfolio'].map((key) => ({
    key: `${key}Url`,
    label: key,
    max: 2048,
  })),
  { key: 'skills', label: 'Kỹ năng (mỗi dòng một kỹ năng)', kind: 'list' },
]
const dates: ReviewField[] = [
  { key: 'startDate', label: 'Bắt đầu', kind: 'month' },
  { key: 'endDate', label: 'Kết thúc', kind: 'month' },
]
const description: ReviewField = { key: 'description', label: 'Mô tả', kind: 'long' }
const current: ReviewField = { key: 'current', label: 'Đang thực hiện', kind: 'boolean' }
export const reviewSections: { key: string; label: string; fields: ReviewField[] }[] = [
  {
    key: 'experiences',
    label: 'Kinh nghiệm',
    fields: [
      { key: 'company', label: 'Công ty' },
      { key: 'position', label: 'Chức danh' },
      ...dates,
      current,
      description,
    ],
  },
  {
    key: 'educations',
    label: 'Học vấn',
    fields: [
      { key: 'school', label: 'Trường' },
      { key: 'degree', label: 'Bằng cấp' },
      { key: 'field', label: 'Ngành học' },
      ...dates,
      description,
      { key: 'gpa', label: 'GPA', kind: 'number' },
      { key: 'gpaScale', label: 'Thang điểm (4, 10, 100)', kind: 'number' },
    ],
  },
  {
    key: 'projects',
    label: 'Dự án',
    fields: [
      { key: 'name', label: 'Tên dự án' },
      { key: 'role', label: 'Vai trò' },
      { key: 'url', label: 'Liên kết', max: 2048 },
      ...dates,
      current,
      description,
      { key: 'technologies', label: 'Công nghệ (mỗi dòng một mục)', kind: 'list' },
    ],
  },
  {
    key: 'certifications',
    label: 'Chứng chỉ',
    fields: [
      { key: 'name', label: 'Tên chứng chỉ' },
      { key: 'issuer', label: 'Đơn vị cấp' },
      { key: 'issuedDate', label: 'Ngày cấp', kind: 'month' },
      { key: 'credentialUrl', label: 'Liên kết', max: 2048 },
    ],
  },
  {
    key: 'languages',
    label: 'Ngoại ngữ',
    fields: [
      { key: 'name', label: 'Ngôn ngữ' },
      { key: 'proficiency', label: 'Trình độ' },
      { key: 'certification', label: 'Chứng nhận' },
    ],
  },
  {
    key: 'awards',
    label: 'Giải thưởng',
    fields: [
      { key: 'title', label: 'Tên giải thưởng' },
      { key: 'issuer', label: 'Đơn vị trao' },
      { key: 'awardedDate', label: 'Ngày trao', kind: 'month' },
      description,
    ],
  },
  {
    key: 'activities',
    label: 'Hoạt động',
    fields: [
      { key: 'name', label: 'Hoạt động' },
      { key: 'organization', label: 'Tổ chức' },
      { key: 'role', label: 'Vai trò' },
      ...dates,
      current,
      description,
    ],
  },
  {
    key: 'extraSections',
    label: 'Mục bổ sung',
    fields: [
      { key: 'title', label: 'Tên mục' },
      { key: 'content', label: 'Nội dung', kind: 'long', max: 12000 },
    ],
  },
]
export function moveReviewEntry(
  content: ParsedResume,
  from: 'experiences' | 'projects',
  index: number,
): ParsedResume {
  const source = content[from]?.[index]
  if (!source) return content
  const target = from === 'experiences' ? 'projects' : 'experiences'
  if ((content[target]?.length ?? 0) >= 30) return content
  const common = {
    startDate: source.startDate ?? '',
    endDate: source.endDate ?? '',
    current: source.current ?? false,
    description: source.description ?? '',
  }
  const entry =
    from === 'experiences'
      ? {
          ...common,
          name: 'company' in source ? (source.company ?? '') : '',
          role: 'position' in source ? (source.position ?? '') : '',
          url: '',
          technologies: [],
        }
      : {
          ...common,
          company: '',
          position: 'role' in source ? (source.role ?? '') : '',
          description: [
            source.description,
            'name' in source && source.name && `Dự án: ${source.name}`,
            'url' in source && source.url,
            'technologies' in source && source.technologies?.join(', '),
          ]
            .filter(Boolean)
            .join('\n'),
        }
  return {
    ...content,
    [from]: content[from]?.filter((_, i) => i !== index),
    [target]: [...(content[target] ?? []), entry],
  }
}
export function reviewLabel(path: string): string {
  const [section, index, key] = path.replaceAll('[', '.').replaceAll(']', '').split('.')
  const group = reviewSections.find((s) => s.key === section)
  if (group)
    return `${group.label} ${Number(index) + 1}${key ? ` · ${group.fields.find((f) => f.key === key)?.label ?? 'Kiểm tra thông tin'}` : ''}`
  return contactFields.find((f) => f.key === section)?.label ?? path
}
