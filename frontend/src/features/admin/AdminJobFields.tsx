import { useState } from 'react'
import type { AdminAccount, AdminDepartment, AdminJob, AdminJobApplication } from './admin-data'
import { dateLabel, jobStatusLabels } from './admin-data'
import { jobHiringProgress } from './admin-hiring'

export function AdminJobFields({
  job,
  accounts,
  departments,
  applications,
}: {
  job: AdminJob
  accounts: AdminAccount[]
  departments: AdminDepartment[]
  applications: AdminJobApplication[]
}) {
  const [headcount, setHeadcount] = useState(String(job.headcount))
  const [quotaStatus, setQuotaStatus] = useState(job.quotaStatus)
  const [recruiterId, setRecruiterId] = useState(job.recruiterId ?? '')
  const progress = jobHiringProgress({ ...job, headcount: Number(headcount) }, applications)
  const validHeadcount = Number.isInteger(Number(headcount)) && Number(headcount) > 0
  const recruiters = accounts.filter(
    (account) => account.role === 'RECRUITER' && account.status === 'ACTIVE',
  )
  const originalRecruiter = accounts.find((account) => account.id === job.recruiterId)
  const creator = accounts.find((account) => account.id === job.createdById)
  return (
    <>
      <p className="admin-job-heading">{job.title}</p>
      <div className="admin-job-management">
        <section className="admin-job-section" aria-label="Chỉ tiêu tuyển dụng">
          <h3>Chỉ tiêu tuyển dụng</h3>
          <div className="admin-hiring-stats">
            <div>
              <span>Chỉ tiêu</span>
              <strong>{validHeadcount ? Number(headcount).toLocaleString('vi-VN') : '—'}</strong>
              <small>người cần tuyển</small>
            </div>
            <div>
              <span>Đã tuyển</span>
              <strong>{progress.hired}</strong>
              <small>hồ sơ Đã tuyển</small>
            </div>
            <div>
              <span>Còn thiếu</span>
              <strong>{validHeadcount ? progress.remaining.toLocaleString('vi-VN') : '—'}</strong>
              <small>người</small>
            </div>
          </div>
          {job.status === 'PUBLISHED' && progress.filled && validHeadcount && (
            <p className="admin-hiring-alert">
              Đã đủ chỉ tiêu. Hãy xem xét đóng tin ở phần trạng thái bên dưới; hệ thống không tự
              đóng tin.
            </p>
          )}
          <div className="admin-form-columns">
            <label>
              Chỉ tiêu cần tuyển (người)
              <input
                name="headcount"
                type="number"
                min={Math.max(1, progress.hired)}
                max={2147483647}
                step={1}
                required
                value={headcount}
                onChange={(event) => setHeadcount(event.target.value)}
              />
            </label>
            <label>
              Duyệt chỉ tiêu
              <select
                name="quotaStatus"
                value={quotaStatus}
                onChange={(event) => setQuotaStatus(event.target.value as AdminJob['quotaStatus'])}
              >
                <option value="PENDING">Chờ duyệt</option>
                <option value="APPROVED">Đã duyệt</option>
              </select>
            </label>
          </div>
          <p className="admin-field-help">
            Lưu với trạng thái “Đã duyệt” để xác nhận chỉ tiêu. Số đã tuyển chưa tính Offer.
          </p>
          {job.quotaApprovedBy && job.quotaApprovedAt && (
            <p className="admin-job-meta">
              Lần duyệt đã lưu: {job.quotaApprovedBy} · {dateLabel(job.quotaApprovedAt)}
            </p>
          )}
        </section>
        <section className="admin-job-section" aria-label="Phân công HR">
          <h3>Phân công HR</h3>
          <label>
            HR phụ trách
            <select
              name="recruiterId"
              value={recruiterId}
              onChange={(event) => setRecruiterId(event.target.value)}
            >
              <option value="">Chưa phân công</option>
              {originalRecruiter &&
                !recruiters.some((account) => account.id === originalRecruiter.id) && (
                  <option value={originalRecruiter.id} disabled>
                    {originalRecruiter.fullName} — Không còn là HR hoạt động
                  </option>
                )}
              {recruiters.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.fullName} · {account.email}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-job-meta">
            Người tạo tin: <strong>{creator?.fullName ?? 'Không xác định'}</strong>. Thông tin này
            được giữ nguyên khi chuyển người phụ trách.
          </p>
          <p className="admin-field-help">
            Mỗi tin có một HR chính. Một HR có thể phụ trách nhiều tin thuộc nhiều phòng ban. Chỉ
            tài khoản HR đang hoạt động được nhận phân công.
          </p>
        </section>
      </div>
      <section className="admin-job-section" aria-label="Thông tin tin tuyển dụng">
        <h3>Thông tin tin tuyển dụng</h3>
        <label>
          Tên vị trí
          <input name="title" required maxLength={200} defaultValue={job.title} />
        </label>
        <label>
          Phòng ban
          <select name="departmentId" defaultValue={job.departmentId}>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-form-columns">
          <label>
            Địa điểm
            <input name="location" required maxLength={200} defaultValue={job.location} />
          </label>
          <label>
            Hình thức
            <select name="mode" defaultValue={job.mode}>
              <option>Hybrid</option>
              <option>Remote</option>
              <option>Tại văn phòng</option>
            </select>
          </label>
        </div>
        <label>
          Trạng thái tin
          <select name="status" defaultValue={job.status}>
            {(['DRAFT', 'PUBLISHED', 'CLOSED'] as const).map((status) => (
              <option key={status} value={status}>
                {jobStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <p className="admin-field-help">
          Chỉ đăng/mở lại tin khi chỉ tiêu đã được duyệt và đã có HR phụ trách. Thay đổi ở đây chỉ
          áp dụng cho tin mẫu.
        </p>
      </section>
    </>
  )
}
