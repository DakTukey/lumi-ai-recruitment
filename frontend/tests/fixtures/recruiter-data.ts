import type { JobDraft, RecruiterJob, SampleApplication, ApplicationAssessment, HistoryItem } from '../../src/features/jobs/recruiter-model'
import { emptyDraft, dateInput, salaryLabel } from '../../src/features/jobs/recruiter-model'
import { initialJobs } from './jobs'
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
