import { PdfDocumentViewer } from './PdfDocumentViewer'
import { jobApplicationPath, jobMatchPath } from '../jobs/candidate-job-route'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  FileText,
  GraduationCap,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { getProfile } from '../../services/profile.service'
import {
  createResume,
  getResume,
  saveResume,
  getResumePositionOptions,
  getResumeSkillOptions,
  getResumeUniversityOptions,
  getCvDocument,
  cvDocumentUrl,
} from '../../services/resume.service'
import type { ResumeInput, UniversityOption } from '../../services/resume.service'
import { ApiError } from '../../services/api'
import type {
  Resume,
  ResumeExperience,
  ResumeEducation,
  ResumeProject,
  ResumeCertification,
  ResumeLanguage,
  ResumeAward,
  ResumeActivity,
} from '../../types/domain'
import { CvPdfImport } from './CvPdfImport'
import { importedDraft } from './pdf-import-model'
import { CvPreview } from './CvPreview'
import { CvReviewAssistant } from './CvReviewAssistant'
import { cvReviewContext, reviewFingerprint, withReviewText } from './cv-review-model'
import { CvWritingAssistant } from './CvWritingAssistant'
import type { CvWritingSection } from '../../services/cv-writing.service'
import { getJobById } from '../../services/job.service'
import { CvPositionField } from './CvPositionField'
import { CvSkillsField } from './CvSkillsField'
import { mergeSkills, profileSkillNames, validateCv, cvQualityHints } from './cv-builder-model'
import type { CvIssue } from './cv-builder-model'
import { hasResumeEntryContent } from './resume-format'
import { CREDENTIAL_PRESETS, analyzeCredentialUrl } from './credential-verification'
import './cv-builder.css'

const cvSteps = [
  {
    title: 'Thông tin cơ bản',
    short: 'Thông tin',
    description: 'Bắt đầu với tên, thông tin liên hệ và vị trí bạn muốn ứng tuyển.',
  },
  {
    title: 'Giới thiệu & kỹ năng',
    short: 'Năng lực',
    description: 'Cho nhà tuyển dụng biết bạn là ai và những gì bạn có thể đóng góp.',
  },
  {
    title: 'Học vấn & kinh nghiệm',
    short: 'Hành trình',
    description: 'Kể về quá trình học tập, công việc và các dự án bạn trực tiếp tham gia.',
  },
  {
    title: 'Bổ sung & hoàn tất',
    short: 'Hoàn tất',
    description: 'Thêm điểm nổi bật, kiểm tra bản xem trước và lưu CV vào tài khoản.',
  },
]

const emptyDraft: ResumeInput = {
  title: 'CV của tôi',
  fullName: '',
  email: '',
  phone: '',
  location: '',
  desiredPosition: '',
  summary: '',
  githubUrl: '',
  linkedinUrl: '',
  portfolioUrl: '',
  skills: [],
  experiences: [],
  educations: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  activities: [],
  template: 'modern',
  status: 'DRAFT',
  version: null,
}
const emptyExperience: ResumeExperience = {
  company: '',
  position: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
}
const emptyEducation: ResumeEducation = {
  school: '',
  degree: '',
  field: '',
  startDate: '',
  endDate: '',
  description: '',
}
const emptyProject: ResumeProject = {
  name: '',
  role: '',
  url: '',
  description: '',
  startDate: '',
  endDate: '',
  current: false,
  technologies: [],
}
const emptyCertification: ResumeCertification = {
  name: '',
  issuer: '',
  issuedDate: '',
  credentialUrl: '',
}
const emptyLanguage: ResumeLanguage = { name: '', proficiency: '', certification: '' }
const emptyAward: ResumeAward = { title: '', issuer: '', awardedDate: '', description: '' }
const emptyActivity: ResumeActivity = {
  name: '',
  organization: '',
  role: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
}
type Field = {
  key: string
  label: string
  type?: 'month' | 'url' | 'textarea' | 'number' | 'select' | 'skills'
  help?: string
  placeholder?: string
  suggestions?: string[]
  choices?: { value: number; label: string }[]
}

const CERTIFICATE_SCORES: Record<string, string[]> = {
  IELTS: ['5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5', '9.0'],
  TOEIC: ['500', '550', '600', '650', '700', '750', '800', '850', '900', '950+'],
  VSTEP: ['B1', 'B2', 'C1'],
  TOEFL: ['65', '75', '80', '85', '90', '95', '100', '105', '110+'],
  JLPT: ['N5', 'N4', 'N3', 'N2', 'N1'],
  TOPIK: ['Cấp 1', 'Cấp 2', 'Cấp 3', 'Cấp 4', 'Cấp 5', 'Cấp 6'],
  HSK: ['HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'],
  CEFR: ['A2', 'B1', 'B2', 'C1', 'C2'],
  DELF: ['A1', 'A2', 'B1', 'B2'],
  DALF: ['C1', 'C2'],
  TCF: ['B1', 'B2', 'C1', 'C2'],
  TOCFL: ['Band A', 'Band B', 'Band C'],
  'NAT-TEST': ['5Q', '4Q', '3Q', '2Q', '1Q'],
}

function getLanguageCertSuggestions(langName?: string): string[] {
  const norm = (langName ?? '').toLowerCase()
  if (norm.includes('nhật') || norm.includes('japan')) {
    return ['JLPT', 'NAT-TEST', 'IELTS', 'TOEIC']
  }
  if (norm.includes('hàn') || norm.includes('korea')) {
    return ['TOPIK', 'KLAT', 'IELTS', 'TOEIC']
  }
  if (norm.includes('trung') || norm.includes('hoa') || norm.includes('chinese')) {
    return ['HSK', 'TOCFL', 'IELTS', 'TOEIC']
  }
  if (norm.includes('pháp') || norm.includes('french')) {
    return ['DELF', 'DALF', 'TCF', 'IELTS', 'TOEIC']
  }
  if (norm.includes('đức') || norm.includes('german')) {
    return ['Goethe', 'TestDaF', 'IELTS', 'TOEIC']
  }
  return ['IELTS', 'TOEIC', 'VSTEP', 'TOEFL', 'JLPT', 'TOPIK', 'HSK', 'CEFR']
}

