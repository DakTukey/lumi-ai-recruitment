import type { Job } from '../../types/domain'
import { initialJobs } from './data/jobs'
import { JOB_PAGE_SIZE } from './job-list-pagination'

const additionalJobs = [
  {
    title: 'Senior Fullstack Developer',
    category: 'Công nghệ',
    level: 'Senior',
    mode: 'Remote',
    salary: '35 – 50 triệu',
    minSalary: 35,
    tags: ['React', 'Node.js', 'PostgreSQL'],
  },
  {
    title: 'QA Engineer',
    category: 'Công nghệ',
    level: 'Middle',
    mode: 'Hybrid',
    salary: '18 – 28 triệu',
    minSalary: 18,
    tags: ['Testing', 'Playwright', 'API'],
  },
  {
    title: 'DevOps Engineer',
    category: 'Công nghệ',
    level: 'Senior',
    mode: 'Tại văn phòng',
    salary: '30 – 45 triệu',
    minSalary: 30,
    tags: ['Docker', 'Kubernetes', 'CI/CD'],
  },
  {
    title: 'Data Analyst',
    category: 'Dữ liệu & AI',
    level: 'Middle',
    mode: 'Hybrid',
    salary: '20 – 30 triệu',
    minSalary: 20,
    tags: ['SQL', 'Python', 'Power BI'],
  },
  {
    title: 'Mobile Developer (Flutter)',
    category: 'Công nghệ',
    level: 'Junior',
    mode: 'Remote',
    salary: '15 – 25 triệu',
    minSalary: 15,
    tags: ['Flutter', 'Dart', 'REST API'],
  },
  {
    title: 'Content Marketing Intern',
    category: 'Marketing',
    level: 'Intern',
    mode: 'Tại văn phòng',
    salary: '4 – 6 triệu',
    minSalary: 4,
    tags: ['Content', 'SEO', 'Social Media'],
  },
  {
    title: 'UI/UX Design Intern',
    category: 'Thiết kế',
    level: 'Intern',
    mode: 'Hybrid',
    salary: '5 – 7 triệu',
    minSalary: 5,
    tags: ['Figma', 'Prototype', 'Research'],
  },
  {
    title: 'Business Analyst',
    category: 'Kinh doanh',
    level: 'Middle',
    mode: 'Hybrid',
    salary: 'Thỏa thuận',
    minSalary: 0,
    tags: ['BPMN', 'Agile', 'Requirements'],
  },
]

export const candidatePreviewJobs: Job[] = [
  ...initialJobs,
  ...additionalJobs.map((job, index) => ({
    ...job,
    id: 101 + index,
    company: 'Lumi Studio',
    mark: 'lumi',
    color: 'violet',
    location: ['Đà Nẵng', 'Hà Nội', 'TP. Hồ Chí Minh'][index % 3],
    posted: `${index + 2} ngày trước`,
    ageHours: (index + 2) * 24,
    description: `Tham gia đội ngũ ${job.category} để phát triển sản phẩm tại Lumi Studio. Phối hợp với các thành viên trong nhóm, chủ động đề xuất giải pháp và cùng cải thiện trải nghiệm khách hàng.`,
  })),
].map((job, index) => ({
  ...job,
  headcount: [3, 2, 2, 1][index % 4],
  requirements: `Có kiến thức và kinh nghiệm phù hợp với cấp độ ${job.level}.\nSử dụng các kỹ năng: ${job.tags.join(', ')}.\nChủ động học hỏi, giao tiếp rõ ràng và phối hợp tốt với đội ngũ.`,
  benefits:
    'Thời gian làm việc linh hoạt theo hình thức của vị trí.\nĐược hướng dẫn và tham gia các buổi chia sẻ chuyên môn.\nTrang thiết bị làm việc và hoạt động gắn kết đội ngũ.\nQuyền lợi trong tin này là nội dung minh họa.',
}))

export const candidatePreviewDepartments = [
  ...new Set(candidatePreviewJobs.map((job) => job.category)),
].map((name, index) => ({ id: `sample-department-${index}`, name, description: null }))

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()

export function previewJobPage({
  query,
  category,
  levels,
  modes,
  salary,
  sort,
  savedOnly,
  saved,
  page,
  cumulative = false,
}: {
  query: string
  category: string
  levels: string[]
  modes: string[]
  salary: boolean
  sort: string
  savedOnly: boolean
  saved: (string | number)[]
  page: number
  cumulative?: boolean
}) {
  const jobs = candidatePreviewJobs
    .filter(
      (job) =>
        normalize(`${job.title} ${job.tags.join(' ')}`).includes(normalize(query)) &&
        (category === 'Tất cả' || job.category === category) &&
        (!levels.length || levels.includes(job.level)) &&
        (!modes.length || modes.includes(job.mode)) &&
        (!salary || job.minSalary >= 15) &&
        (!savedOnly || saved.includes(job.id)),
    )
    .sort((a, b) => {
      if (sort === 'salary' && a.minSalary !== b.minSalary) return b.minSalary - a.minSalary
      if (sort === 'featured' && Boolean(a.featured) !== Boolean(b.featured))
        return Number(Boolean(b.featured)) - Number(Boolean(a.featured))
      return a.ageHours - b.ageHours || Number(a.id) - Number(b.id)
    })
  return {
    content: jobs.slice(cumulative ? 0 : page * JOB_PAGE_SIZE, (page + 1) * JOB_PAGE_SIZE),
    totalElements: jobs.length,
    totalPages: Math.ceil(jobs.length / JOB_PAGE_SIZE),
  }
}
