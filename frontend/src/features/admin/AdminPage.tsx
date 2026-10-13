import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom'
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react'
import { Brand } from '../../components/common/Brand'
import { Modal } from '../../components/ui/Modal'
import { useAuth } from '../../app/providers/auth-context'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import type { JobStatus, UserRole, UserStatus } from '../../types/domain'
import {
  dateLabel,
  initials,
  jobStatusLabels,
  normalizeSearch,
  roleLabels,
  sampleAccounts,
  sampleDepartments,
  sampleJobs,
  sampleJobApplications,
} from './admin-data'
import type { AdminAccount, AdminActivity, AdminDepartment, AdminJob } from './admin-data'
import { createActivityCsv } from './admin-export'
import { AdminJobFields } from './AdminJobFields'
import { jobHiringProgress, recruiterHasOpenJobs, validateHiringPlan } from './admin-hiring'
import './admin.css'

const navigation = [
  {
    path: '',
    label: 'Tổng quan',
    icon: LayoutDashboard,
    description: 'Một góc nhìn toàn diện về không gian tuyển dụng của bạn.',
  },
  {
    path: 'users',
    label: 'Tài khoản',
    icon: Users,
    description: 'Quản lý thành viên, vai trò và quyền truy cập.',
  },
  {
    path: 'jobs',
    label: 'Tin tuyển dụng',
    icon: BriefcaseBusiness,
    description: 'Theo dõi và quản lý các cơ hội tại Lumi Studio.',
  },
  {
    path: 'departments',
    label: 'Phòng ban',
    icon: Building2,
    description: 'Sắp xếp đội ngũ và các vị trí theo chuyên môn.',
  },
  {
    path: 'permissions',
    label: 'Vai trò & quyền',
    icon: ShieldCheck,
    description: 'Hiểu rõ phạm vi truy cập của từng vai trò.',
  },
  {
    path: 'activity',
    label: 'Nhật ký hoạt động',
    icon: Activity,
    description: 'Theo dõi những thay đổi trong phiên quản trị này.',
  },
  {
    path: 'settings',
    label: 'Cài đặt',
    icon: Settings2,
    description: 'Thông tin và tùy chọn cho không gian doanh nghiệp.',
  },
]
const pageSize = 5
const roleValues: UserRole[] = ['CANDIDATE', 'RECRUITER', 'COMPANY_ADMIN']
const jobStatuses: JobStatus[] = ['DRAFT', 'PUBLISHED', 'CLOSED']
const rolesDescription = {
  CANDIDATE: 'Tìm cơ hội, tạo hồ sơ và quản lý CV của mình.',
  RECRUITER: 'Xem không gian nhân sự và trải nghiệm quy trình tuyển dụng.',
  COMPANY_ADMIN: 'Truy cập trang quản trị doanh nghiệp và không gian nhân sự.',
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`admin-badge admin-badge-${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  )
}
function EmptyState({
  title = 'Không tìm thấy kết quả',
  description = 'Thử đổi từ khóa hoặc bộ lọc để xem thêm dữ liệu.',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="admin-empty">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
function Pager({
  page,
  count,
  onChange,
}: {
  page: number
  count: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  return (
    <div className="admin-pagination">
      <span>
        {count === 0
          ? '0 kết quả'
          : `Hiển thị ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} trong ${count} kết quả`}
      </span>
      <div>
        <button
          className="admin-icon-button"
          aria-label="Trang trước"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          Trang {page} / {pages}
        </span>
        <button
          className="admin-icon-button"
          aria-label="Trang sau"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  )
}
function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="admin-search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          className="admin-icon-button"
          aria-label="Xóa tìm kiếm"
          onClick={() => onChange('')}
        >
          <X size={15} />
        </button>
      )}
    </label>
  )
}
function AccountIdentity({ account }: { account: AdminAccount }) {
  return (
    <div className="admin-identity">
      <span className={`admin-avatar admin-avatar-${account.role.toLowerCase()}`}>
        {initials(account.fullName)}
      </span>
      <div>
        <strong>{account.fullName}</strong>
        <small>{account.email}</small>
      </div>
    </div>
  )
}
function JobBadge({ status }: { status: JobStatus }) {
  return (
    <Badge tone={status === 'PUBLISHED' ? 'green' : status === 'DRAFT' ? 'orange' : 'neutral'}>
      {jobStatusLabels[status]}
    </Badge>
  )
}

function Overview({
  accounts,
  jobs,
  departments,
  activities,
}: {
  accounts: AdminAccount[]
  jobs: AdminJob[]
  departments: AdminDepartment[]
  activities: AdminActivity[]
}) {
  const activeAccounts = accounts.filter((account) => account.status === 'ACTIVE').length
  const drafts = jobs.filter((job) => job.status === 'DRAFT')
  const published = jobs.filter((job) => job.status === 'PUBLISHED').length
  const stats = [
    {
      title: 'Tổng tài khoản',
      value: accounts.length,
      detail: `${activeAccounts} đang hoạt động`,
      icon: Users,
      color: 'sage',
      to: 'users',
    },
    {
      title: 'Tin đang tuyển',
      value: published,
      detail: `${jobs.length} tin trong không gian`,
      icon: BriefcaseBusiness,
      color: 'peach',
      to: 'jobs',
    },
    {
      title: 'Đội ngũ nhân sự',
      value: accounts.filter((account) => account.role === 'RECRUITER').length,
      detail: 'Thành viên phụ trách tuyển dụng',
      icon: ShieldCheck,
      color: 'lavender',
      to: 'users?role=RECRUITER',
    },
    {
      title: 'Phòng ban',
      value: departments.length,
      detail: 'Cùng xây dựng Lumi Studio',
      icon: Building2,
      color: 'sand',
      to: 'departments',
    },
  ]
  return (
    <>
      <div className="admin-stats">
        {stats.map((stat) => (
          <Link key={stat.title} className="admin-stat" to={`/admin/${stat.to}`}>
            <div>
              <span>{stat.title}</span>
              <span className={`admin-stat-icon ${stat.color}`}>
                <stat.icon size={20} />
              </span>
            </div>
            <strong>{stat.value.toString().padStart(2, '0')}</strong>
            <p>
              {stat.detail}
              <ArrowUpRight size={14} />
            </p>
          </Link>
        ))}
      </div>
      <div className="admin-overview-grid">
        <section className="admin-card admin-distribution">
          <div className="admin-card-heading">
            <div>
              <h2>Cơ hội theo phòng ban</h2>
              <p>Phân bổ các tin đang tuyển trong dữ liệu mẫu</p>
            </div>
            <span className="admin-label">ĐANG TUYỂN</span>
          </div>
          <div className="admin-chart-summary">
            <strong>{published}</strong>
            <span>
              cơ hội đang mở
              <br />
              <small>trên {departments.length} phòng ban</small>
            </span>
          </div>
          <div className="admin-bars">
            {departments.map((department) => {
              const count = jobs.filter(
                (job) => job.departmentId === department.id && job.status === 'PUBLISHED',
              ).length
              return (
                <div className="admin-bar-row" key={department.id}>
                  <span>{department.name}</span>
                  <div className="admin-bar-track">
                    <div style={{ width: `${published ? (count / published) * 100 : 0}%` }} />
                  </div>
                  <strong>{count}</strong>
                </div>
              )
            })}
          </div>
          <Link className="admin-card-link" to="/admin/departments">
            Quản lý phòng ban <ArrowRight size={15} />
          </Link>
        </section>
        <section className="admin-attention">
          <span className="admin-attention-icon">
            <FileText size={25} />
          </span>
          <span className="admin-label">BƯỚC TIẾP THEO</span>
          <h2>
            Những cơ hội
            <br />
            đang chờ mở lối<span>.</span>
          </h2>
          <p>
            {drafts.length
              ? `Bạn có ${drafts.length} tin ở trạng thái bản nháp. Xem lại nội dung trước khi chuyển sang đang tuyển.`
              : 'Tất cả bản nháp đã được xử lý. Bạn có thể kiểm tra các tin đang tuyển.'}
          </p>
          <Link className="admin-btn admin-btn-dark" to="/admin/jobs?status=DRAFT">
            Xem tin bản nháp <ArrowRight size={16} />
          </Link>
          <div className="admin-attention-bottom">
            <ShieldCheck size={16} /> Mỗi thay đổi đều có dấu vết.
          </div>
        </section>
      </div>
      <div className="admin-overview-bottom">
        <section className="admin-card">
          <div className="admin-card-heading">
            <div>
              <h2>Thành viên mới</h2>
              <p>Những kết nối gần đây trong dữ liệu mẫu</p>
            </div>
            <Link className="admin-inline-link" to="/admin/users">
              Xem tất cả <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Bốn tài khoản mẫu mới nhất</caption>
              <thead>
                <tr>
                  <th>Thành viên</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {[...accounts]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 4)
                  .map((account) => (
                    <tr key={account.id}>
                      <td>
                        <AccountIdentity account={account} />
                      </td>
                      <td>{roleLabels[account.role]}</td>
                      <td>
                        <Badge tone={account.status === 'ACTIVE' ? 'green' : 'neutral'}>
                          {account.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-card admin-recent">
          <div className="admin-card-heading">
            <div>
              <h2>Hoạt động gần đây</h2>
              <p>Nhật ký thao tác trong phiên</p>
            </div>
            <Activity size={18} />
          </div>
          {activities.length ? (
            <ol className="admin-timeline">
              {activities.slice(0, 4).map((activity) => (
                <li key={activity.id}>
                  <span className="admin-timeline-dot" />
                  <div>
                    <strong>{activity.action}</strong>
                    <p>{activity.target}</p>
                    <time dateTime={activity.at}>
                      {new Date(activity.at).toLocaleTimeString('vi-VN', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="admin-quiet">
              <Activity size={27} />
              <strong>Một khởi đầu mới</strong>
              <p>Các thao tác quản trị sẽ xuất hiện ở đây khi bạn thực hiện thay đổi.</p>
            </div>
          )}
          <Link className="admin-card-link" to="/admin/activity">
            Xem nhật ký <ArrowRight size={15} />
          </Link>
        </section>
      </div>
    </>
  )
}

function Accounts({
  accounts,
  onEdit,
  onAdd,
}: {
  accounts: AdminAccount[]
  onEdit: (account: AdminAccount) => void
  onAdd: () => void
}) {
  const location = useLocation()
  const initialRole = new URLSearchParams(location.search).get('role')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState(
    initialRole && roleValues.includes(initialRole as UserRole) ? initialRole : '',
  )
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const filtered = accounts.filter(
    (account) =>
      normalizeSearch(`${account.fullName} ${account.email}`).includes(normalizeSearch(query)) &&
      (!role || account.role === role) &&
      (!status || account.status === status),
  )
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <div>
          <h2>
            Danh sách tài khoản <span className="admin-count">{accounts.length}</span>
          </h2>
          <p>Mỗi thành viên có một vai trò rõ ràng.</p>
        </div>
        <button className="admin-btn admin-btn-dark" onClick={onAdd}>
          <Plus size={16} /> Thêm tài khoản mẫu
        </button>
      </div>
      <div className="admin-toolbar">
        <SearchField
          placeholder="Tìm theo tên hoặc email"
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
        />
        <div className="admin-filters">
          <SlidersHorizontal size={16} />
          <select
            aria-label="Lọc vai trò"
            value={role}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả vai trò</option>
            {roleValues.map((value) => (
              <option key={value} value={value}>
                {roleLabels[value]}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái tài khoản"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Đã khóa</option>
          </select>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">Danh sách tài khoản mẫu</caption>
          <thead>
            <tr>
              <th>Thành viên</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tham gia</th>
              <th>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((account) => (
              <tr key={account.id}>
                <td>
                  <AccountIdentity account={account} />
                </td>
                <td>
                  <span className={`admin-role admin-role-${account.role.toLowerCase()}`}>
                    {roleLabels[account.role]}
                  </span>
                </td>
                <td>
                  <Badge tone={account.status === 'ACTIVE' ? 'green' : 'neutral'}>
                    {account.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                  </Badge>
                </td>
                <td className="admin-muted">{dateLabel(account.createdAt)}</td>
                <td>
                  <button
                    className="admin-icon-button"
                    aria-label={`Chỉnh sửa ${account.fullName}`}
                    onClick={() => onEdit(account)}
                  >
                    <Pencil size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <EmptyState />}
      <Pager page={currentPage} count={filtered.length} onChange={setPage} />
    </section>
  )
}

function Jobs({
  jobs,
  accounts,
  departments,
  onEdit,
}: {
  jobs: AdminJob[]
  accounts: AdminAccount[]
  departments: AdminDepartment[]
  onEdit: (job: AdminJob) => void
}) {
  const location = useLocation()
  const initialStatus = new URLSearchParams(location.search).get('status')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(
    initialStatus && jobStatuses.includes(initialStatus as JobStatus) ? initialStatus : '',
  )
  const [department, setDepartment] = useState('')
  const [recruiter, setRecruiter] = useState('')
  const [quota, setQuota] = useState('')
  const [page, setPage] = useState(1)
  const filtered = jobs.filter(
    (job) =>
      normalizeSearch(job.title).includes(normalizeSearch(query)) &&
      (!status || job.status === status) &&
      (!department || job.departmentId === department) &&
      (!recruiter ||
        (recruiter === 'unassigned' ? !job.recruiterId : job.recruiterId === recruiter)) &&
      (!quota || job.quotaStatus === quota),
  )
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <div>
          <h2>
            Tất cả tin tuyển dụng <span className="admin-count">{jobs.length}</span>
          </h2>
          <p>Duyệt chỉ tiêu, phân công HR và theo dõi tiến độ tuyển dụng trong dữ liệu mẫu.</p>
        </div>
        <Link className="admin-btn" to="/recruiter">
          Không gian HR <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="admin-toolbar">
        <SearchField
          placeholder="Tìm tên vị trí tuyển dụng"
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
        />
        <div className="admin-filters">
          <select
            aria-label="Lọc HR phụ trách"
            value={recruiter}
            onChange={(event) => {
              setRecruiter(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả HR</option>
            <option value="unassigned">Chưa phân công</option>
            {accounts
              .filter(
                (account) =>
                  account.role === 'RECRUITER' ||
                  jobs.some((job) => job.recruiterId === account.id),
              )
              .map((account) => (
                <option key={account.id} value={account.id}>
                  {account.fullName}
                </option>
              ))}
          </select>
          <select
            aria-label="Lọc duyệt chỉ tiêu"
            value={quota}
            onChange={(event) => {
              setQuota(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả chỉ tiêu</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
          </select>
          <select
            aria-label="Lọc phòng ban"
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái tin"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {jobStatuses.map((value) => (
              <option key={value} value={value}>
                {jobStatusLabels[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">Tin tuyển dụng mẫu</caption>
          <thead>
            <tr>
              <th>Vị trí tuyển dụng</th>
              <th>Phòng ban</th>
              <th>HR phụ trách</th>
              <th>Chỉ tiêu / Đã tuyển</th>
              <th>Trạng thái</th>
              <th>
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((job) => (
              <tr key={job.id}>
                <td>
                  <div className="admin-identity">
                    <span className="admin-job-icon">
                      <BriefcaseBusiness size={18} />
                    </span>
                    <div>
                      <button className="admin-job-title" onClick={() => onEdit(job)}>
                        {job.title}
                      </button>
                      <small>{job.location}</small>
                    </div>
                  </div>
                </td>
                <td>
                  {departments.find((item) => item.id === job.departmentId)?.name ??
                    'Chưa phân loại'}
                </td>
                <td>
                  <div className="admin-job-cell">
                    <strong>
                      {accounts.find((account) => account.id === job.recruiterId)?.fullName ??
                        'Chưa phân công'}
                    </strong>
                  </div>
                </td>
                <td>
                  <div className="admin-job-cell">
                    <strong>
                      {job.headcount} người · Đã tuyển{' '}
                      {jobHiringProgress(job, sampleJobApplications).hired}
                    </strong>
                    <small>
                      {jobHiringProgress(job, sampleJobApplications).filled
                        ? 'Đã đủ chỉ tiêu'
                        : `Còn thiếu ${jobHiringProgress(job, sampleJobApplications).remaining} người`}
                    </small>
                    <Badge tone={job.quotaStatus === 'APPROVED' ? 'green' : 'orange'}>
                      {job.quotaStatus === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}
                    </Badge>
                  </div>
                </td>
                <td>
                  <JobBadge status={job.status} />
                </td>
                <td>
                  <button
                    className="admin-btn"
                    aria-label={`Chi tiết ${job.title}`}
                    onClick={() => onEdit(job)}
                  >
                    Chi tiết <ArrowRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && <EmptyState />}
      <Pager page={currentPage} count={filtered.length} onChange={setPage} />
    </section>
  )
}

function Departments({
  departments,
  jobs,
  onEdit,
  onAdd,
}: {
  departments: AdminDepartment[]
  jobs: AdminJob[]
  onEdit: (department: AdminDepartment) => void
  onAdd: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = departments.filter((department) =>
    normalizeSearch(`${department.name} ${department.description}`).includes(
      normalizeSearch(query),
    ),
  )
  return (
    <>
      <div className="admin-section-toolbar">
        <SearchField placeholder="Tìm phòng ban" value={query} onChange={setQuery} />
        <button className="admin-btn admin-btn-dark" onClick={onAdd}>
          <Plus size={16} /> Thêm phòng ban mẫu
        </button>
      </div>
      <div className="admin-department-grid">
        {filtered.map((department) => (
          <section className="admin-card admin-department" key={department.id}>
            <div>
              <span className="admin-department-icon">
                <Building2 size={22} />
              </span>
              <button
                className="admin-icon-button"
                aria-label={`Chỉnh sửa phòng ban ${department.name}`}
                onClick={() => onEdit(department)}
              >
                <Pencil size={16} />
              </button>
            </div>
            <h2>{department.name}</h2>
            <p>{department.description || 'Chưa có mô tả phòng ban.'}</p>
            <footer>
              <span>
                <BriefcaseBusiness size={15} />{' '}
                {jobs.filter((job) => job.departmentId === department.id).length} tin tuyển dụng
              </span>
              <Badge tone="green">
                {
                  jobs.filter(
                    (job) => job.departmentId === department.id && job.status === 'PUBLISHED',
                  ).length
                }{' '}
                đang mở
              </Badge>
            </footer>
          </section>
        ))}
      </div>
      {!filtered.length && (
        <section className="admin-card">
          <EmptyState />
        </section>
      )}
    </>
  )
}

function Permissions({ accounts }: { accounts: AdminAccount[] }) {
  const rows = [
    { label: 'Tìm kiếm và xem tin tuyển dụng', roles: [true, true, true] },
    { label: 'Quản lý hồ sơ và CV cá nhân', roles: [true, false, false] },
    { label: 'Truy cập không gian nhân sự', roles: [false, true, true] },
    { label: 'Truy cập trang quản trị doanh nghiệp', roles: [false, false, true] },
    { label: 'Duyệt chỉ tiêu tuyển dụng trong phiên mẫu', roles: [false, false, true] },
    { label: 'Phân công HR trong phiên mẫu', roles: [false, false, true] },
  ]
  return (
    <>
      <div className="admin-role-grid">
        {roleValues.map((role) => (
          <section
            key={role}
            className={`admin-card admin-role-card admin-role-card-${role.toLowerCase()}`}
          >
            <span className="admin-stat-icon">
              <ShieldCheck size={22} />
            </span>
            <h2>{roleLabels[role]}</h2>
            <p>{rolesDescription[role]}</p>
            <span className="admin-role-total">
              {accounts.filter((account) => account.role === role).length} tài khoản mẫu
            </span>
          </section>
        ))}
      </div>
      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>Phạm vi truy cập</h2>
            <p>Các quyền truy cập đã được khai báo trong ứng dụng.</p>
          </div>
          <ShieldCheck size={20} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table admin-permissions-table">
            <caption className="sr-only">Quyền truy cập theo vai trò</caption>
            <thead>
              <tr>
                <th>Chức năng</th>
                {roleValues.map((role) => (
                  <th key={role}>{roleLabels[role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  {row.roles.map((enabled, index) => (
                    <td key={roleValues[index]}>
                      {enabled ? (
                        <span className="admin-permission-yes">
                          <Check size={18} />
                          <span className="sr-only">Được phép</span>
                        </span>
                      ) : (
                        <span className="admin-muted">
                          —<span className="sr-only"> Không được phép</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-permissions-note">
          <CircleHelp size={18} />
          <p>
            Thay đổi vai trò trong bản mẫu chỉ giúp xem trước giao diện. Việc cấp quyền cho tài
            khoản thật cần được xử lý qua hệ thống quản trị phía máy chủ.
          </p>
        </div>
      </section>
    </>
  )
}

function ActivityLog({ activities, actor }: { activities: AdminActivity[]; actor: string }) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = activities.filter((item) =>
    normalizeSearch(`${item.action} ${item.target}`).includes(normalizeSearch(query)),
  )
  const exportLog = () => {
    const url = URL.createObjectURL(
      new Blob([createActivityCsv(filtered, actor)], { type: 'text/csv;charset=utf-8;' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'lumi-nhat-ky-mau.csv'
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
  return (
    <section className="admin-card">
      <div className="admin-card-heading">
        <div>
          <h2>
            Lịch sử thay đổi <span className="admin-count">{activities.length}</span>
          </h2>
          <p>Nhật ký mẫu được ghi khi bạn lưu một thay đổi.</p>
        </div>
        <button className="admin-btn" disabled={!filtered.length} onClick={exportLog}>
          <ArrowDownToLine size={16} /> Xuất CSV
        </button>
      </div>
      <div className="admin-toolbar">
        <SearchField
          placeholder="Tìm hành động hoặc đối tượng"
          value={query}
          onChange={(value) => {
            setQuery(value)
            setPage(1)
          }}
        />
      </div>
      {filtered.length ? (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Nhật ký thao tác mẫu trong phiên</caption>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Người thao tác</th>
                  <th>Hành động</th>
                  <th>Đối tượng</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * pageSize, page * pageSize).map((item) => (
                  <tr key={item.id}>
                    <td className="admin-muted">
                      <time dateTime={item.at}>
                        {new Date(item.at).toLocaleString('vi-VN', {
                          timeZone: 'Asia/Ho_Chi_Minh',
                        })}
                      </time>
                    </td>
                    <td>{actor}</td>
                    <td>{item.action}</td>
                    <td>{item.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} count={filtered.length} onChange={setPage} />
        </>
      ) : (
        <EmptyState
          title={activities.length ? 'Không tìm thấy hoạt động' : 'Chưa có hoạt động nào'}
          description="Thử thêm hoặc chỉnh sửa tài khoản, tin tuyển dụng hay phòng ban. Nhật ký sẽ xuất hiện tại đây."
        />
      )}
    </section>
  )
}

type CompanySettings = {
  name: string
  email: string
  website: string
  address: string
  description: string
}
function CompanySettingsForm({
  settings,
  onSave,
}: {
  settings: CompanySettings
  onSave: (settings: CompanySettings) => void
}) {
  const [error, setError] = useState('')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const name = String(data.get('name')).trim()
    if (!name) {
      setError('Vui lòng nhập tên doanh nghiệp.')
      return
    }
    setError('')
    onSave({
      name,
      email: String(data.get('email')).trim(),
      website: String(data.get('website')).trim(),
      address: String(data.get('address')).trim(),
      description: String(data.get('description')).trim(),
    })
  }
  return (
    <div className="admin-settings-grid">
      <section className="admin-card">
        <div className="admin-card-heading">
          <div>
            <h2>Thông tin doanh nghiệp</h2>
            <p>Thông tin hiển thị trong không gian quản trị mẫu.</p>
          </div>
          <Building2 size={21} />
        </div>
        <form className="admin-form admin-settings-form" onSubmit={submit}>
          <label>
            Tên doanh nghiệp
            <input name="name" defaultValue={settings.name} required maxLength={100} />
          </label>
          <div className="admin-form-columns">
            <label>
              Email liên hệ
              <input
                name="email"
                type="email"
                defaultValue={settings.email}
                required
                maxLength={254}
              />
            </label>
            <label>
              Website
              <input
                name="website"
                type="url"
                defaultValue={settings.website}
                maxLength={255}
                placeholder="https://example.com"
              />
            </label>
          </div>
          <label>
            Địa chỉ
            <input name="address" defaultValue={settings.address} maxLength={255} />
          </label>
          <label>
            Giới thiệu
            <textarea
              name="description"
              defaultValue={settings.description}
              rows={4}
              maxLength={1000}
            />
          </label>
          {error && (
            <p className="admin-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-form-footer">
            <span>Chỉ lưu trong phiên mẫu hiện tại</span>
            <button className="admin-btn admin-btn-dark" type="submit">
              <Check size={16} /> Lưu thay đổi mẫu
            </button>
          </div>
        </form>
      </section>
      <aside className="admin-card admin-settings-aside">
        <span className="admin-stat-icon sage">
          <ShieldCheck size={24} />
        </span>
        <h2>Quyền quản trị</h2>
        <p>Bạn đang truy cập với vai trò quản trị doanh nghiệp.</p>
        <dl>
          <div>
            <dt>Vai trò</dt>
            <dd>COMPANY_ADMIN</dd>
          </div>
          <div>
            <dt>Phạm vi</dt>
            <dd>Doanh nghiệp</dd>
          </div>
          <div>
            <dt>Múi giờ</dt>
            <dd>Việt Nam · UTC+7</dd>
          </div>
        </dl>
        <Link className="admin-card-link" to="/admin/permissions">
          Xem quyền truy cập <ArrowRight size={15} />
        </Link>
      </aside>
    </div>
  )
}

type Editor =
  | { kind: 'account'; value: AdminAccount | null }
  | { kind: 'job'; value: AdminJob }
  | { kind: 'department'; value: AdminDepartment | null }

export function AdminPage() {
  const { user, signOut, isSigningOut } = useAuth()
  const location = useLocation()
  const section = location.pathname.replace(/^\/admin\/?/, '').replace(/\/$/, '')
  const current = navigation.find((item) => item.path === section)
  useDocumentTitle(`${current?.label ?? 'Quản trị'} · Admin`)
  const [accounts, setAccounts] = useState<AdminAccount[]>(sampleAccounts)
  const [jobs, setJobs] = useState<AdminJob[]>(sampleJobs)
  const [departments, setDepartments] = useState<AdminDepartment[]>(sampleDepartments)
  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [editor, setEditor] = useState<Editor | null>(null)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const [settings, setSettings] = useState<CompanySettings>({
    name: 'Lumi Studio',
    email: 'hello@example.com',
    website: '',
    address: 'Đà Nẵng, Việt Nam',
    description: 'Cùng xây dựng những sản phẩm số dễ sử dụng và có ý nghĩa.',
  })
  useEffect(() => {
    if (!menuOpen) return
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const controls = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      ).filter((element) => element.getClientRects().length > 0)
    controls()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
      }
      if (event.key !== 'Tab') return
      const items = controls()
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const onResize = () => {
      if (window.innerWidth > 760) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [menuOpen])
  if (!current) return <Navigate to="/admin" replace />

  const openEditor = (next: Editor) => {
    setFormError('')
    setEditor(next)
  }
  const record = (action: string, target: string) => {
    setActivities((previous) => [
      { id: crypto.randomUUID(), action, target, at: new Date().toISOString() },
      ...previous,
    ])
    setNotice(`${action}: ${target}. Đã lưu trong phiên mẫu.`)
  }
  const saveEditor = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editor) return
    const form = new FormData(event.currentTarget)
    if (editor.kind === 'account') {
      const fullName = String(form.get('fullName')).trim()
      const email = String(form.get('email')).trim().toLowerCase()
      const role = String(form.get('role')) as UserRole
      const status = String(form.get('status')) as UserStatus
      if (!fullName) {
        setFormError('Vui lòng nhập họ và tên.')
        return
      }
      if (
        accounts.some(
          (account) => account.email.toLowerCase() === email && account.id !== editor.value?.id,
        )
      ) {
        setFormError('Email này đã có trong danh sách mẫu.')
        return
      }
      if (
        editor.value?.role === 'COMPANY_ADMIN' &&
        editor.value.status === 'ACTIVE' &&
        (role !== 'COMPANY_ADMIN' || status !== 'ACTIVE') &&
        accounts.filter(
          (account) => account.role === 'COMPANY_ADMIN' && account.status === 'ACTIVE',
        ).length <= 1
      ) {
        setFormError('Cần giữ ít nhất một quản trị viên đang hoạt động trong danh sách mẫu.')
        return
      }
      if (
        editor.value &&
        (role !== 'RECRUITER' || status !== 'ACTIVE') &&
        recruiterHasOpenJobs(editor.value.id, jobs)
      ) {
        setFormError(
          'HR này còn phụ trách tin chưa đóng. Hãy chuyển các tin đó cho HR khác trước khi khóa hoặc đổi vai trò.',
        )
        return
      }
      const account: AdminAccount = {
        id: editor.value?.id ?? crypto.randomUUID(),
        fullName,
        email,
        role,
        status,
        createdAt: editor.value?.createdAt ?? new Date().toISOString(),
      }
      setAccounts((previous) =>
        editor.value
          ? previous.map((item) => (item.id === account.id ? account : item))
          : [account, ...previous],
      )
      record(editor.value ? 'Cập nhật tài khoản' : 'Thêm tài khoản', fullName)
    } else if (editor.kind === 'department') {
      const name = String(form.get('name')).trim()
      if (!name) {
        setFormError('Vui lòng nhập tên phòng ban.')
        return
      }
      if (
        departments.some(
          (department) =>
            normalizeSearch(department.name) === normalizeSearch(name) &&
            department.id !== editor.value?.id,
        )
      ) {
        setFormError('Tên phòng ban đã tồn tại trong danh sách mẫu.')
        return
      }
      const department: AdminDepartment = {
        id: editor.value?.id ?? crypto.randomUUID(),
        name,
        description: String(form.get('description')).trim(),
      }
      setDepartments((previous) =>
        editor.value
          ? previous.map((item) => (item.id === department.id ? department : item))
          : [...previous, department],
      )
      record(editor.value ? 'Cập nhật phòng ban' : 'Thêm phòng ban', name)
    } else {
      const title = String(form.get('title')).trim()
      const locationName = String(form.get('location')).trim()
      if (!title || !locationName) {
        setFormError('Vui lòng nhập tên vị trí và địa điểm.')
        return
      }
      const job: AdminJob = {
        ...editor.value,
        title,
        departmentId: String(form.get('departmentId')),
        location: locationName,
        mode: String(form.get('mode')),
        status: String(form.get('status')) as JobStatus,
        headcount: Number(form.get('headcount')),
        quotaStatus: String(form.get('quotaStatus')) as AdminJob['quotaStatus'],
        recruiterId: String(form.get('recruiterId')) || null,
      }
      const hiringError = validateHiringPlan(job, sampleJobApplications, accounts)
      if (hiringError) {
        setFormError(hiringError)
        return
      }
      const quotaChanged =
        job.headcount !== editor.value.headcount || job.quotaStatus !== editor.value.quotaStatus
      if (quotaChanged) {
        job.quotaApprovedBy =
          job.quotaStatus === 'APPROVED' ? (user?.fullName ?? 'Quản trị viên') : null
        job.quotaApprovedAt = job.quotaStatus === 'APPROVED' ? new Date().toISOString() : null
      }
      setJobs((previous) => previous.map((item) => (item.id === job.id ? job : item)))
      record('Cập nhật tin tuyển dụng', `${title} · ${jobStatusLabels[job.status]}`)
      if (quotaChanged) {
        record(
          'Cập nhật chỉ tiêu',
          `${title} · ${editor.value.headcount} → ${job.headcount} người · ${job.quotaStatus === 'APPROVED' ? 'Đã duyệt' : 'Chờ duyệt'}`,
        )
      }
      if (job.recruiterId !== editor.value.recruiterId) {
        const recruiterName = (id: string | null) =>
          accounts.find((account) => account.id === id)?.fullName ?? 'Chưa phân công'
        record(
          'Phân công HR',
          `${title} · ${recruiterName(editor.value.recruiterId)} → ${recruiterName(job.recruiterId)}`,
        )
      }
    }
    setEditor(null)
  }

  const editorTitle =
    editor?.kind === 'account'
      ? editor.value
        ? 'Chỉnh sửa tài khoản mẫu'
        : 'Thêm tài khoản mẫu'
      : editor?.kind === 'department'
        ? editor.value
          ? 'Chỉnh sửa phòng ban mẫu'
          : 'Thêm phòng ban mẫu'
        : 'Chi tiết tin tuyển dụng mẫu'
  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">
        Đến nội dung quản trị
      </a>
      {menuOpen && (
        <button
          className="admin-menu-backdrop"
          aria-label="Đóng điều hướng"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`admin-sidebar${menuOpen ? ' is-open' : ''}`}
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen ? true : undefined}
        aria-label="Menu quản trị"
      >
        <div className="admin-brand-row">
          <Brand />
          <button
            className="admin-icon-button admin-close-menu"
            aria-label="Đóng menu"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="admin-workspace">
          <span className="admin-company-symbol">
            L<span>.</span>
          </span>
          <div>
            <strong>{settings.name}</strong>
            <small>Quản trị doanh nghiệp</small>
          </div>
          <ShieldCheck size={17} />
        </div>
        <span className="admin-nav-label">KHÔNG GIAN QUẢN TRỊ</span>
        <nav aria-label="Điều hướng quản trị">
          {navigation.map((item, index) => (
            <NavLink
              end={item.path === ''}
              key={item.path}
              to={`/admin${item.path ? `/${item.path}` : ''}`}
              onClick={() => {
                setMenuOpen(false)
                setNotice('')
              }}
              className={({ isActive }) =>
                `admin-nav-item${isActive ? ' active' : ''}${index === 5 ? ' admin-nav-separated' : ''}`
              }
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.path === 'users' && <span className="admin-nav-count">{accounts.length}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-sidebar-note">
            <ShieldCheck size={21} />
            <strong>Đúng người. Đúng quyền.</strong>
            <p>Một không gian rõ ràng cho đội ngũ cùng phát triển.</p>
            <Link to="/admin/permissions" onClick={() => setMenuOpen(false)}>
              Xem quyền truy cập <ArrowUpRight size={14} />
            </Link>
          </div>
          <Link className="admin-external-link" to="/recruiter">
            <BriefcaseBusiness size={17} /> Không gian HR <ArrowUpRight size={14} />
          </Link>
          <Link className="admin-external-link" to="/">
            <ArrowUpRight size={17} /> Về trang tuyển dụng
          </Link>
          <div className="admin-sidebar-account">
            <span className="admin-avatar">{initials(user?.fullName ?? 'Admin')}</span>
            <div>
              <strong>{user?.fullName ?? 'Quản trị viên'}</strong>
              <small>Quản trị viên</small>
            </div>
            <button
              className="admin-icon-button"
              aria-label="Đăng xuất"
              disabled={isSigningOut}
              onClick={() => void signOut()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="admin-main" inert={menuOpen}>
        <header className="admin-topbar">
          <div>
            <button
              className="admin-icon-button admin-open-menu"
              aria-label="Mở menu quản trị"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Quản trị doanh nghiệp</span>
            <ChevronRight size={13} />
            <strong>{current.label}</strong>
          </div>
          <div>
            <span className="admin-environment">
              <i /> Phiên dữ liệu mẫu
            </span>
            <span className="admin-topbar-divider" />
            <span className="admin-avatar">{initials(user?.fullName ?? 'Admin')}</span>
          </div>
        </header>
        <main id="admin-content" className="admin-content" tabIndex={-1}>
          <div className="admin-page-heading">
            <div>
              <span className="admin-eyebrow">LUMI STUDIO / ADMIN</span>
              <h1>
                {section === '' ? 'Không gian của những kết nối' : current.label}
                <span>.</span>
              </h1>
              <p>{current.description}</p>
            </div>
            {section === '' && (
              <Link className="admin-btn admin-btn-dark" to="/admin/users">
                <Users size={16} /> Quản lý tài khoản <ArrowUpRight size={15} />
              </Link>
            )}
          </div>
          <div className="admin-demo-note">
            <CircleHelp size={17} />
            <p>
              <strong>Bản xem trước quản trị.</strong> Dữ liệu bên dưới là mẫu. Thay đổi chỉ có hiệu
              lực trong phiên này và được đặt lại khi tải lại hoặc rời trang Admin.
            </p>
          </div>
          {notice && (
            <div className="admin-notice" role="status">
              <Check size={17} />
              <span>{notice}</span>
              <button
                className="admin-icon-button"
                aria-label="Đóng thông báo"
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {section === '' && (
            <Overview
              accounts={accounts}
              jobs={jobs}
              departments={departments}
              activities={activities}
            />
          )}
          {section === 'users' && (
            <Accounts
              key={location.search}
              accounts={accounts}
              onEdit={(account) => openEditor({ kind: 'account', value: account })}
              onAdd={() => openEditor({ kind: 'account', value: null })}
            />
          )}
          {section === 'jobs' && (
            <Jobs
              key={location.search}
              jobs={jobs}
              departments={departments}
              accounts={accounts}
              onEdit={(job) => openEditor({ kind: 'job', value: job })}
            />
          )}
          {section === 'departments' && (
            <Departments
              departments={departments}
              jobs={jobs}
              onEdit={(department) => openEditor({ kind: 'department', value: department })}
              onAdd={() => openEditor({ kind: 'department', value: null })}
            />
          )}
          {section === 'permissions' && <Permissions accounts={accounts} />}
          {section === 'activity' && (
            <ActivityLog activities={activities} actor={user?.fullName ?? 'Quản trị viên'} />
          )}
          {section === 'settings' && (
            <CompanySettingsForm
              settings={settings}
              onSave={(next) => {
                setSettings(next)
                record('Cập nhật thông tin doanh nghiệp', next.name)
              }}
            />
          )}
          <footer className="admin-footer">
            <span>Lumi Studio · Cùng xây dựng đội ngũ tiếp theo.</span>
            <span>Không gian quản trị doanh nghiệp</span>
          </footer>
        </main>
      </div>
      {editor && (
        <Modal title={editorTitle} onClose={() => setEditor(null)} wide={editor.kind === 'job'}>
          <form className="admin-form" onSubmit={saveEditor}>
            <p className="admin-editor-description">
              Thay đổi được lưu trong phiên mẫu và ghi vào nhật ký hoạt động.
            </p>
            {editor.kind === 'account' && (
              <>
                <label>
                  Họ và tên
                  <input
                    autoFocus
                    name="fullName"
                    required
                    maxLength={100}
                    defaultValue={editor.value?.fullName ?? ''}
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    required
                    type="email"
                    maxLength={254}
                    defaultValue={editor.value?.email ?? ''}
                    placeholder="minhanh@example.com"
                  />
                </label>
                <div className="admin-form-columns">
                  <label>
                    Vai trò
                    <select name="role" defaultValue={editor.value?.role ?? 'CANDIDATE'}>
                      {roleValues.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Trạng thái
                    <select name="status" defaultValue={editor.value?.status ?? 'ACTIVE'}>
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="INACTIVE">Đã khóa</option>
                    </select>
                  </label>
                </div>
                <p className="admin-field-help">
                  Tài khoản mẫu dùng để xem trước. Thao tác này không tạo tài khoản đăng nhập hoặc
                  gửi thư mời.
                </p>
              </>
            )}
            {editor.kind === 'department' && (
              <>
                <label>
                  Tên phòng ban
                  <input
                    autoFocus
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={editor.value?.name ?? ''}
                    placeholder="Ví dụ: Nhân sự"
                  />
                </label>
                <label>
                  Mô tả
                  <textarea
                    name="description"
                    maxLength={500}
                    rows={4}
                    defaultValue={editor.value?.description ?? ''}
                    placeholder="Chuyên môn và vai trò của phòng ban"
                  />
                </label>
              </>
            )}
            {editor.kind === 'job' && (
              <AdminJobFields
                job={editor.value}
                accounts={accounts}
                departments={departments}
                applications={sampleJobApplications}
              />
            )}
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-form-footer">
              <button className="admin-btn" type="button" onClick={() => setEditor(null)}>
                Hủy
              </button>
              <button className="admin-btn admin-btn-dark" type="submit">
                <Check size={16} /> Lưu thay đổi mẫu
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
