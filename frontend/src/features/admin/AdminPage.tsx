import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../app/providers/auth-context'
import { Brand } from '../../components/common/Brand'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { getDepartments, type Department } from '../../services/job.service'
import { getRecruiterJobs } from '../../services/recruiter-job.service'
import type { RecruiterJob } from '../jobs/recruiter-model'
import { initials, jobStatusLabels } from '../jobs/recruiter-model'
import './admin.css'
const navigation = [
  {
    path: '',
    label: 'Tổng quan',
    icon: LayoutDashboard,
    description: 'Một góc nhìn toàn diện về không gian tuyển dụng của bạn.',
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
]

export function AdminPage() {
  const { user, signOut, isSigningOut } = useAuth()
  const location = useLocation()
  const section = location.pathname.replace(/^\/admin\/?/, '').replace(/\/$/, '')
  const current = navigation.find((item) => item.path === section)
  useDocumentTitle(`${current?.label ?? 'Quản trị'} · Admin`)
  const [menuOpen, setMenuOpen] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{
    key: number
    departments: Department[]
    jobs: RecruiterJob[]
    total: number
    error: string
  } | null>(null)
  const loading = result?.key !== retry
  useEffect(() => {
    let active = true
    Promise.all([getDepartments(), getRecruiterJobs(new URLSearchParams({ page: '0', size: '8' }))])
      .then(([departments, jobs]) => {
        if (active)
          setResult({
            key: retry,
            departments,
            jobs: jobs.content,
            total: jobs.totalElements,
            error: '',
          })
      })
      .catch(() => {
        if (active)
          setResult({
            key: retry,
            departments: [],
            jobs: [],
            total: 0,
            error: 'Chưa tải được dữ liệu quản trị. Vui lòng thử lại.',
          })
      })
    return () => {
      active = false
    }
  }, [retry])
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
            <strong>Lumi Studio</strong>
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
              }}
              className={({ isActive }) =>
                `admin-nav-item${isActive ? ' active' : ''}${index === 5 ? ' admin-nav-separated' : ''}`
              }
            >
              <item.icon size={19} />
              <span>{item.label}</span>
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
              <i /> Quản trị doanh nghiệp
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
                {current.label}
                <span>.</span>
              </h1>
              <p>{current.description}</p>
            </div>
            <Link className="admin-btn admin-btn-dark" to="/recruiter/jobs">
              Quản lý tuyển dụng <ArrowUpRight size={16} />
            </Link>
          </div>
          {['', 'jobs', 'departments'].includes(section) && (
            <>
              {loading ? (
                <p role="status">Đang tải dữ liệu…</p>
              ) : result?.error ? (
                <section className="admin-panel" role="alert">
                  <p>{result.error}</p>
                  <button className="admin-btn" onClick={() => setRetry((n) => n + 1)}>
                    Thử lại
                  </button>
                </section>
              ) : (
                <>
                  {section === '' && (
                    <section className="admin-panel">
                      <div className="admin-panel-heading">
                        <h2>Tổng quan tuyển dụng</h2>
                      </div>
                      <div className="admin-live-stats">
                        <Link to="/admin/jobs">
                          <strong>{result?.total ?? 0}</strong>
                          <span>Tin tuyển dụng</span>
                        </Link>
                        <Link to="/admin/departments">
                          <strong>{result?.departments.length ?? 0}</strong>
                          <span>Phòng ban đang hoạt động</span>
                        </Link>
                      </div>
                      <p className="admin-live-note">
                        Số liệu lấy từ hệ thống tuyển dụng. Quản lý tài khoản, duyệt chỉ tiêu và cài
                        đặt doanh nghiệp chưa được kết nối.
                      </p>
                    </section>
                  )}
                  {['', 'jobs'].includes(section) && (
                    <section className="admin-panel">
                      <div className="admin-panel-heading">
                        <h2>Tin tuyển dụng gần đây</h2>
                        <Link to="/recruiter/jobs">Xem tất cả →</Link>
                      </div>
                      {!result?.jobs.length ? (
                        <div className="admin-empty">
                          <BriefcaseBusiness size={28} />
                          <h3>Chưa có tin tuyển dụng</h3>
                          <p>Tạo tin trong không gian HR để bắt đầu.</p>
                          <Link className="admin-btn" to="/recruiter/jobs">
                            Đến tin tuyển dụng
                          </Link>
                        </div>
                      ) : (
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Vị trí</th>
                                <th>Phòng ban</th>
                                <th>Trạng thái</th>
                                <th>Chi tiết</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.jobs.map((job) => (
                                <tr key={job.id}>
                                  <td>{job.title}</td>
                                  <td>{job.category}</td>
                                  <td>{jobStatusLabels[job.status]}</td>
                                  <td>
                                    <Link to={`/recruiter/jobs/${encodeURIComponent(job.id)}`}>
                                      Xem tin →
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="admin-live-note">
                        Hiển thị tối đa 8 tin. Mở “Xem tất cả” để lọc, phân trang và chỉnh sửa.
                      </p>
                    </section>
                  )}
                  {section === 'departments' && (
                    <section className="admin-panel">
                      <div className="admin-panel-heading">
                        <h2>Phòng ban đang hoạt động</h2>
                      </div>
                      {!result?.departments.length ? (
                        <div className="admin-empty">
                          <h3>Chưa có phòng ban đang hoạt động</h3>
                        </div>
                      ) : (
                        <div className="admin-table-wrap">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Phòng ban</th>
                                <th>Mô tả</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.departments.map((d) => (
                                <tr key={d.id}>
                                  <td>{d.name}</td>
                                  <td>{d.description || 'Chưa có mô tả'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <p className="admin-live-note">
                        Danh mục hiện có dùng cho form tuyển dụng. Màn hình quản trị thêm, sửa và
                        ngừng hoạt động phòng ban chưa được kết nối.
                      </p>
                    </section>
                  )}
                </>
              )}
            </>
          )}
          {section === 'permissions' && (
            <section className="admin-panel">
              <div className="admin-panel-heading">
                <h2>Phạm vi truy cập hiện tại</h2>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Vai trò</th>
                      <th>Phạm vi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Ứng viên</td>
                      <td>Hồ sơ, CV và đơn ứng tuyển của chính mình.</td>
                    </tr>
                    <tr>
                      <td>Nhân sự</td>
                      <td>Quản lý tin tuyển dụng, xem và xử lý đơn ứng tuyển của công ty.</td>
                    </tr>
                    <tr>
                      <td>Quản trị viên</td>
                      <td>Truy cập quản trị và không gian tuyển dụng của công ty.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="admin-live-note">
                Quyền được xác thực và phân bổ an toàn trực tiếp tại máy chủ theo vai trò người dùng.
              </p>
            </section>
          )}
          <footer className="admin-footer">
            <span>Lumi Studio · Quản trị doanh nghiệp</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