const DEFAULT_UNIVERSITIES: UniversityOption[] = [
  {
    name: 'Đại học Bách khoa Hà Nội',
    code: 'HUST',
    englishName: 'Hanoi University of Science and Technology',
  },
  {
    name: 'Đại học Quốc gia Hà Nội',
    code: 'VNU',
    englishName: 'Vietnam National University Hanoi',
  },
  {
    name: 'Trường Đại học Công nghệ - ĐHQGHN',
    code: 'UET',
    englishName: 'VNU University of Engineering and Technology',
  },
  {
    name: 'Trường Đại học Khoa học Tự nhiên - ĐHQGHN',
    code: 'HUS',
    englishName: 'Hanoi University of Science',
  },
  {
    name: 'Đại học Kinh tế Quốc dân',
    code: 'NEU',
    englishName: 'Hanoi National Economics University',
  },
  { name: 'Đại học Ngoại thương', code: 'FTU', englishName: 'Foreign Trade University' },
  {
    name: 'Học viện Công nghệ Bưu chính Viễn thông',
    code: 'PTIT',
    englishName: 'Posts & Telecommunications Institute of Technology',
  },
  { name: 'Học viện Tài chính', code: 'AOF', englishName: 'Institute of Finance' },
  { name: 'Học viện Ngân hàng', code: 'BA', englishName: 'Banking Academy' },
  { name: 'Trường Đại học FPT', code: 'FPT', englishName: 'FPT University' },
  {
    name: 'Trường Đại học Giao thông Vận tải',
    code: 'UTC',
    englishName: 'Hanoi Univerisity of Transportation',
  },
  {
    name: 'Trường Đại học Xây dựng Hà Nội',
    code: 'HUCE',
    englishName: 'Hanoi University of Civil Engineering',
  },
  { name: 'Trường Đại học Thủy lợi', code: 'TLU', englishName: 'Water Resources University' },
  {
    name: 'Trường Đại học Công nghiệp Hà Nội',
    code: 'HaUI',
    englishName: 'Hanoi University of Industry',
  },
  { name: 'Trường Đại học Mở Hà Nội', code: 'HOU', englishName: 'Hanoi Open University' },
  { name: 'Trường Đại học Hà Nội', code: 'HANU', englishName: 'Hanoi University' },
  {
    name: 'Trường Đại học Sư phạm Hà Nội',
    code: 'HNUE',
    englishName: 'Hanoi National University of Education',
  },
  {
    name: 'Trường Đại học Mỏ - Địa chất',
    code: 'HUMG',
    englishName: 'Hanoi University of Mining and Geology',
  },
  { name: 'Trường Đại học Y Hà Nội', code: 'HMU', englishName: 'Hanoi Medical University' },
  {
    name: 'Đại học Quốc gia TP.HCM',
    code: 'VNU-HCM',
    englishName: 'Vietnam National University Ho Chi Minh City',
  },
  {
    name: 'Trường Đại học Công nghệ Thông tin - ĐHQG-HCM',
    code: 'UIT',
    englishName: 'University of Information Technology VNU-HCM',
  },
  {
    name: 'Trường Đại học Bách khoa - ĐHQG-HCM',
    code: 'HCMUT',
    englishName: 'Ho Chi Minh City University of Technology',
  },
  {
    name: 'Trường Đại học Khoa học Tự nhiên - ĐHQG-HCM',
    code: 'HCMUS',
    englishName: 'Ho Chi Minh City University of Science',
  },
  {
    name: 'Trường Đại học Kinh tế TP.HCM',
    code: 'UEH',
    englishName: 'Ho Chi Minh City University of Economics',
  },
  {
    name: 'Trường Đại học Sư phạm Kỹ thuật TP.HCM',
    code: 'HCMUTE',
    englishName: 'University of Technical Education Ho Chi Minh City',
  },
  {
    name: 'Trường Đại học Ngân hàng TP.HCM',
    code: 'HUB',
    englishName: 'Banking University of Ho Chi Minh City',
  },
  {
    name: 'Trường Đại học Công thương TP.HCM',
    code: 'HUIT',
    englishName: 'Ho Chi Minh City University of Industry and Trade',
  },
  {
    name: 'Trường Đại học Công nghiệp TP.HCM',
    code: 'IUH',
    englishName: 'Industrial University of Ho Chi Minh City',
  },
  { name: 'Trường Đại học Sài Gòn', code: 'SGU', englishName: 'Saigon University' },
  { name: 'Trường Đại học Mở TP.HCM', code: 'OU', englishName: 'Ho Chi Minh City Open University' },
  { name: 'Trường Đại học Tôn Đức Thắng', code: 'TDTU', englishName: 'Ton Duc Thang University' },
  { name: 'Trường Đại học Văn Lang', code: 'VLU', englishName: 'Van Lang University' },
  { name: 'Trường Đại học Hoa Sen', code: 'HSU', englishName: 'Hoa Sen University' },
  {
    name: 'Trường Đại học RMIT Việt Nam',
    code: 'RMIT',
    englishName: 'RMIT International University Vietnam',
  },
  { name: 'Trường Đại học Việt Đức', code: 'VGU', englishName: 'Vietnamese - German University' },
  { name: 'Đại học Đà Nẵng', code: 'UD', englishName: 'University of Da Nang' },
  {
    name: 'Trường Đại học Bách khoa - ĐH Đà Nẵng',
    code: 'DUT',
    englishName: 'Danang University of Technology',
  },
  {
    name: 'Trường Đại học Sư phạm Kỹ thuật - ĐH Đà Nẵng',
    code: 'UTE',
    englishName: 'Danang University of Technology and Education',
  },
  {
    name: 'Trường ĐH Công nghệ Thông tin và Truyền thông Việt - Hàn',
    code: 'VKU',
    englishName: 'Vietnam - Korea University of Information and Communication Technology',
  },
  { name: 'Trường Đại học Duy Tân', code: 'DTU', englishName: 'Duy Tan University' },
  { name: 'Trường Đại học Cần Thơ', code: 'CTU', englishName: 'Can-Tho University' },
  { name: 'Đại học Huế', code: 'HUE', englishName: 'Hue University' },
  { name: 'Đại học Thái Nguyên', code: 'TNU', englishName: 'Thai Nguyen University' },
  { name: 'Trường Đại học Nha Trang', code: 'NTU', englishName: 'Nha Trang University' },
  { name: 'Trường Đại học Đà Lạt', code: 'DLU', englishName: 'University of Da Lat' },
  { name: 'Trường Đại học Tây Nguyên', code: 'TTU', englishName: 'Tay Nguyen University' },
  { name: 'Trường Đại học Bình Dương', code: 'BDU', englishName: 'Binh Duong University' },
]

const DEFAULT_SKILLS: string[] = [
  'Java',
  'Spring Boot',
  'React',
  'TypeScript',
  'JavaScript',
  'Python',
  'Node.js',
  'Docker',
  'PostgreSQL',
  'MySQL',
  'Git',
  'AWS',
  'C#',
  '.NET Core',
  'C++',
  'Embedded C',
  'Next.js',
  'Vue.js',
  'Angular',
  'HTML5',
  'CSS3',
  'Tailwind CSS',
  'Flutter',
  'React Native',
  'Redis',
  'Kubernetes',
  'CI/CD',
  'Linux',
  'Microservices',
  'RESTful API',
  'GraphQL',
  'Machine Learning',
  'Generative AI',
  'Automation Testing',
  'Manual Testing',
  'Selenium',
  'Postman',
  'Jira',
  'Agile / Scrum',
  'Figma',
  'UI/UX Design',
  'Tiếng Anh (Giao tiếp)',
  'Tiếng Nhật (N3+)',
  'Làm việc nhóm',
  'Giải quyết vấn đề',
]

