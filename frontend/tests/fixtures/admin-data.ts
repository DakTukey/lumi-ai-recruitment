import type { AdminAccount, AdminDepartment, AdminJob, AdminJobApplication } from '../../src/features/admin/admin-data'
import { initialJobs } from './jobs'
export const sampleAccounts: AdminAccount[] = [
  {
    id: 'a1',
    fullName: 'Nguyễn Hoàng An',
    email: 'hoangan@example.com',
    role: 'COMPANY_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-09-01',
  },
  {
    id: 'a2',
    fullName: 'Trần Minh Thư',
    email: 'minhthu@example.com',
    role: 'RECRUITER',
    status: 'ACTIVE',
    createdAt: '2026-09-12',
  },
  {
    id: 'a3',
    fullName: 'Lê Khánh Linh',
    email: 'khanhlinh@example.com',
    role: 'RECRUITER',
    status: 'ACTIVE',
    createdAt: '2026-09-18',
  },
  {
    id: 'a4',
    fullName: 'Phạm Minh Anh',
    email: 'minhanh@example.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
    createdAt: '2026-10-01',
  },
  {
    id: 'a5',
    fullName: 'Nguyễn Quang Huy',
    email: 'quanghuy@example.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
    createdAt: '2026-10-02',
  },
  {
    id: 'a6',
    fullName: 'Võ Thu Hà',
    email: 'thuha@example.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
    createdAt: '2026-10-03',
  },
  {
    id: 'a7',
    fullName: 'Đặng Bảo Ngọc',
    email: 'baongoc@example.com',
    role: 'CANDIDATE',
    status: 'INACTIVE',
    createdAt: '2026-09-28',
  },
  {
    id: 'a8',
    fullName: 'Đỗ Gia Hân',
    email: 'giahan@example.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
    createdAt: '2026-10-04',
  },
]
export const sampleDepartments: AdminDepartment[] = [
  { id: 'technology', name: 'Công nghệ', description: 'Phát triển và vận hành sản phẩm số.' },
  { id: 'design', name: 'Thiết kế', description: 'Nghiên cứu người dùng và thiết kế trải nghiệm.' },
  {
    id: 'data',
    name: 'Dữ liệu & AI',
    description: 'Phân tích dữ liệu và ứng dụng trí tuệ nhân tạo.',
  },
  { id: 'marketing', name: 'Marketing', description: 'Thương hiệu, nội dung và tăng trưởng.' },
  { id: 'business', name: 'Kinh doanh', description: 'Phát triển khách hàng và quan hệ đối tác.' },
]
export const sampleJobs: AdminJob[] = initialJobs.map((job, index) => ({
  id: String(job.id),
  title: job.title,
  departmentId:
    sampleDepartments.find((department) => department.name === job.category)?.id ?? 'business',
  location: job.location,
  mode: job.mode,
  status: index === 3 ? 'DRAFT' : index === 5 ? 'CLOSED' : 'PUBLISHED',
  headcount: [3, 2, 2, 1, 2, 1][index] ?? 1,
  quotaStatus: index === 3 ? 'PENDING' : 'APPROVED',
  quotaApprovedBy: index === 3 ? null : 'Nguyễn Hoàng An',
  quotaApprovedAt: index === 3 ? null : '2026-10-01T03:00:00Z',
  createdById: index % 2 === 0 ? 'a2' : 'a3',
  recruiterId: index === 3 ? null : index % 2 === 0 ? 'a2' : 'a3',
}))

// Hồ sơ mẫu riêng của Admin, dùng để minh họa tiến độ; không phải đơn trong database.
export const sampleJobApplications: AdminJobApplication[] = [
  { id: 'ja1', jobId: '1', candidateId: 'a4', status: 'HIRED' },
  { id: 'ja2', jobId: '1', candidateId: 'a5', status: 'OFFER' },
  { id: 'ja3', jobId: '1', candidateId: 'a6', status: 'REVIEWING' },
  { id: 'ja4', jobId: '2', candidateId: 'a8', status: 'OFFER' },
  { id: 'ja5', jobId: '3', candidateId: 'a5', status: 'HIRED' },
  { id: 'ja6', jobId: '3', candidateId: 'a6', status: 'HIRED' },
  { id: 'ja7', jobId: '5', candidateId: 'a7', status: 'REJECTED' },
  { id: 'ja8', jobId: '6', candidateId: 'a8', status: 'HIRED' },
]

