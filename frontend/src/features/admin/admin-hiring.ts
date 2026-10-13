import type { AdminAccount, AdminJob, AdminJobApplication } from './admin-data'

export function jobHiringProgress(
  job: Pick<AdminJob, 'id' | 'headcount'>,
  applications: AdminJobApplication[],
) {
  const hired = new Set(
    applications
      .filter((application) => application.jobId === job.id && application.status === 'HIRED')
      .map((application) => application.candidateId),
  ).size
  return { hired, remaining: Math.max(0, job.headcount - hired), filled: hired >= job.headcount }
}

export function validateHiringPlan(
  job: AdminJob,
  applications: AdminJobApplication[],
  accounts: AdminAccount[],
) {
  if (!Number.isInteger(job.headcount) || job.headcount < 1 || job.headcount > 2147483647) {
    return 'Chỉ tiêu phải là số nguyên dương, tối đa 2.147.483.647 người.'
  }
  if (job.headcount < jobHiringProgress(job, applications).hired) {
    return 'Chỉ tiêu không được nhỏ hơn số người đã tuyển. Hãy kiểm tra lại hồ sơ đã tuyển.'
  }
  if (!['PENDING', 'APPROVED'].includes(job.quotaStatus)) {
    return 'Vui lòng chọn trạng thái duyệt chỉ tiêu hợp lệ.'
  }
  if (
    job.recruiterId &&
    !accounts.some(
      (account) =>
        account.id === job.recruiterId &&
        account.role === 'RECRUITER' &&
        account.status === 'ACTIVE',
    )
  ) {
    return 'Chỉ được giao tin cho tài khoản HR đang hoạt động.'
  }
  if (job.status === 'PUBLISHED' && job.quotaStatus !== 'APPROVED') {
    return 'Cần duyệt chỉ tiêu trước khi đăng hoặc mở lại tin.'
  }
  if (job.status === 'PUBLISHED' && !job.recruiterId) {
    return 'Cần phân công HR phụ trách trước khi đăng hoặc mở lại tin.'
  }
  return ''
}

export function recruiterHasOpenJobs(accountId: string, jobs: AdminJob[]) {
  return jobs.some((job) => job.recruiterId === accountId && job.status !== 'CLOSED')
}