function SchoolCombobox({
  value,
  onChange,
  options,
  label,
  placeholder,
  helpId,
  id,
}: {
  value: string
  onChange: (val: string) => void
  options: UniversityOption[]
  label: string
  placeholder?: string
  helpId?: string
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')

  const q = normalize(value.trim())

  const matches = useMemo(() => {
    if (!q) {
      return options.slice(0, 8)
    }
    return options
      .filter((opt) => {
        const normName = normalize(opt.name)
        const normCode = normalize(opt.code ?? '')
        const normEng = normalize(opt.englishName ?? '')
        return normName.includes(q) || normCode.includes(q) || normEng.includes(q)
      })
      .slice(0, 8)
  }, [options, q])

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const selectOption = (opt: UniversityOption) => {
    onChange(opt.name)
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown') {
        setOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1 < matches.length ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : matches.length - 1))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < matches.length) {
        e.preventDefault()
        selectOption(matches[activeIndex])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="cv-school-combobox-wrapper" ref={containerRef}>
      <div className="cv-school-input-wrapper">
        <GraduationCap size={16} className="cv-school-input-icon" aria-hidden="true" />
        <input
          id={id}
          aria-label={label}
          aria-describedby={helpId}
          type="text"
          maxLength={255}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
      </div>
      {open && matches.length > 0 && (
        <ul className="cv-university-dropdown" role="listbox">
          {matches.map((opt, idx) => (
            <li
              key={opt.name + idx}
              role="option"
              aria-selected={idx === activeIndex}
              className={`cv-university-option ${idx === activeIndex ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                selectOption(opt)
              }}
            >
              <div className="cv-university-option-header">
                <span className="cv-university-name">{opt.name}</span>
                {opt.code && <span className="cv-university-code-badge">{opt.code}</span>}
              </div>
              {opt.englishName && opt.englishName !== opt.name && (
                <small className="cv-university-english">{opt.englishName}</small>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CredentialUrlFieldHelper({
  value,
  onSelectPreset,
}: {
  value: string
  onSelectPreset: (prefix: string) => void
}) {
  const info = analyzeCredentialUrl(value)

  return (
    <div className="cv-credential-field-helper">
      <div
        className="cv-field-quick-suggestions cv-credential-presets"
        aria-label="Nền tảng chứng chỉ phổ biến"
      >
        <span className="cv-quick-suggestions-label">Nền tảng đối chiếu:</span>
        <div className="cv-quick-suggestions-list">
          {CREDENTIAL_PRESETS.map((preset) => {
            const isSelected =
              value.trim().toLowerCase().includes(preset.id) ||
              (preset.prefix.length > 8 &&
                value.trim().toLowerCase().startsWith(preset.prefix.toLowerCase()))
            return (
              <button
                key={preset.id}
                type="button"
                className={`cv-quick-suggestion-chip cv-credential-chip ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectPreset(preset.prefix)}
                title={`${preset.name}: ${preset.description}`}
              >
                {isSelected ? '✓ ' : '+ '}
                {preset.name}
              </button>
            )
          })}
        </div>
      </div>

      {value.trim() ? (
        info && (
          <div className={`cv-credential-status-box is-${info.badgeVariant}`} role="status">
            <div className="cv-credential-status-top">
              <span className={`cv-credential-badge-tag is-${info.badgeVariant}`}>
                {info.isTrusted ? '🛡️ ' : info.isCloudStorage ? '📁 ' : '🔗 '}
                {info.badgeLabel}
              </span>
              {info.isValidUrl && (
                <a
                  href={
                    info.url.startsWith('http://') || info.url.startsWith('https://')
                      ? info.url
                      : `https://${info.url}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="cv-credential-verify-action"
                >
                  Mở thử liên kết ↗
                </a>
              )}
            </div>
            <p className="cv-credential-status-text">{info.helperText}</p>
            {info.tip && <p className="cv-credential-status-tip">💡 {info.tip}</p>}
            {info.isTrusted && (
              <div className="cv-credential-ai-indicator">
                <span className="cv-credential-ai-indicator-dot" />
                <span>Sẵn sàng để hệ thống AI xác thực chứng chỉ với nhà tuyển dụng</span>
              </div>
            )}
          </div>
        )
      ) : (
        <p className="cv-quick-scores-hint">
          💡 Chọn một nền tảng ở trên để điền mẫu đường dẫn, hoặc dán trực tiếp liên kết chứng chỉ
          từ Credly, Coursera, HackerRank, Google...
        </p>
      )}
    </div>
  )
}

function RepeatableSection<T extends object>({
  title,
  items,
  empty,
  fields,
  onChange,
  optional = false,
  note,
  aiSection,
  universityOptions,
  sectionKey,
  issues = [],
  showValidation = false,
  skillOptions = [],
}: {
  title: string
  items: T[]
  empty: T
  fields: Field[]
  onChange: (items: T[]) => void
  optional?: boolean
  note?: string
  aiSection?: CvWritingSection
  universityOptions?: UniversityOption[]
  sectionKey: string
  issues?: CvIssue[]
  showValidation?: boolean
  skillOptions?: string[]
}) {
  const sectionId = useId()
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [entryKeys, setEntryKeys] = useState(() => items.map((_, index) => `${sectionId}-${index}`))
  const nextEntry = useRef(items.length)
  return (
    <section
      className="cv-builder-control-card cv-ai-section-anchor"
      id={`cv-${sectionKey}`}
      tabIndex={-1}
      onBlurCapture={(event) => {
        const id = (event.target as HTMLElement).id
        if (id) setTouched((current) => ({ ...current, [id]: true }))
      }}
    >
      <h2>{title}</h2>
      {note && <p className="cv-builder-field-note">{note}</p>}
      {optional && (
        <p className="cv-builder-field-note">
          Tùy chọn. Mục chưa điền có nhãn “Chưa cung cấp” trên bản xem trước.
        </p>
      )}
      {items.map((item, index) => (
        <fieldset className="cv-section-entry" key={entryKeys[index] ?? index}>
          <legend>
            {title} {index + 1}
          </legend>
          <div className="cv-builder-fields">
            {fields.map(({ key, label, type, help, placeholder, suggestions, choices }) => {
              const fieldId = `cv-${sectionKey}-${index}-${key}`
              const fieldError =
                showValidation || touched[fieldId]
                  ? issues.find((issue) => issue.field === `${sectionKey}-${index}-${key}`)?.message
                  : undefined
              const currentValue = String(item[key as keyof T] ?? '')
              const actualSuggestions =
                key === 'certification' && 'name' in item && typeof item.name === 'string'
                  ? getLanguageCertSuggestions(item.name)
                  : suggestions

              const activeCert =
                key === 'certification'
                  ? Object.keys(CERTIFICATE_SCORES).find((cert) =>
                      currentValue.trim().toUpperCase().startsWith(cert.toUpperCase()),
                    )
                  : undefined

              const handleSuggestion = (suggestion: string) => {
                let newVal = suggestion
                if (key === 'certification') {
                  const trimmed = currentValue.trim()
                  const knownPrefixes = Object.keys(CERTIFICATE_SCORES)
                  const matched = knownPrefixes.find((p) =>
                    trimmed.toUpperCase().startsWith(p.toUpperCase()),
                  )
                  if (matched && matched.toUpperCase() === suggestion.toUpperCase()) {
                    newVal = ''
                  } else if (matched) {
                    const rest = trimmed.slice(matched.length).trim()
                    const targetScores = CERTIFICATE_SCORES[suggestion] ?? []
                    const isCompatible = targetScores.some(
                      (s) => s.toUpperCase() === rest.toUpperCase(),
                    )
                    newVal = isCompatible && rest ? `${suggestion} ${rest}` : `${suggestion} `
                  } else if (trimmed) {
                    newVal = `${suggestion} ${trimmed}`
                  } else {
                    newVal = `${suggestion} `
                  }
                } else {
                  if (currentValue.trim().toLowerCase() === suggestion.toLowerCase()) {
                    newVal = ''
                  } else {
                    newVal = suggestion
                  }
                }
                onChange(
                  items.map((entry, i) => (i === index ? { ...entry, [key]: newVal } : entry)),
                )
              }

              const handleScore = (cert: string, score: string) => {
                const trimmed = currentValue.trim()
                const expectedFull = score.toUpperCase().startsWith(cert.toUpperCase())
                  ? score
                  : `${cert} ${score}`

                let newVal = expectedFull
                if (trimmed.toUpperCase() === expectedFull.toUpperCase()) {
                  newVal = `${cert} `
                }
                onChange(
                  items.map((entry, i) => (i === index ? { ...entry, [key]: newVal } : entry)),
                )
              }

              if (type === 'skills')
                return (
                  <div key={key} className="cv-wide-field">
                    <CvSkillsField
                      id={fieldId}
                      label={label}
                      skills={(item[key as keyof T] as string[] | undefined) ?? []}
                      options={skillOptions}
                      loading={false}
                      unavailable={false}
                      error={fieldError}
                      onChange={(value) =>
                        onChange(
                          items.map((entry, i) =>
                            i === index ? { ...entry, [key]: value } : entry,
                          ),
                        )
                      }
                    />
                  </div>
                )
              return (
                <div key={key}>
                  <label>
                    {label}
                    {type === 'select' ? (
                      <select
                        id={fieldId}
                        value={currentValue}
                        aria-invalid={!!fieldError}
                        aria-describedby={fieldError ? `${fieldId}-error` : undefined}
                        onChange={(e) =>
                          onChange(
                            items.map((entry, i) =>
                              i === index
                                ? {
                                    ...entry,
                                    [key]: e.target.value ? Number(e.target.value) : null,
                                  }
                                : entry,
                            ),
                          )
                        }
                      >
                        <option value="">Chọn thang điểm</option>
                        {choices?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : key === 'school' ? (
                      <SchoolCombobox
                        id={fieldId}
                        value={currentValue}
                        onChange={(val) =>
                          onChange(
                            items.map((entry, i) =>
                              i === index ? { ...entry, [key]: val } : entry,
                            ),
                          )
                        }
                        options={
                          universityOptions && universityOptions.length > 0
                            ? universityOptions
                            : DEFAULT_UNIVERSITIES
                        }
                        label={label}
                        placeholder={placeholder}
                        helpId={help ? `${sectionId}-${index}-${key}` : undefined}
                      />
                    ) : type === 'textarea' ? (
                      <textarea
                        id={fieldId}
                        aria-invalid={!!fieldError}
                        aria-label={label}
                        aria-describedby={help ? `${sectionId}-${index}-${key}` : undefined}
                        rows={3}
                        maxLength={6000}
                        placeholder={placeholder}
                        value={currentValue}
                        onChange={(e) =>
                          onChange(
                            items.map((entry, i) =>
                              i === index ? { ...entry, [key]: e.target.value } : entry,
                            ),
                          )
                        }
                      />
                    ) : (
                      <input
                        id={fieldId}
                        aria-invalid={!!fieldError}
                        min={type === 'number' ? 0 : undefined}
                        step={type === 'number' ? '0.01' : undefined}
                        aria-label={label}
                        aria-describedby={help ? `${sectionId}-${index}-${key}` : undefined}
                        type={type ?? 'text'}
                        maxLength={type === 'url' ? 2048 : 255}
                        placeholder={placeholder}
                        disabled={key === 'endDate' && 'current' in item && item.current === true}
                        value={currentValue}
                        onInput={(e) => {
                          if (type === 'month')
                            onChange(
                              items.map((entry, i) =>
                                i === index ? { ...entry, [key]: e.currentTarget.value } : entry,
                              ),
                            )
                        }}
                        onChange={(e) =>
                          onChange(
                            items.map((entry, i) =>
                              i === index
                                ? {
                                    ...entry,
                                    [key]:
                                      type === 'number'
                                        ? e.target.value === ''
                                          ? null
                                          : Number(e.target.value)
                                        : e.target.value,
                                  }
                                : entry,
                            ),
                          )
                        }
                      />
                    )}
                    {help && (
                      <small id={`${sectionId}-${index}-${key}`} className="cv-field-help">
                        {help}
                      </small>
                    )}
                  </label>
                  {fieldError && (
                    <p id={`${fieldId}-error`} className="cv-field-error" role="alert">
                      {fieldError}
                    </p>
                  )}
                  {actualSuggestions && actualSuggestions.length > 0 && (
                    <div className="cv-field-quick-suggestions" aria-label={`Gợi ý cho ${label}`}>
                      <span className="cv-quick-suggestions-label">
                        {key === 'certification' ? 'Chứng chỉ:' : 'Gợi ý nhanh:'}
                      </span>
                      <div className="cv-quick-suggestions-list">
                        {actualSuggestions.map((suggestion) => {
                          const isSelected =
                            key === 'certification'
                              ? currentValue
                                  .trim()
                                  .toUpperCase()
                                  .startsWith(suggestion.toUpperCase())
                              : currentValue.trim().toLowerCase() === suggestion.toLowerCase()
                          return (
                            <button
                              key={suggestion}
                              type="button"
                              className={`cv-quick-suggestion-chip ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => handleSuggestion(suggestion)}
                              title={`Chọn ${suggestion}`}
                            >
                              {isSelected ? '✓ ' : '+ '}
                              {suggestion}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {key === 'certification' &&
                    (activeCert && CERTIFICATE_SCORES[activeCert] ? (
                      <div
                        className="cv-field-quick-suggestions cv-field-quick-scores"
                        aria-label={`Mức điểm cho ${activeCert}`}
                      >
                        <span className="cv-quick-suggestions-label">
                          Điểm / Cấp độ {activeCert}:
                        </span>
                        <div className="cv-quick-suggestions-list">
                          {CERTIFICATE_SCORES[activeCert].map((score) => {
                            const expectedFull = score
                              .toUpperCase()
                              .startsWith(activeCert.toUpperCase())
                              ? score
                              : `${activeCert} ${score}`
                            const isScoreSelected =
                              currentValue.trim().toUpperCase() === expectedFull.toUpperCase()
                            return (
                              <button
                                key={score}
                                type="button"
                                className={`cv-quick-suggestion-chip cv-score-chip ${isScoreSelected ? 'is-selected' : ''}`}
                                onClick={() => handleScore(activeCert, score)}
                                title={`Chọn mức điểm ${expectedFull}`}
                              >
                                {isScoreSelected ? '✓ ' : '+ '}
                                {score}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="cv-quick-scores-hint">
                        💡 Chọn một chứng chỉ ở trên (IELTS, TOEIC...) để hiển thị các nút chọn
                        nhanh mức điểm hoặc cấp độ.
                      </p>
                    ))}
                  {sectionKey === 'certifications' && key === 'credentialUrl' && (
                    <CredentialUrlFieldHelper
                      value={currentValue}
                      onSelectPreset={(prefix) => {
                        onChange(
                          items.map((entry, i) =>
                            i === index ? { ...entry, [key]: prefix } : entry,
                          ),
                        )
                      }}
                    />
                  )}
                  {aiSection && key === 'description' && (
                    <CvWritingAssistant
                      section={aiSection}
                      value={String(item[key as keyof T] ?? '')}
                      context={['company', 'position', 'name', 'role']
                        .map((field) => String(item[field as keyof T] ?? ''))
                        .filter(Boolean)
                        .join(' · ')
                        .slice(0, 1000)}
                      onApply={(text) =>
                        onChange(
                          items.map((entry, i) =>
                            i === index ? { ...entry, [key]: text } : entry,
                          ),
                        )
                      }
                    />
                  )}
                </div>
              )
            })}
            {('current' in item || title === 'Dự án') && (
              <label className="cv-current-job">
                <input
                  type="checkbox"
                  checked={'current' in item && item.current === true}
                  onChange={(e) =>
                    onChange(
                      items.map((entry, i) =>
                        i === index
                          ? {
                              ...entry,
                              current: e.target.checked,
                              ...(e.target.checked ? { endDate: '' } : {}),
                            }
                          : entry,
                      ),
                    )
                  }
                />
                {title === 'Hoạt động'
                  ? 'Đang tham gia'
                  : title === 'Dự án'
                    ? 'Đang thực hiện'
                    : 'Đang làm tại đây'}
              </label>
            )}
          </div>
          <button
            type="button"
            className="text-button cv-remove-entry"
            aria-label={`Xóa ${title.toLowerCase()} ${index + 1}`}
            onClick={() => {
              setEntryKeys(entryKeys.filter((_, i) => i !== index))
              onChange(items.filter((_, i) => i !== index))
            }}
          >
            <Trash2 size={14} />
            Xóa mục này
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button secondary small"
        disabled={items.length >= 30}
        onClick={() => {
          setEntryKeys([...entryKeys, `${sectionId}-${nextEntry.current++}`])
          onChange([...items, { ...empty }])
        }}
      >
        <Plus size={15} />
        Thêm {title.toLowerCase()}
      </button>
    </section>
  )
}

export function CvBuilderPage() {
  const [params, setParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [createdResume, setCreatedResume] = useState<Resume | null>(null)
  const id = params.get('id')
  const jobId = params.get('jobId')
  return (
    <CvBuilderEditor
      key={`${id ?? 'new'}:${jobId ?? ''}:${params.get('documentId') ?? ''}`}
      id={id}
      documentId={params.get('documentId')}
      startImport={params.get('import') === 'pdf'}
      jobId={jobId}
      returnToMatch={params.get('returnTo') === 'match'}
      initialResume={createdResume?.id === id ? createdResume : null}
      step={step}
      onStepChange={setStep}
      onCreated={(resume) => {
        setCreatedResume(resume)
        setParams({ id: resume.id, ...(jobId ? { jobId } : {}) }, { replace: true })
      }}
    />
  )
}

function CvBuilderEditor({
  documentId,
  startImport,
  id,
  jobId,
  initialResume,
  returnToMatch,
  onCreated,
  step,
  onStepChange,
}: {
  documentId: string | null
  startImport: boolean
  id: string | null
  jobId: string | null
  initialResume: Resume | null
  returnToMatch: boolean
  step: number
  onStepChange: (step: number) => void
  onCreated: (resume: Resume) => void
}) {
  const [draft, setDraft] = useState<ResumeInput>(initialResume ?? emptyDraft)
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit')
  const mobileAnchor = useRef<HTMLDivElement>(null)
  const paneId = useId()
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const goToStep = (next: number, target?: string) => {
    onStepChange(next)
    setMobilePane('edit')
    requestAnimationFrame(() => {
      const element = target
        ? (document.getElementById(target) ??
          document.getElementById(target.replace(/-\d+-[^-]+$/, '')))
        : stepHeading.current
      element?.scrollIntoView({ block: 'start', behavior: 'instant' })
      ;(element?.matches('input, textarea, select, button')
        ? element
        : (element?.querySelector<HTMLElement>('input, textarea, select, button') ??
          element ??
          stepHeading.current)
      )?.focus({ preventScroll: true })
    })
  }
  const changeMobilePane = (pane: 'edit' | 'preview') => {
    setMobilePane(pane)
    requestAnimationFrame(() => mobileAnchor.current?.scrollIntoView({ block: 'start' }))
  }
  const [loading, setLoading] = useState(!initialResume)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(
    initialResume
      ? initialResume.status === 'READY'
        ? returnToMatch
          ? 'Đã lưu CV mới. Quay lại đối chiếu để đánh giá phiên bản vừa hoàn thiện.'
          : 'Đã hoàn tất và lưu CV. Bạn có thể mở lại trong CV của tôi.'
        : 'Đã lưu bản nháp CV. Bạn có thể mở lại trong CV của tôi.'
      : '',
  )
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [finishReviewRequired, setFinishReviewRequired] = useState(false)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const validationIssues = validateCv(draft)
  const qualityHints = cvQualityHints(draft)
  const draftRef = useRef(draft)
  useEffect(() => {
    draftRef.current = draft
  }, [draft])
  const [skillSyncNotice, setSkillSyncNotice] = useState('')
  const [retry, setRetry] = useState(0)
  const [updatedAt, setUpdatedAt] = useState(initialResume?.updatedAt ?? '')
  const [positionOptions, setPositionOptions] = useState<string[]>([])
  const [positionsLoading, setPositionsLoading] = useState(true)
  const [positionsUnavailable, setPositionsUnavailable] = useState(false)
  const [skillOptions, setSkillOptions] = useState<string[]>(DEFAULT_SKILLS)
  const [skillsLoading, setSkillsLoading] = useState(true)
  const [skillsUnavailable, setSkillsUnavailable] = useState(false)
  const [universityOptions, setUniversityOptions] =
    useState<UniversityOption[]>(DEFAULT_UNIVERSITIES)
  const [targetJob, setTargetJob] = useState<{
    title: string
    position: string
    skills: string[]
  } | null>(null)
  const [jobUnavailable, setJobUnavailable] = useState(false)
  const [syncingProfile, setSyncingProfile] = useState(false)
  const [syncNotice, setSyncNotice] = useState<{
    message: string
    type: 'success' | 'error'
  } | null>(null)
  const [showPdfImport, setShowPdfImport] = useState(startImport)

  const fillFromProfile = async () => {
    if (syncingProfile) return
    setSyncingProfile(true)
    setSyncNotice(null)
    try {
      const profile = await getProfile()
      const profileSkillResult = mergeSkills([], profileSkillNames(profile.skills))
      const profileSkills = profileSkillResult.skills
      setDraft((current) => ({
        ...current,
        fullName: profile.fullName || current.fullName,
        email: profile.email || current.email,
        phone: profile.phone ?? current.phone,
        location: profile.location ?? current.location,
        desiredPosition: current.desiredPosition?.trim()
          ? current.desiredPosition
          : (profile.desiredPosition ?? current.desiredPosition),
        skills: current.skills.length > 0 ? current.skills : profileSkills,
      }))
      setDirty(true)
      setReviewConfirmed(false)
      setNotice('')
      if (profileSkillResult.tooLong || profileSkillResult.overflow)
        setSkillSyncNotice(
          'Một số kỹ năng trong hồ sơ vượt giới hạn và chưa được thêm. Hãy kiểm tra lại mục kỹ năng.',
        )
      setSyncNotice({ message: 'Đã điền thông tin từ hồ sơ cá nhân.', type: 'success' })
    } catch (err) {
      setSyncNotice({
        message: err instanceof Error ? err.message : 'Chưa thể lấy thông tin từ hồ sơ cá nhân.',
        type: 'error',
      })
    } finally {
      setSyncingProfile(false)
    }
  }

  const syncSkillsFromProfile = async () => {
    if (syncingProfile) return
    setSyncingProfile(true)
    setSkillSyncNotice('')
    try {
      const profile = await getProfile()
      const existing = draftRef.current.skills
      const result = mergeSkills(existing, profileSkillNames(profile.skills))
      const added = result.skills.length - mergeSkills([], existing).skills.length
      update('skills', result.skills)
      setSkillSyncNotice(
        `${added > 0 ? `Đã thêm ${added} kỹ năng từ hồ sơ.` : 'Không có kỹ năng mới trong hồ sơ.'}${result.tooLong ? ` ${result.tooLong} mục dài quá 100 ký tự chưa được thêm.` : ''}${result.overflow ? ` ${result.overflow} mục vượt giới hạn 100 kỹ năng chưa được thêm.` : ''}`,
      )
    } catch (err) {
      setSkillSyncNotice(
        err instanceof Error ? err.message : 'Chưa lấy được kỹ năng từ hồ sơ. Vui lòng thử lại.',
      )
    } finally {
      setSyncingProfile(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.allSettled([
      getResumePositionOptions(),
      getResumeSkillOptions(),
      getResumeUniversityOptions(),
    ])
      .then(([positions, skillsRes, universitiesRes]) => {
        if (!active) return
        if (positions.status === 'fulfilled') setPositionOptions(positions.value)
        else setPositionsUnavailable(true)
        if (skillsRes.status === 'fulfilled' && skillsRes.value?.length > 0) {
          setSkillOptions(skillsRes.value)
        } else if (skillsRes.status === 'rejected') {
          setSkillsUnavailable(true)
        }
        if (universitiesRes.status === 'fulfilled' && universitiesRes.value?.length > 0) {
          setUniversityOptions(universitiesRes.value)
        }
      })
      .finally(() => {
        if (active) {
          setPositionsLoading(false)
          setSkillsLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = async () => {
      const [data, job] = await Promise.allSettled([
        initialResume && retry === 0
          ? Promise.resolve(initialResume)
          : id
            ? getResume(id)
            : documentId
              ? getCvDocument(documentId)
              : getProfile(),
        jobId ? getJobById(jobId) : Promise.resolve(null),
      ])
      if (!active) return
      const selectedJob = job.status === 'fulfilled' ? job.value : null
      const position = selectedJob?.positionName?.trim() || selectedJob?.title || ''
      setTargetJob(
        selectedJob
          ? { title: selectedJob.title, position, skills: selectedJob.skills ?? [] }
          : null,
      )
      setJobUnavailable(!!jobId && !selectedJob)
      if (data.status === 'rejected') throw data.reason
      // A just-created CV is already editable. Late job metadata must not overwrite edits.
      if (initialResume && retry === 0) return
      if (documentId && !id) {
        const document = data.value as Awaited<ReturnType<typeof getCvDocument>>
        if (!document.parsed || document.status !== 'PARSED')
          throw new Error('PDF chưa được xử lý. Hãy mở Nhập từ PDF để tiếp tục.')
        setDraft(importedDraft(document))
        setNotice(
          'CV mới từ PDF. Hãy đối chiếu bản gốc, sửa các trường và lưu khi đã kiểm tra. CV cũ vẫn được giữ riêng.',
        )
        setDirty(true)
        setLoading(false)
        return
      }
      if (id) {
        const saved = data.value as Resume
        setDraft(saved)
        setUpdatedAt(saved.updatedAt)
      } else {
        const profile = data.value as Awaited<ReturnType<typeof getProfile>>
        const skillResult = mergeSkills([], profileSkillNames(profile.skills))
        const profileSkills = skillResult.skills
        if (skillResult.tooLong || skillResult.overflow)
          setSkillSyncNotice(
            'Một số kỹ năng trong hồ sơ vượt giới hạn và chưa được thêm. Hãy kiểm tra trước khi lưu.',
          )
        setDraft({
          ...emptyDraft,
          fullName: profile.fullName,
          email: profile.email,
          phone: profile.phone ?? '',
          location: profile.location ?? '',
          desiredPosition: position || profile.desiredPosition || '',
          skills: profileSkills,
        })
        setUpdatedAt('')
      }
      setDirty(false)
      setLoading(false)
    }
    load().catch((error) => {
      if (active) {
        setLoadError(error instanceof Error ? error.message : 'Chưa thể tải CV.')
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [id, jobId, documentId, initialResume, retry])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const update = <K extends keyof ResumeInput>(key: K, value: ResumeInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setDirty(true)
    setNotice('')
    setError('')
    setSyncNotice(null)
    setReviewConfirmed(false)
  }
  const skills = draft.skills
  const save = async (status: ResumeInput['status']) => {
    if (saving.current || loading || loadError || syncingProfile) return
    if (!draft.title.trim()) {
      goToStep(0, 'cv-title')
      setError('Hãy đặt tên bản CV trước khi lưu.')
      return
    }
    if (
      status === 'READY' &&
      (!draft.fullName?.trim() || !draft.email?.trim() || !draft.desiredPosition?.trim())
    ) {
      goToStep(
        0,
        !draft.fullName?.trim()
          ? 'cv-fullName'
          : !draft.email?.trim()
            ? 'cv-email'
            : 'cv-desiredPosition',
      )
      setError(
        'Để hoàn tất CV, hãy điền họ tên, email và vị trí ứng tuyển. Bạn vẫn có thể lưu bản nháp.',
      )
      return
    }
    setShowValidation(true)
    if (validationIssues.length) {
      const first = validationIssues[0]
      goToStep(first.step, `cv-${first.field}`)
      setError(first.message)
      return
    }
    if (status === 'READY' && qualityHints.length && !reviewConfirmed) {
      setFinishReviewRequired(true)
      goToStep(3, 'cv-final-review')
      return
    }
    saving.current = true
    setBusy(true)
    setError('')
    setNotice('')
    // Project only editable fields; ownership/default/timestamps come from the server.
    const {
      title,
      fullName,
      email,
      phone,
      location,
      desiredPosition,
      summary,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      experiences,
      educations,
      projects,
      certifications,
      languages,
      awards,
      activities,
      version,
    } = draft
    const input: ResumeInput = {
      title: title.trim(),
      fullName: fullName?.trim() ?? '',
      email: email?.trim() ?? '',
      phone: phone?.trim() ?? '',
      location: location?.trim() ?? '',
      desiredPosition: desiredPosition?.trim() ?? '',
      summary: summary?.trim() ?? '',
      githubUrl: githubUrl?.trim() ?? '',
      linkedinUrl: linkedinUrl?.trim() ?? '',
      portfolioUrl: portfolioUrl?.trim() ?? '',
      experiences: experiences.filter(hasResumeEntryContent),
      educations: educations.filter(hasResumeEntryContent),
      projects: projects.filter(hasResumeEntryContent),
      certifications: certifications.filter(hasResumeEntryContent),
      languages: languages.filter(hasResumeEntryContent),
      awards: awards.filter(hasResumeEntryContent),
      activities: activities.filter(hasResumeEntryContent),
      version,
      sourceDocumentId: draft.sourceDocumentId,
      extraSections: draft.extraSections ?? [],
      skills: mergeSkills([], skills).skills,
      template: 'modern',
      status,
    }
    try {
      const saved = id ? await saveResume(id, input) : await createResume(input)
      setDraft(saved)
      setUpdatedAt(saved.updatedAt)
      setDirty(false)
      setFinishReviewRequired(false)
      setReviewConfirmed(false)
      if (!id) onCreated(saved)
      setNotice(
        status === 'READY'
          ? returnToMatch
            ? 'Đã lưu CV mới. Quay lại đối chiếu để đánh giá phiên bản vừa hoàn thiện.'
            : 'Đã hoàn tất và lưu CV. Bạn có thể mở lại trong CV của tôi.'
          : 'Đã lưu bản nháp CV. Bạn có thể mở lại trong CV của tôi.',
      )
    } catch (error) {
      setError(
        error instanceof ApiError
          ? `${error.message}${
              error.errors?.length
                ? ' ' +
                  error.errors
                    .map((item) => item.message)
                    .slice(0, 3)
                    .join(' ')
                : ''
            }`
          : 'Chưa thể lưu CV. Vui lòng thử lại.',
      )
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  const scalarFields: {
    key:
      | 'fullName'
      | 'desiredPosition'
      | 'email'
      | 'phone'
      | 'location'
      | 'summary'
      | 'githubUrl'
      | 'linkedinUrl'
      | 'portfolioUrl'
    label: string
    type?: string
    max?: number
  }[] = [
    { key: 'fullName', label: 'Họ và tên', max: 150 },
    { key: 'desiredPosition', label: jobId ? 'Vị trí ứng tuyển' : 'Vị trí mong muốn' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Số điện thoại', type: 'tel', max: 30 },
    { key: 'location', label: 'Nơi ở' },
    { key: 'githubUrl', label: 'GitHub', type: 'url', max: 2048 },
    { key: 'linkedinUrl', label: 'LinkedIn', type: 'url', max: 2048 },
    { key: 'portfolioUrl', label: 'Portfolio', type: 'url', max: 2048 },
    { key: 'summary', label: 'Giới thiệu / Mục tiêu nghề nghiệp', type: 'textarea', max: 6000 },
  ]
  const renderFields = (group: 'basic' | 'links' | 'summary') => (
    <>
      {scalarFields
        .filter(({ key }) =>
          group === 'summary'
            ? key === 'summary'
            : group === 'links'
              ? key.endsWith('Url')
              : key !== 'summary' && !key.endsWith('Url'),
        )
        .map(({ key, label, type, max }) =>
          key === 'desiredPosition' ? (
            <CvPositionField
              key={key}
              value={draft.desiredPosition ?? ''}
              onChange={(value) => update('desiredPosition', value)}
              options={positionOptions}
              loading={positionsLoading}
              unavailable={positionsUnavailable}
              jobId={jobId}
              jobTitle={targetJob?.title ?? ''}
              targetPosition={targetJob?.position ?? ''}
              jobUnavailable={jobUnavailable}
            />
          ) : (
            <div
              key={key}
              className="cv-ai-section-anchor"
              onBlur={() => setTouchedFields((current) => ({ ...current, [key]: true }))}
            >
              <label>
                <span className="cv-field-label">
                  {label}
                  {['fullName', 'email', 'desiredPosition'].includes(key) && (
                    <small className="cv-required">Cần khi hoàn tất</small>
                  )}
                </span>
                {type === 'textarea' ? (
                  <textarea
                    id={`cv-${key}`}
                    placeholder="Ví dụ: Tôi là sinh viên CNTT, đã làm dự án React và mong muốn ứng tuyển Frontend Intern."
                    rows={4}
                    maxLength={max}
                    value={draft[key] ?? ''}
                    onChange={(e) => update(key, e.target.value)}
                  />
                ) : (
                  <input
                    id={`cv-${key}`}
                    type={type ?? 'text'}
                    maxLength={max ?? 255}
                    value={draft[key] ?? ''}
                    placeholder={type === 'url' ? 'https://…' : undefined}
                    onChange={(e) => update(key, e.target.value)}
                  />
                )}
              </label>
              {(showValidation || touchedFields[key]) &&
                validationIssues
                  .filter((issue) => issue.field === key)
                  .map((issue) => (
                    <p className="cv-field-error" role="alert" key={issue.field}>
                      {issue.message}
                    </p>
                  ))}
              {key === 'summary' && (
                <CvWritingAssistant
                  section="summary"
                  value={draft.summary ?? ''}
                  context={(draft.desiredPosition ?? '').slice(0, 1000)}
                  onApply={(text) => update('summary', text)}
                />
              )}
            </div>
          ),
        )}
    </>
  )
  const missingRequired = [
    { label: 'Tên bản CV', value: draft.title, target: 'cv-title' },
    { label: 'Họ và tên', value: draft.fullName, target: 'cv-fullName' },
    { label: 'Email', value: draft.email, target: 'cv-email' },
    {
      label: jobId ? 'Vị trí ứng tuyển' : 'Vị trí mong muốn',
      value: draft.desiredPosition,
      target: 'cv-desiredPosition',
    },
  ].filter((field) => !field.value?.trim())
  return (
    <div className="cv-builder-surface">
      <div className="container cv-builder-page">
        <div className="cv-builder-toolbar">
          <div>
            <Link
              to={
                jobId
                  ? returnToMatch
                    ? jobMatchPath(jobId, id ?? undefined)
                    : jobApplicationPath(jobId)
                  : '/profile?tab=cv'
              }
              onClick={(e) => {
                if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Rời trang?'))
                  e.preventDefault()
              }}
            >
              <ArrowLeft size={15} />
              {jobId
                ? returnToMatch
                  ? 'Quay lại đối chiếu CV–job'
                  : 'Quay lại công việc'
                : 'CV của tôi'}
            </Link>
            <h1>{id ? 'Chỉnh sửa CV' : 'Tạo CV của bạn'}</h1>
            <p>Từng bước kể câu chuyện của bạn. Xem CV thay đổi ngay khi nhập.</p>
          </div>
          <div className="cv-builder-actions">
            {returnToMatch && jobId && id && !dirty && draft.status === 'READY' && !loading && (
              <Link className="button secondary" to={jobMatchPath(jobId, id)}>
                Đối chiếu CV đã lưu
                <ArrowRight size={15} />
              </Link>
            )}
            <button
              type="button"
              className="button cv-pdf-import-button"
              disabled={loading || busy}
              onClick={() => setShowPdfImport(true)}
            >
              <Sparkles size={16} /> Nhập từ PDF vào CV mới
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={loading || !!loadError || busy || syncingProfile || !draft.title.trim()}
              onClick={() => void save('DRAFT')}
            >
              <Save size={16} />
              {busy ? 'Đang lưu…' : 'Lưu bản nháp'}
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={loading || !!loadError || busy || !draft.fullName?.trim()}
              title="Xuất nội dung đang xem. Hãy lưu CV trước để giữ thay đổi trong tài khoản."
              onClick={() => window.print()}
            >
              <Printer size={16} />
              In / Lưu PDF
            </button>
            <button
              type="button"
              className="button secondary cv-view-toggle-button"
              onClick={() => {
                if (window.innerWidth <= 1100) {
                  changeMobilePane(mobilePane === 'preview' ? 'edit' : 'preview')
                } else {
                  document
                    .getElementById(`${paneId}-preview`)
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              title="Xem trước định dạng CV hoàn chỉnh"
            >
              <Eye size={16} />
              {mobilePane === 'preview' ? 'Sửa form' : 'Xem trước CV'}
            </button>
          </div>
        </div>
        {showPdfImport && <CvPdfImport jobId={jobId} onClose={() => setShowPdfImport(false)} />}
        {draft.sourceDocumentId && (
          <section className="cv-source-note">
            <strong>CV này được nhập từ PDF</strong>
            <p>
              Đối chiếu tên, thông tin liên hệ, thời gian và các mục bổ sung trước khi hoàn tất.
              Chỉnh sửa trong form không thay đổi PDF gốc.
            </p>
            <details>
              <summary>Xem PDF gốc để đối chiếu</summary>
              <a href={cvDocumentUrl(draft.sourceDocumentId)} target="_blank" rel="noreferrer">
                Mở PDF gốc trong tab mới
              </a>
              <PdfDocumentViewer
                title="PDF gốc của CV"
                url={cvDocumentUrl(draft.sourceDocumentId)}
              />
            </details>
          </section>
        )}
        {loading ? (
          <p role="status">Đang tải thông tin CV…</p>
        ) : loadError ? (
          <div className="cv-builder-error">
            <p role="alert">{loadError}</p>
            <button
              className="button secondary"
              onClick={() => {
                setLoading(true)
                setLoadError('')
                setRetry(retry + 1)
              }}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <>
            <div className="cv-save-status" role="status">
              {notice ||
                (dirty
                  ? 'Có thay đổi chưa lưu. Bấm Lưu bản nháp để giữ lại.'
                  : updatedAt
                    ? `Đã lưu · ${new Date(updatedAt).toLocaleString('vi-VN')}`
                    : 'CV mới · Chưa lưu')}
              <span>{draft.status === 'READY' ? 'Hoàn tất' : 'Bản nháp'}</span>
            </div>
            {error && (
              <p className="form-error cv-save-error" role="alert">
                {error}
              </p>
            )}
            <CvReviewAssistant
              draft={draft}
              jobId={jobId}
              jobTitle={targetJob?.title}
              disabled={busy || syncingProfile}
              onOpenField={goToStep}
              validationIssue={validationIssues[0]}
              onApply={(target, text, expected) => {
                if (
                  saving.current ||
                  syncingProfile ||
                  reviewFingerprint(cvReviewContext(draftRef.current), jobId) !==
                    reviewFingerprint(expected, jobId)
                )
                  return false
                setDraft((current) =>
                  reviewFingerprint(cvReviewContext(current), jobId) ===
                  reviewFingerprint(expected, jobId)
                    ? withReviewText(current, target, text)
                    : current,
                )
                setDirty(true)
                setNotice('')
                setError('')
                setReviewConfirmed(false)
                return true
              }}
            />
            <nav className="cv-stepper" aria-label="Các bước tạo CV">
              <ol>
                {cvSteps.map((item, index) => (
                  <li key={item.title}>
                    <button
                      type="button"
                      aria-label={`Bước ${index + 1}: ${item.title}`}
                      aria-current={step === index ? 'step' : undefined}
                      aria-controls={`${paneId}-step-${index}`}
                      disabled={busy}
                      onClick={() => goToStep(index)}
                    >
                      <span className="cv-step-number">{String(index + 1).padStart(2, '0')}</span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.short}</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="cv-mobile-anchor" ref={mobileAnchor} />
            <div className="cv-mobile-switch" role="group" aria-label="Chế độ xem CV">
              <button
                type="button"
                aria-pressed={mobilePane === 'edit'}
                aria-controls={`${paneId}-edit`}
                onClick={() => changeMobilePane('edit')}
              >
                Chỉnh sửa
              </button>
              <button
                type="button"
                aria-pressed={mobilePane === 'preview'}
                aria-controls={`${paneId}-preview`}
                onClick={() => changeMobilePane('preview')}
              >
                Xem trước
              </button>
            </div>
            <div className={`cv-builder-columns mobile-${mobilePane}`}>
              <fieldset
                id={`${paneId}-edit`}
                className="cv-builder-controls cv-controls-fieldset"
                disabled={busy}
                aria-label="Chỉnh sửa nội dung CV"
              >
                <header className="cv-step-heading">
                  <span>
                    BƯỚC {step + 1} / {cvSteps.length}
                  </span>
                  <h2 ref={stepHeading} tabIndex={-1}>
                    {cvSteps[step].title}
                  </h2>
                  <p>{cvSteps[step].description}</p>
                </header>
                <div className="cv-step-panel" id={`${paneId}-step-0`} hidden={step !== 0}>
                  <section className="cv-builder-control-card">
                    <h2>
                      <FileText size={17} />
                      Tên bản CV
                    </h2>
                    <div className="cv-builder-fields">
                      <label>
                        Tên bản CV
                        <input
                          id="cv-title"
                          maxLength={100}
                          value={draft.title}
                          onChange={(e) => update('title', e.target.value)}
                          placeholder="Ví dụ: CV Backend Java"
                        />
                      </label>
                    </div>
                    <p className="cv-builder-field-note">
                      Đặt tên để dễ tìm lại, ví dụ “CV Frontend Intern”. Tên này không xuất hiện
                      trên CV.
                    </p>
                  </section>
                  <section className="cv-builder-control-card">
                    <div className="cv-card-header-row">
                      <h2>Thông tin liên hệ</h2>
                      <button
                        type="button"
                        className="cv-fill-profile-btn"
                        onClick={() => void fillFromProfile()}
                        disabled={syncingProfile}
                        title="Điền lại họ tên, email, số điện thoại, khu vực từ hồ sơ cá nhân"
                      >
                        <RefreshCw size={13} className={syncingProfile ? 'cv-spin' : undefined} />
                        {syncingProfile ? 'Đang lấy thông tin…' : 'Lấy từ hồ sơ cá nhân'}
                      </button>
                    </div>
                    <p className="cv-builder-field-note">
                      Được điền sẵn từ hồ sơ cá nhân. Bạn có thể chỉnh riêng cho bản CV này.
                    </p>
                    {syncNotice && (
                      <p
                        className={`cv-field-sync-notice ${syncNotice.type === 'error' ? 'error' : 'success'}`}
                        role="status"
                      >
                        {syncNotice.type === 'error' ? (
                          <AlertCircle size={13} />
                        ) : (
                          <Check size={13} />
                        )}
                        {syncNotice.message}
                      </p>
                    )}
                    <div className="cv-builder-fields cv-contact-fields">
                      {renderFields('basic')}
                    </div>
                    <details
                      className="cv-personal-links"
                      open={
                        !!(draft.githubUrl || draft.linkedinUrl || draft.portfolioUrl) || undefined
                      }
                    >
                      <summary>
                        Liên kết cá nhân <span>Tùy chọn</span>
                      </summary>
                      <div className="cv-builder-fields">{renderFields('links')}</div>
                    </details>
                  </section>
                </div>
                <div className="cv-step-panel" id={`${paneId}-step-1`} hidden={step !== 1}>
                  <div className="cv-step-ai-note">
                    <Sparkles size={19} />
                    <p>
                      <strong>AI giúp bạn diễn đạt.</strong> Nhập vài ý thật, rồi nhấn “AI hỗ trợ”
                      ngay dưới ô giới thiệu.
                    </p>
                  </div>
                  <section className="cv-builder-control-card">
                    <h2>Giới thiệu bản thân</h2>
                    <div className="cv-builder-fields">{renderFields('summary')}</div>
                  </section>
                  <section className="cv-builder-control-card">
                    <h2>Kỹ năng chuyên môn</h2>
                    <p className="cv-builder-field-note">
                      Ưu tiên kỹ năng liên quan đến vị trí và bạn có thể giải thích bằng kinh nghiệm
                      thực tế.
                    </p>
                    <div className="cv-builder-fields">
                      <CvSkillsField
                        skills={draft.skills}
                        onChange={(skills) => update('skills', skills)}
                        options={skillOptions}
                        loading={skillsLoading}
                        unavailable={skillsUnavailable}
                        jobSkills={targetJob?.skills}
                        onSyncProfile={syncSkillsFromProfile}
                        syncingProfile={syncingProfile}
                        error={
                          showValidation
                            ? validationIssues.find((issue) => issue.field === 'skills')?.message
                            : undefined
                        }
                      />
                      {skillSyncNotice && (
                        <p className="cv-field-sync-notice" role="status">
                          {skillSyncNotice}
                        </p>
                      )}
                    </div>
                  </section>
                  <RepeatableSection
                    title="Ngoại ngữ"
                    key={`languages:${draft.version}`}
                    sectionKey="languages"
                    issues={validationIssues}
                    showValidation={showValidation}
                    items={draft.languages}
                    empty={emptyLanguage}
                    optional
                    onChange={(value) => update('languages', value)}
                    fields={[
                      {
                        key: 'name',
                        label: 'Ngôn ngữ',
                        placeholder: 'Ví dụ: Tiếng Anh, Tiếng Nhật, Tiếng Hàn...',
                        suggestions: [
                          'Tiếng Anh',
                          'Tiếng Nhật',
                          'Tiếng Trung',
                          'Tiếng Hàn',
                          'Tiếng Pháp',
                          'Tiếng Đức',
                        ],
                      },
                      {
                        key: 'proficiency',
                        label: 'Trình độ',
                        placeholder: 'Ví dụ: Giao tiếp trong công việc, B2, Thành thạo...',
                        suggestions: [
                          'Giao tiếp cơ bản',
                          'Giao tiếp công việc',
                          'Thành thạo / Lưu loát',
                          'Bản ngữ',
                        ],
                      },
                      {
                        key: 'certification',
                        label: 'Chứng chỉ / Điểm số',
                        placeholder: 'Ví dụ: IELTS 6.5, TOEIC 800, JLPT N3, HSK 4…',
                        help: 'Điền điểm thi ngoại ngữ (IELTS, TOEIC, JLPT, HSK...). Chọn nhanh tiền tố bên dưới và nhập số điểm.',
                        suggestions: ['IELTS', 'TOEIC', 'VSTEP', 'TOEFL', 'JLPT', 'TOPIK', 'HSK'],
                      },
                    ]}
                  />
                </div>
                <div className="cv-step-panel" id={`${paneId}-step-2`} hidden={step !== 2}>
                  <div className="cv-step-ai-note">
                    <Sparkles size={19} />
                    <p>
                      <strong>Chưa có kinh nghiệm làm việc? Không sao.</strong> Bạn có thể thêm học
                      vấn và dự án học tập. AI hỗ trợ diễn đạt phần mô tả sau khi bạn thêm kinh
                      nghiệm hoặc dự án.
                    </p>
                  </div>
                  <RepeatableSection
                    title="Học vấn"
                    key={`educations:${draft.version}`}
                    sectionKey="educations"
                    issues={validationIssues}
                    showValidation={showValidation}
                    items={draft.educations}
                    empty={emptyEducation}
                    universityOptions={universityOptions}
                    onChange={(value) => update('educations', value)}
                    fields={[
                      {
                        key: 'school',
                        label: 'Trường học',
                        placeholder: 'Ví dụ: Đại học Bách khoa Hà Nội, Đại học FPT...',
                        help: 'Gõ tên trường hoặc viết tắt (HUST, UIT, FPT, NEU...) để chọn nhanh từ danh mục.',
                      },
                      {
                        key: 'degree',
                        label: 'Bằng cấp',
                        placeholder: 'Ví dụ: Kỹ sư, Cử nhân...',
                        suggestions: [
                          'Cử nhân',
                          'Kỹ sư',
                          'Thạc sĩ',
                          'Tiến sĩ',
                          'Cao đẳng',
                          'Trung cấp',
                        ],
                      },
                      {
                        key: 'field',
                        label: 'Chuyên ngành',
                        placeholder: 'Ví dụ: Công nghệ thông tin, Kỹ thuật phần mềm...',
                        suggestions: [
                          'Công nghệ thông tin',
                          'Kỹ thuật phần mềm',
                          'Khoa học máy tính',
                          'Hệ thống thông tin',
                          'An toàn thông tin',
                          'Trí tuệ nhân tạo',
                          'Khoa học dữ liệu',
                        ],
                      },
                      { key: 'startDate', label: 'Bắt đầu', type: 'month' },
                      { key: 'endDate', label: 'Kết thúc (hoặc dự kiến)', type: 'month' },
                      {
                        key: 'gpa',
                        label: 'GPA (tùy chọn)',
                        type: 'number',
                        placeholder: 'Ví dụ: 3.6',
                        help: 'Nhập điểm thực tế, tối đa 2 chữ số thập phân.',
                      },
                      {
                        key: 'gpaScale',
                        label: 'Thang điểm GPA',
                        type: 'select',
                        choices: [
                          { value: 4, label: 'Thang 4' },
                          { value: 10, label: 'Thang 10' },
                          { value: 100, label: 'Thang 100' },
                        ],
                      },
                      {
                        key: 'description',
                        label: 'Thông tin học vấn & Thành tích',
                        type: 'textarea',
                        placeholder:
                          'Ví dụ:\nĐề tài tốt nghiệp: Xây dựng nền tảng tuyển dụng thông minh bằng Spring Boot và React\nHọc bổng khuyến khích học tập kỳ 1 & 2',
                        help: 'Mỗi dòng là một gạch đầu dòng trên CV. Có thể ghi học bổng, đề tài tốt nghiệp hoặc giải thưởng nghiên cứu khoa học.',
                      },
                    ]}
                  />
                  <RepeatableSection
                    title="Kinh nghiệm"
                    key={`experiences:${draft.version}`}
                    sectionKey="experiences"
                    issues={validationIssues}
                    showValidation={showValidation}
                    aiSection="experience"
                    items={draft.experiences}
                    empty={emptyExperience}
                    onChange={(value) => update('experiences', value)}
                    fields={[
                      { key: 'company', label: 'Công ty' },
                      { key: 'position', label: 'Chức danh' },
                      { key: 'startDate', label: 'Bắt đầu', type: 'month' },
                      { key: 'endDate', label: 'Kết thúc', type: 'month' },
                      {
                        key: 'description',
                        label: 'Công việc và kết quả',
                        type: 'textarea',
                        help: 'Mỗi dòng là một gạch đầu dòng trên CV. Ưu tiên kết quả cụ thể bạn đạt được.',
                        placeholder:
                          'Phát triển API quản lý tuyển dụng bằng Spring Boot\nTối ưu truy vấn, giảm thời gian phản hồi từ 800 ms xuống 200 ms',
                      },
                    ]}
                  />
                  <RepeatableSection
                    title="Dự án"
                    key={`projects:${draft.version}`}
                    sectionKey="projects"
                    issues={validationIssues}
                    showValidation={showValidation}
                    skillOptions={skillOptions}
                    aiSection="project"
                    items={draft.projects}
                    empty={emptyProject}
                    onChange={(value) => update('projects', value)}
                    fields={[
                      { key: 'name', label: 'Tên dự án' },
                      { key: 'role', label: 'Vai trò' },
                      { key: 'startDate', label: 'Bắt đầu', type: 'month' },
                      { key: 'endDate', label: 'Kết thúc', type: 'month' },
                      { key: 'technologies', label: 'Công nghệ sử dụng', type: 'skills' },
                      { key: 'url', label: 'Liên kết dự án', type: 'url' },
                      { key: 'description', label: 'Mô tả và kết quả', type: 'textarea' },
                    ]}
                  />
                </div>
                <div className="cv-step-panel" id={`${paneId}-step-3`} hidden={step !== 3}>
                  <RepeatableSection
                    title="Chứng chỉ"
                    key={`certifications:${draft.version}`}
                    sectionKey="certifications"
                    issues={validationIssues}
                    showValidation={showValidation}
                    items={draft.certifications}
                    empty={emptyCertification}
                    optional
                    note="Dành cho chứng chỉ chuyên môn, công nghệ (AWS, Cisco, Oracle, Google, Coursera...). Nếu là chứng chỉ ngoại ngữ (IELTS, TOEIC...), vui lòng điền ở mục Ngoại ngữ tại Bước 2."
                    onChange={(value) => update('certifications', value)}
                    fields={[
                      {
                        key: 'name',
                        label: 'Tên chứng chỉ',
                        placeholder:
                          'Ví dụ: AWS Certified Solutions Architect, CCNA, Oracle Java...',
                      },
                      {
                        key: 'issuer',
                        label: 'Đơn vị cấp',
                        placeholder: 'Ví dụ: Amazon Web Services, Cisco, Oracle, Coursera...',
                      },
                      { key: 'issuedDate', label: 'Thời gian cấp', type: 'month' },
                      {
                        key: 'credentialUrl',
                        label: 'Liên kết chứng chỉ',
                        type: 'url',
                        placeholder: 'https://www.credly.com/badges/...',
                        help: 'Đường dẫn liên kết xác minh (Credly, Coursera, HackerRank, Microsoft, Google...). Hệ thống AI sẽ tự động phân tích và đối chiếu chứng chỉ với nhà tuyển dụng.',
                      },
                    ]}
                  />
                  <RepeatableSection
                    title="Giải thưởng"
                    key={`awards:${draft.version}`}
                    sectionKey="awards"
                    issues={validationIssues}
                    showValidation={showValidation}
                    items={draft.awards}
                    empty={emptyAward}
                    optional
                    onChange={(value) => update('awards', value)}
                    fields={[
                      { key: 'title', label: 'Tên giải thưởng' },
                      { key: 'issuer', label: 'Đơn vị trao giải' },
                      { key: 'awardedDate', label: 'Thời gian nhận', type: 'month' },
                      { key: 'description', label: 'Mô tả giải thưởng', type: 'textarea' },
                    ]}
                  />
                  <RepeatableSection
                    title="Hoạt động"
                    key={`activities:${draft.version}`}
                    sectionKey="activities"
                    issues={validationIssues}
                    showValidation={showValidation}
                    items={draft.activities}
                    empty={emptyActivity}
                    optional
                    onChange={(value) => update('activities', value)}
                    fields={[
                      { key: 'name', label: 'Tên hoạt động' },
                      { key: 'organization', label: 'Tổ chức / Câu lạc bộ' },
                      { key: 'role', label: 'Vai trò' },
                      { key: 'startDate', label: 'Bắt đầu', type: 'month' },
                      { key: 'endDate', label: 'Kết thúc', type: 'month' },
                      {
                        key: 'description',
                        label: 'Đóng góp và kết quả',
                        type: 'textarea',
                        help: 'Mỗi dòng là một gạch đầu dòng trên CV.',
                      },
                    ]}
                  />
                  <section className="cv-builder-control-card" aria-label="Mục bổ sung">
                    <h3>Mục bổ sung</h3>
                    <p>Nghiên cứu, bằng sáng chế, người giới thiệu hoặc nội dung khác trong CV.</p>
                    {(draft.extraSections ?? []).map((item, index) => (
                      <div key={index} className="cv-extra-entry">
                        <label>
                          Tiêu đề
                          <input
                            maxLength={255}
                            value={item.title}
                            onChange={(e) =>
                              update(
                                'extraSections',
                                (draft.extraSections ?? []).map((v, i) =>
                                  i === index ? { ...v, title: e.target.value } : v,
                                ),
                              )
                            }
                          />
                        </label>
                        <label>
                          Nội dung
                          <textarea
                            rows={5}
                            maxLength={12000}
                            value={item.content}
                            onChange={(e) =>
                              update(
                                'extraSections',
                                (draft.extraSections ?? []).map((v, i) =>
                                  i === index ? { ...v, content: e.target.value } : v,
                                ),
                              )
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() =>
                            update(
                              'extraSections',
                              (draft.extraSections ?? []).filter((_, i) => i !== index),
                            )
                          }
                        >
                          Xóa mục
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="button secondary"
                      disabled={(draft.extraSections?.length ?? 0) >= 30}
                      onClick={() =>
                        update('extraSections', [
                          ...(draft.extraSections ?? []),
                          { title: '', content: '' },
                        ])
                      }
                    >
                      Thêm mục bổ sung
                    </button>
                  </section>
                  <section
                    id="cv-final-review"
                    tabIndex={-1}
                    className="cv-builder-control-card cv-final-review"
                  >
                    <h2>
                      <Check size={18} /> Kiểm tra trước khi hoàn tất
                    </h2>
                    {missingRequired.length ? (
                      <>
                        <p>
                          Còn {missingRequired.length} thông tin cần điền. Bạn vẫn có thể lưu nháp.
                        </p>
                        <ul>
                          {missingRequired.map((field) => (
                            <li key={field.target}>
                              <button type="button" onClick={() => goToStep(0, field.target)}>
                                {field.label}
                                <ArrowRight size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p>
                        Đã có các thông tin bắt buộc. Hãy đọc lại CV, kiểm tra liên hệ và nội dung
                        AI trước khi hoàn tất.
                      </p>
                    )}
                    {qualityHints.length > 0 && (
                      <div
                        className="cv-quality-review"
                        role={finishReviewRequired ? 'alert' : undefined}
                      >
                        <strong>CV còn nội dung nên bổ sung</strong>
                        <p>Đây là gợi ý để hồ sơ rõ hơn, không phải điểm AI đánh giá năng lực.</p>
                        <ul>
                          {qualityHints.map((hint) => (
                            <li key={hint.field}>
                              <button
                                type="button"
                                onClick={() => goToStep(hint.step, `cv-${hint.field}`)}
                              >
                                {hint.message}
                              </button>
                            </li>
                          ))}
                        </ul>
                        {finishReviewRequired && (
                          <label className="cv-quality-confirm">
                            <input
                              type="checkbox"
                              checked={reviewConfirmed}
                              onChange={(e) => setReviewConfirmed(e.target.checked)}
                            />
                            Tôi đã kiểm tra và muốn hoàn tất với nội dung hiện tại.
                          </label>
                        )}
                        {finishReviewRequired && (
                          <p>
                            Bạn có thể bổ sung theo gợi ý, lưu nháp hoặc xác nhận rồi bấm “Hoàn tất
                            và lưu CV”.
                          </p>
                        )}
                      </div>
                    )}
                    <p className="cv-builder-field-note">
                      Chứng chỉ, giải thưởng và hoạt động là tùy chọn. Chỉ thêm những nội dung phù
                      hợp với bạn.
                    </p>
                  </section>
                </div>
                <footer className="cv-step-footer">
                  <div className="cv-step-navigation">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={step === 0}
                      onClick={() => goToStep(step - 1)}
                    >
                      <ArrowLeft size={16} /> Quay lại
                    </button>
                    {step < cvSteps.length - 1 ? (
                      <button type="button" className="button" onClick={() => goToStep(step + 1)}>
                        Tiếp tục <ArrowRight size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="button"
                        disabled={syncingProfile}
                        onClick={() => void save('READY')}
                      >
                        <Check size={16} />
                        {busy ? 'Đang lưu…' : 'Hoàn tất và lưu CV'}
                      </button>
                    )}
                  </div>
                  <div className="cv-step-save">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void save('DRAFT')}
                    >
                      <Save size={14} />
                      {busy ? 'Đang lưu…' : 'Lưu bản nháp'}
                    </button>
                    <span>Chuyển bước không tự lưu CV.</span>
                  </div>
                  {notice && <p className="cv-step-saved">{notice}</p>}
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                </footer>
              </fieldset>
              <section
                id={`${paneId}-preview`}
                className="cv-builder-preview"
                aria-label="Bản xem trước CV"
              >
                <div className="cv-preview-heading">
                  <div>
                    <span>XEM TRƯỚC CV</span>
                    <span>Bố cục đồng bộ với nhà tuyển dụng</span>
                  </div>
                  <button
                    type="button"
                    className="button secondary small cv-back-to-form-btn"
                    onClick={() => changeMobilePane('edit')}
                  >
                    Quay lại sửa form
                  </button>
                </div>
                <CvPreview draft={draft} skills={skills} />
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
