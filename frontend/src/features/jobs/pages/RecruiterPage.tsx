import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  FlaskConical,
  Info,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../app/providers/auth-context'
import { Brand } from '../../../components/common/Brand'
import { Modal } from '../../../components/ui/Modal'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { ApiError } from '../../../services/api'
import type { ApplicationSummary } from '../../../services/application.service'
import { getApplicationSummary } from '../../../services/application.service'
import type { Department } from '../../../services/job.service'
import { getDepartments, getJobs } from '../../../services/job.service'
import {
  createRecruiterDepartment,
  createRecruiterJob,
  getRecruiterJob,
  getRecruiterJobs,
  transitionRecruiterJob,
  updateRecruiterJob,
} from '../../../services/recruiter-job.service'
import type { PaginatedResponse } from '../../../types/api'
import type { Job, JobStatus } from '../../../types/domain'
import { SubmittedApplicationDetail } from '../../applications/components/SubmittedApplicationDetail'
import { RecruiterApplications, Timeline } from '../components/RecruiterApplications'
import { RecruiterJobForm } from '../components/RecruiterJobForm'
import { RecruiterJobPreview } from '../components/RecruiterJobPreview'
import { RecruiterRealProfile } from '../components/RecruiterRealProfile'
import type { JobDraft, RecruiterJob } from '../recruiter-model'
import { dateLabel, expired, initials, validateDraft } from '../recruiter-model'
import {
  parseRecruiterRoute,
  recruiterJobUrl,
  recruiterReturnUrl,
  recruiterSectionUrl,
  recruiterUrl,
  type RecruiterSection as Section,
} from '../recruiter-route'
import '../styles/recruiter-workspace.css'
const RecruiterJobCreate = lazy(() =>
  import('../components/RecruiterJobCreate').then((module) => ({
    default: module.RecruiterJobCreate,
  })),
)
const RecruiterJobCandidates = lazy(() =>
  import('../components/RecruiterJobCandidates').then((module) => ({
    default: module.RecruiterJobCandidates,
  })),
)
const nav = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'jobs', label: 'Tin tuyển dụng', icon: BriefcaseBusiness },
  { id: 'candidates', label: 'Tất cả đơn ứng tuyển', icon: Users },
  { id: 'profile', label: 'Hồ sơ HR', icon: UserRound },
] as const
const statusLabels: Record<JobStatus, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đang tuyển',
  CLOSED: 'Đã đóng',
}
export function RecruiterPage() {
  const location = useLocation()
  const navigateUrl = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const route = parseRecruiterRoute(location.pathname, location.search)
  const { section } = route

  const selectedApplication = route.kind === 'application' ? route.id : ''
  const applicationTab = route.tab
  const detailTab = route.tab
  const applicationJobId = route.filterJobId
  const isDetail = route.kind !== 'section'
  const backUrl = recruiterReturnUrl(searchParams.get('from'))
  const returnRoute = parseRecruiterRoute(backUrl.split('?')[0], backUrl.split('?')[1])
  const activeSection = selectedApplication && returnRoute.kind === 'job' ? 'jobs' : section
  const headingRef = useRef<HTMLHeadingElement>(null)
  useDocumentTitle(
    route.kind === 'job'
      ? 'Chi tiết tin tuyển dụng'
      : selectedApplication
        ? 'Hồ sơ ứng tuyển'
        : 'Nhà tuyển dụng',
  )
  useEffect(() => {
    window.scrollTo(0, 0)
    headingRef.current?.focus()
  }, [location.pathname])
  const { user, signOut, isSigningOut } = useAuth()
  const [creating, setCreating] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [discardForm, setDiscardForm] = useState(false)
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [editingJob, setEditingJob] = useState<RecruiterJob | undefined>()
  const [confirmJob, setConfirmJob] = useState<{
    job: RecruiterJob
    status: JobStatus
  } | null>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [actionError, setActionError] = useState('')
  const [openingJob, setOpeningJob] = useState(false)
  const [departmentResult, setDepartmentResult] = useState<{
    key: string
    items: Department[]
    error: boolean
  }>({ key: '', items: [], error: false })
  const [page, setPage] = useState(0)
  const [jobResult, setJobResult] = useState<{
    key: string
    response: PaginatedResponse<Job> | null
    error: string
  }>({ key: '', response: null, error: '' })
  const [summaryResult, setSummaryResult] = useState<{
    key: string
    total: number | null
  }>({
    key: '',
    total: null,
  })
  const [applicationSummary, setApplicationSummary] = useState<ApplicationSummary | null>(null)
  const [reload, setReload] = useState(0)
  const [jobDetail, setJobDetail] = useState<{
    key: string
    data?: RecruiterJob
    error?: string
  } | null>(null)
  const jobDetailKey = `${route.id}:${reload}`
  const currentJobDetail = jobDetail?.key === jobDetailKey ? jobDetail : null
  const viewingJob = route.kind === 'job' ? (currentJobDetail?.data ?? null) : null
  const viewLoading = route.kind === 'job' && !currentJobDetail
  const viewError = route.kind === 'job' ? (currentJobDetail?.error ?? '') : ''
  useEffect(() => {
    if (route.kind !== 'job') return
    let active = true
    getRecruiterJob(route.id)
      .then((data) => {
        if (active) setJobDetail({ key: jobDetailKey, data })
      })
      .catch((reason) => {
        if (active)
          setJobDetail({
            key: jobDetailKey,
            error: reason instanceof Error ? reason.message : 'Không tải được chi tiết tin.',
          })
      })
    return () => {
      active = false
    }
  }, [route.kind, route.id, jobDetailKey])
  function setApplicationJobId(id: string) {
    setSearchParams(() => {
      const next = new URLSearchParams(window.location.search)
      if (id) next.set('jobId', id)
      else next.delete('jobId')
      next.delete('page')
      return next
    })
  }
  function setDetailTab(tab: string) {
    const next = new URLSearchParams(location.search)
    next.set('tab', tab)
    next.delete('page')
    next.delete('search')
    next.delete('stage')
    navigateUrl(`${location.pathname}?${next}`)
  }
  function setApplicationTab(tab: string) {
    const next = new URLSearchParams(location.search)
    next.set('tab', tab)
    navigateUrl(`${location.pathname}?${next}`)
  }
  const pageSize = section === 'overview' ? 4 : 8
  const summaryKey = JSON.stringify([reload])
  const requestKey = JSON.stringify([section, query, department, status, page, pageSize, reload])
  const departments = departmentResult.key === summaryKey ? departmentResult.items : []
  const departmentError = departmentResult.key === summaryKey && departmentResult.error
  const publishedTotal = summaryResult.key === summaryKey ? summaryResult.total : null
  const loading = jobResult.key !== requestKey
  const response = loading ? null : jobResult.response
  const error = loading ? '' : jobResult.error
  useEffect(() => {
    let cancelled = false
    getApplicationSummary()
      .then((data) => {
        if (!cancelled) setApplicationSummary(data)
      })
      .catch(() => {
        if (!cancelled) setApplicationSummary(null)
      })
    getJobs(new URLSearchParams({ size: '1' }))
      .then((result) => {
        if (!cancelled) setSummaryResult({ key: summaryKey, total: result.totalElements })
      })
      .catch(() => {
        if (!cancelled) setSummaryResult({ key: summaryKey, total: null })
      })
    getDepartments()
      .then((result) => {
        if (!cancelled) setDepartmentResult({ key: summaryKey, items: result, error: false })
      })
      .catch(() => {
        if (!cancelled) {
          setDepartmentResult({ key: summaryKey, items: [], error: true })
        }
      })
    return () => {
      cancelled = true
    }
  }, [reload, summaryKey])
  useEffect(() => {
    if (isDetail || section === 'candidates' || section === 'profile') return
    let cancelled = false
    const params = new URLSearchParams({
      page: String(page),
      size: String(pageSize),
    })
    if (query.trim()) params.set('keyword', query.trim())
    if (department) params.set('departmentId', department)
    if (status) params.set('status', status)
    getRecruiterJobs(params)
      .then((result) => {
        if (!cancelled) setJobResult({ key: requestKey, response: result, error: '' })
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setJobResult({
            key: requestKey,
            response: null,
            error: reason instanceof Error ? reason.message : 'Không tải được tin tuyển dụng.',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [isDetail, section, query, department, status, page, pageSize, reload, requestKey])
  const jobStatus = (job: Job): JobStatus => (job as RecruiterJob).status
  const visibleJobs = response?.content ?? []
  const jobCount = response?.totalElements ?? 0
  const totalPages = response?.totalPages ?? 0
  const waiting =
    (applicationSummary?.stages.SUBMITTED ?? 0) + (applicationSummary?.stages.REVIEWING ?? 0)
  const realSelected = !!selectedApplication
  function selectApplication(id: string, tab = 'cv') {
    navigateUrl(
      recruiterUrl(`/recruiter/applications/${encodeURIComponent(id)}`, {
        tab,
        from: `${location.pathname}${location.search}`,
      }),
    )
  }
  function allJobApplications() {
    if (viewingJob) navigateUrl(recruiterJobUrl(String(viewingJob.id), 'applicants'))
  }
  function resetNavigation() {
    setPage(0)
    setQuery('')
    setDepartment('')
    setStatus('')
    setNotice('')
  }
  function navigate(next: Section) {
    resetNavigation()
    navigateUrl(recruiterSectionUrl(next))
  }
  async function changeJobStatus(job: RecruiterJob, next: JobStatus) {
    if (saving) return
    {
      setSaving(true)
      setActionError('')
      try {
        const action = next === 'CLOSED' ? 'close' : job.status === 'CLOSED' ? 'reopen' : 'publish'
        const saved = await transitionRecruiterJob(job, action)
        setConfirmJob(null)
        setReload((value) => value + 1)
        setPage(0)
        setNotice(
          next === 'CLOSED'
            ? `Đã đóng “${saved.title}”. Tin đã ẩn khỏi trang tìm việc.`
            : `Đã ${action === 'reopen' ? 'mở lại' : 'đăng'} “${saved.title}”. Ứng viên có thể xem trên trang tìm việc.`,
        )
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : 'Không đổi được trạng thái tin. Vui lòng thử lại.',
        )
        if (error instanceof ApiError && error.status === 409) setReload((value) => value + 1)
      } finally {
        setSaving(false)
      }
      return
    }
  }
  async function editJob(job: RecruiterJob) {
    if (openingJob || saving) return
    setActionError('')
    setSaveError('')
    {
      setOpeningJob(true)
      try {
        job = await getRecruiterJob(String(job.id))
        if (job.status === 'PUBLISHED') {
          setActionError('Hãy đóng tin đang tuyển trước khi sửa nội dung.')
          setReload((value) => value + 1)
          return
        }
      } catch (error) {
        setActionError(error instanceof Error ? error.message : 'Không tải được tin để sửa.')
        return
      } finally {
        setOpeningJob(false)
      }
    }
    setEditingJob(job)
    setFormDirty(false)
    setDiscardForm(false)
    setCreating(true)
  }
  function requestStatus(job: RecruiterJob) {
    setActionError('')
    setConfirmJob({ job, status: job.status === 'PUBLISHED' ? 'CLOSED' : 'PUBLISHED' })
  }
  function startCreate() {
    setEditingJob(undefined)
    setFormDirty(false)
    setDiscardForm(false)
    setSaveError('')
    setCreating(true)
  }
  async function addDepartment(name: string) {
    const saved = await createRecruiterDepartment(name)
    setDepartmentResult((previous) => ({
      key: summaryKey,
      items: [...previous.items, saved].sort((a, b) => a.name.localeCompare(b.name)),
      error: false,
    }))
    return saved
  }
  async function saveDraft(draft: JobDraft) {
    if (saving) return
    setSaving(true)
    setSaveError('')
    try {
      const wasEditing = !!editingJob
      const saved = editingJob
        ? await updateRecruiterJob(editingJob, draft)
        : await createRecruiterJob(draft)
      setCreating(false)
      setFormDirty(false)
      setDiscardForm(false)
      setEditingJob(undefined)
      if (route.kind !== 'job' || !wasEditing) navigate('jobs')
      setReload((value) => value + 1)
      setNotice(
        wasEditing
          ? `Đã lưu thay đổi “${saved.title}”. Tin giữ trạng thái ${statusLabels[saved.status].toLowerCase()}.`
          : `Đã lưu bản nháp “${saved.title}”. Tin chưa hiển thị cho ứng viên.`,
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setReload((value) => value + 1)
      setSaveError(
        error instanceof ApiError && error.errors?.length
          ? `${error.message} ${error.errors.map((item) => item.message).join(' ')}`
          : error instanceof ApiError && error.status === 409
            ? `${error.message} Nội dung đang soạn vẫn được giữ. Đóng form và mở lại tin để lấy phiên bản mới.`
            : error instanceof Error
              ? error.message
              : 'Không lưu được tin. Nội dung đang soạn vẫn được giữ.',
      )
    } finally {
      setSaving(false)
    }
  }
  function viewJob(job: Job, tab = 'content') {
    navigateUrl(recruiterJobUrl(String(job.id), tab))
  }
  const jobPanel = (
    <section className="hr-panel" aria-labelledby="hr-jobs-heading">
      <div className="hr-panel-heading">
        <div>
          <h2 id="hr-jobs-heading">{'Tin tuyển dụng của công ty'}</h2>
          <p>{'Bản nháp, tin đang tuyển và tin đã đóng của Lumi Studio.'}</p>
        </div>
        {section === 'overview' ? (
          <button className="hr-text-button" onClick={() => navigate('jobs')}>
            Xem tất cả <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="hr-icon-button"
            aria-label="Tải lại tin tuyển dụng"
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw size={17} />
          </button>
        )}
      </div>
      {section === 'jobs' && (
        <div className="hr-filter-bar">
          <label className="hr-search">
            <Search size={17} />
            <input
              aria-label="Tìm tin tuyển dụng"
              placeholder="Tên vị trí hoặc kỹ năng…"
              maxLength={200}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(0)
              }}
            />
          </label>
          <select
            aria-label="Lọc phòng ban"
            value={department}
            disabled={departmentError}
            onChange={(event) => {
              setDepartment(event.target.value)
              setPage(0)
            }}
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {
            <select
              aria-label="Lọc trạng thái tin"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(0)
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          }
          {(query || department || status) && (
            <button
              className="hr-icon-button"
              aria-label="Xóa bộ lọc tin"
              onClick={() => {
                setQuery('')
                setDepartment('')
                setStatus('')
                setPage(0)
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>
      )}
      {departmentError && section === 'jobs' && (
        <p className="hr-filter-error">
          Không tải được phòng ban.{' '}
          <button onClick={() => setReload((value) => value + 1)}>Thử lại</button>
        </p>
      )}
      {loading ? (
        <div className="hr-empty" role="status">
          <LoaderCircle className="hr-spinner" size={25} />
          <p>Đang tải tin tuyển dụng…</p>
        </div>
      ) : error ? (
        <div className="hr-empty" role="alert">
          <Info size={27} />
          <h3>Chưa tải được danh sách tin</h3>
          <p>{error}</p>
          <button className="hr-button secondary" onClick={() => setReload((value) => value + 1)}>
            <RefreshCw size={16} /> Thử lại
          </button>
        </div>
      ) : visibleJobs.length ? (
        <>
          <div className="hr-table-scroll">
            <table className={`hr-table ${section === 'jobs' ? 'hr-jobs-table' : ''}`}>
              <thead>
                <tr>
                  <th scope="col">Vị trí tuyển dụng</th>
                  <th scope="col">Hình thức</th>
                  {section === 'jobs' && (
                    <>
                      <th scope="col">Hồ sơ</th>
                      <th scope="col">Hạn nộp</th>
                      <th scope="col">Cập nhật</th>
                    </>
                  )}
                  <th scope="col">Trạng thái</th>
                  <th scope="col">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <button className="hr-job-title" onClick={() => void viewJob(job)}>
                        {job.title}
                      </button>
                      <small>
                        {job.category} · {job.level} · Tuyển {job.headcount ?? '—'} người
                      </small>
                      <div className="hr-skill-tags">
                        {job.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                        {job.tags.length > 3 && <span>+{job.tags.length - 3}</span>}
                      </div>
                    </td>
                    <td>
                      {job.mode}
                      <small>{job.location}</small>
                    </td>
                    {section === 'jobs' && (
                      <>
                        <td>
                          {
                            <button
                              className="hr-text-button"
                              aria-label={`Xem hồ sơ cho ${job.title}`}
                              onClick={() => void viewJob(job, 'applicants')}
                            >
                              {applicationSummary
                                ? (applicationSummary.jobs.find((j) => j.jobId === String(job.id))
                                    ?.count ?? 0)
                                : '—'}
                            </button>
                          }
                        </td>
                        <td>
                          <span className={expired(job.deadline) ? 'hr-warning-text' : ''}>
                            {job.deadline ? dateLabel(job.deadline) : 'Không giới hạn'}
                          </span>
                        </td>
                        <td>{dateLabel((job as RecruiterJob).updatedAt, true)}</td>
                      </>
                    )}
                    <td>
                      <span className={`hr-status hr-status-${jobStatus(job).toLowerCase()}`}>
                        <span />
                        {statusLabels[jobStatus(job)]}
                      </span>
                    </td>
                    <td>
                      <div className="hr-row-actions">
                        <button
                          className="hr-icon-button"
                          aria-label={`Xem tin ${job.title}`}
                          onClick={() => void viewJob(job)}
                        >
                          <Eye size={18} />
                        </button>
                        {section === 'jobs' && (
                          <>
                            {jobStatus(job) !== 'PUBLISHED' && (
                              <button
                                className="hr-icon-button"
                                aria-label={`Sửa tin ${job.title}`}
                                disabled={openingJob || saving}
                                onClick={() => void editJob(job as RecruiterJob)}
                              >
                                <Pencil size={17} />
                              </button>
                            )}
                            <button
                              className="hr-text-button"
                              disabled={openingJob || saving}
                              onClick={() => requestStatus(job as RecruiterJob)}
                            >
                              {jobStatus(job) === 'PUBLISHED'
                                ? 'Đóng'
                                : jobStatus(job) === 'CLOSED'
                                  ? 'Mở lại'
                                  : 'Đăng'}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {section === 'jobs' && (
            <div className="hr-pagination">
              <span>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, jobCount)} / {jobCount} tin
              </span>
              <div>
                <button
                  className="hr-icon-button"
                  aria-label="Trang trước"
                  disabled={page === 0}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {page + 1} / {Math.max(totalPages, 1)}
                </span>
                <button
                  className="hr-icon-button"
                  aria-label="Trang sau"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="hr-empty">
          <span className="hr-empty-icon">
            <BriefcaseBusiness size={27} />
          </span>
          <h3>
            {query || department || status ? 'Không có tin phù hợp' : 'Chưa có tin tuyển dụng'}
          </h3>
          <p>
            {query || department || status
              ? 'Thử đổi từ khóa hoặc bỏ bộ lọc để xem các tin khác.'
              : 'Tạo bản nháp đầu tiên để chuẩn bị nội dung tuyển dụng.'}
          </p>
          {query || department || status ? (
            <button
              className="hr-button secondary"
              onClick={() => {
                setQuery('')
                setDepartment('')
                setStatus('')
                setPage(0)
              }}
            >
              Xóa bộ lọc
            </button>
          ) : (
            <button
              className="hr-button secondary"
              onClick={() => {
                startCreate()
              }}
            >
              <FlaskConical size={16} />
              {'Tạo bản nháp'}
            </button>
          )}
        </div>
      )}
      {
        <div className="hr-panel-note">
          <Info size={14} />
          Bản nháp chỉ hiển thị trong khu vực HR. Tin đã đăng sẽ xuất hiện trên trang tìm việc.
        </div>
      }
    </section>
  )
  return (
    <div className="hr-workspace">
      <a className="hr-skip" href="#hr-content">
        Đến nội dung chính
      </a>
      <aside className="hr-sidebar">
        <Brand light />
        <div className="hr-company">
          <span>LS</span>
          <div>
            <strong>Lumi Studio</strong>
            <small>Không gian tuyển dụng</small>
          </div>
        </div>
        {user?.role === 'COMPANY_ADMIN' && (
          <Link to="/admin" className="hr-admin-entry">
            <ShieldCheck size={19} />
            <span>Trang quản trị</span>
            <ArrowUpRight size={16} />
          </Link>
        )}
        <span className="hr-nav-label">TUYỂN DỤNG</span>
        <nav aria-label="Điều hướng HR">
          {nav.map((item) => (
            <button
              key={item.id}
              aria-current={activeSection === item.id ? 'page' : undefined}
              className={activeSection === item.id ? 'active' : ''}
              disabled={openingJob || saving}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="hr-sidebar-bottom">
          <Link to="/" className="hr-back">
            Trang tìm việc <ArrowUpRight size={16} />
          </Link>
          <div className="hr-account">
            <span className="hr-avatar">{initials(user?.fullName ?? 'Nhân sự')}</span>
            <div>
              <strong>{user?.fullName}</strong>
              <small>
                {user?.role === 'COMPANY_ADMIN' ? 'Quản trị viên' : 'Nhân sự tuyển dụng'}
              </small>
            </div>
            <button
              className="hr-icon-button"
              aria-label="Đăng xuất"
              title="Đăng xuất"
              disabled={isSigningOut}
              onClick={() => void signOut()}
            >
              {isSigningOut ? (
                <LoaderCircle className="hr-spinner" size={18} />
              ) : (
                <LogOut size={18} />
              )}
            </button>
          </div>
        </div>
      </aside>
      <div className="hr-main">
        <header className="hr-topbar">
          <div className="hr-breadcrumb">
            Tuyển dụng <ChevronRight size={14} />
            <strong>{nav.find((item) => item.id === activeSection)?.label}</strong>
          </div>

          <button
            className="hr-icon-button hr-mobile-logout"
            aria-label="Đăng xuất trên điện thoại"
            title="Đăng xuất"
            disabled={isSigningOut}
            onClick={() => void signOut()}
          >
            {isSigningOut ? (
              <LoaderCircle className="hr-spinner" size={18} />
            ) : (
              <LogOut size={18} />
            )}
          </button>
        </header>
        <main className="hr-content" id="hr-content" tabIndex={-1}>
          <div className="hr-page-heading">
            <div>
              <span className="hr-eyebrow">LUMI STUDIO / RECRUITMENT</span>
              <h1 ref={headingRef} tabIndex={-1}>
                {route.kind === 'job'
                  ? (viewingJob?.title ?? 'Chi tiết tin tuyển dụng')
                  : selectedApplication
                    ? 'Hồ sơ ứng tuyển'
                    : route.kind === 'missing'
                      ? 'Không tìm thấy trang'
                      : section === 'overview'
                        ? 'Tổng quan tuyển dụng'
                        : section === 'jobs'
                          ? 'Tin tuyển dụng'
                          : section === 'candidates'
                            ? 'Tất cả đơn ứng tuyển'
                            : 'Hồ sơ HR'}
              </h1>
              <p>
                {isDetail
                  ? 'Thông tin tuyển dụng và hồ sơ đã lưu của công ty.'
                  : section === 'overview'
                    ? 'Theo dõi vị trí đang tuyển và hồ sơ cần xem xét.'
                    : section === 'jobs'
                      ? 'Nội dung rõ ràng giúp kết nối với ứng viên phù hợp.'
                      : section === 'candidates'
                        ? 'Tra cứu đơn ứng tuyển của tất cả công việc trong công ty. Chọn một tin tuyển dụng để xem tổng hợp và so sánh ứng viên của tin đó.'
                        : 'Thông tin tài khoản và hồ sơ nhân sự tuyển dụng.'}
              </p>
            </div>
            <div className="hr-create">
              <button
                className="hr-button"
                title={'Tạo bản nháp tuyển dụng'}
                disabled={openingJob || saving}
                onClick={startCreate}
              >
                <Plus size={17} />
                {'Tạo tin mới'}
              </button>
            </div>
          </div>
          <div className={`hr-source-note ${''}`}>
            <span className="hr-source-icon">{<Info size={18} />}</span>
            <div>
              <strong>{'Đang xem dữ liệu tuyển dụng thật'}</strong>
              <p>
                {
                  'Tin tuyển dụng, đơn ứng tuyển, ghi chú và chuyển vòng đã lưu thật. CV tại lúc nộp được giữ nguyên. Mở từng hồ sơ để phân tích AI và xem kết quả đã lưu.'
                }
              </p>
            </div>
          </div>
          {openingJob && <p role="status">Đang tải nội dung tin để chỉnh sửa…</p>}
          {actionError && !confirmJob && (
            <p className="hr-form-error" role="alert">
              {actionError}
            </p>
          )}
          {notice && (
            <div className="hr-notice" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <button
                className="hr-icon-button"
                aria-label="Ẩn thông báo"
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!isDetail && section === 'overview' && (
            <>
              <div className="hr-stats">
                <div className="hr-stat">
                  <span>
                    Tin {'đã công khai'}
                    <BriefcaseBusiness size={19} />
                  </span>
                  <strong>{publishedTotal ?? '—'}</strong>
                  <small>{'Đang hiển thị cho ứng viên'}</small>
                </div>
                <div className="hr-stat">
                  <span>
                    Hồ sơ {'ứng tuyển'}
                    <Users size={19} />
                  </span>
                  <strong>{applicationSummary?.total ?? '—'}</strong>
                  <small>{'Đơn đã lưu và CV tại lúc nộp'}</small>
                </div>
                <div className="hr-stat">
                  <span>
                    Chờ xem xét
                    <Clock3 size={19} />
                  </span>
                  <strong>{applicationSummary ? waiting : '—'}</strong>
                  <small>{'Hồ sơ đã nộp hoặc đang xem xét'}</small>
                </div>
              </div>
              <div className="hr-overview-grid">
                {jobPanel}
                <aside className="hr-overview-aside">
                  <section className="hr-panel">
                    <div className="hr-panel-heading">
                      <div>
                        <h2>Hồ sơ cần xem xét</h2>
                        <p>{'Theo dõi hồ sơ mới tại đây'}</p>
                      </div>
                      <Users size={18} />
                    </div>
                    {
                      <div className="hr-aside-empty">
                        <FileText size={27} />
                        <p>
                          {applicationSummary
                            ? `${applicationSummary.total} hồ sơ đã nhận · ${waiting} cần xem xét.`
                            : 'Chưa tải được số liệu hồ sơ.'}
                        </p>
                        <button
                          className="hr-text-button"
                          onClick={() => {
                            navigate('candidates')
                          }}
                        >
                          Xem tất cả đơn ứng tuyển <ArrowRight size={16} />
                        </button>
                      </div>
                    }
                  </section>
                </aside>
              </div>
            </>
          )}
          {!isDetail && section === 'jobs' && jobPanel}
          {!isDetail && section === 'candidates' && (
            <RecruiterApplications
              refreshKey={reload}
              jobId={applicationJobId}
              onJobId={setApplicationJobId}
              onSelect={selectApplication}
            />
          )}
          {!isDetail && section === 'profile' && <RecruiterRealProfile />}
          {isDetail && (
            <div className="hr-detail-navigation">
              <Link
                className="hr-text-button"
                to={selectedApplication ? backUrl : recruiterSectionUrl('jobs')}
              >
                <ChevronLeft size={16} />
                {selectedApplication
                  ? returnRoute.kind === 'job'
                    ? returnRoute.tab === 'ai'
                      ? 'Quay lại tổng hợp AI của tin'
                      : 'Quay lại tin tuyển dụng'
                    : returnRoute.section === 'overview'
                      ? 'Quay lại tổng quan'
                      : 'Quay lại danh sách đơn ứng tuyển'
                  : 'Quay lại danh sách tin'}
              </Link>
              {selectedApplication && (
                <Link className="hr-text-button" to={recruiterSectionUrl('candidates')}>
                  Tất cả đơn ứng tuyển <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
          {route.kind === 'job' && viewLoading && <p role="status">Đang tải chi tiết tin…</p>}
          {route.kind === 'job' && viewError && (
            <section className="hr-panel hr-detail-error" role="alert">
              <h2>Không mở được tin tuyển dụng</h2>
              <p>{viewError}</p>
              {
                <button
                  className="hr-button secondary"
                  onClick={() => setReload((value) => value + 1)}
                >
                  Thử lại
                </button>
              }
            </section>
          )}
          {viewingJob && (
            <section className="hr-detail-page hr-job-page" aria-label="Chi tiết tin tuyển dụng">
              {
                <>
                  <span className={`hr-status hr-status-${jobStatus(viewingJob).toLowerCase()}`}>
                    <span />
                    {statusLabels[jobStatus(viewingJob)]}
                  </span>
                  <div className="hr-detail-tabs" role="group" aria-label="Nội dung tin">
                    {[
                      ['content', 'Thông tin'],
                      ['applicants', 'Ứng viên'],
                      ['ai', 'Tổng hợp AI'],
                      ['history', 'Lịch sử chỉnh sửa'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        aria-pressed={detailTab === value}
                        className={detailTab === value ? 'active' : ''}
                        onClick={() => setDetailTab(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              }
              {viewError && (
                <p className="hr-field-error" role="alert">
                  {viewError}
                </p>
              )}
              {detailTab === 'content' && (
                <RecruiterJobPreview job={viewingJob} internal showHeading />
              )}
              {detailTab === 'history' && <Timeline items={(viewingJob as RecruiterJob).history} />}
              {detailTab === 'applicants' && (
                <>
                  <RecruiterApplications
                    refreshKey={reload}
                    jobId={String(viewingJob.id)}
                    onJobId={() => {}}
                    lockedJob
                    onSelect={selectApplication}
                  />
                </>
              )}
              {detailTab === 'ai' && (
                <Suspense fallback={<p role="status">Đang mở tổng hợp ứng viên…</p>}>
                  <RecruiterJobCandidates
                    refreshKey={reload}
                    jobId={String(viewingJob.id)}
                    title={viewingJob.title}
                    onSelect={selectApplication}
                    onAll={allJobApplications}
                  />
                </Suspense>
              )}
              <div className="hr-detail-actions">
                <p>
                  {jobStatus(viewingJob) === 'PUBLISHED'
                    ? 'Tin đang công khai. Đóng tin trước khi chỉnh sửa nội dung.'
                    : jobStatus(viewingJob) === 'CLOSED'
                      ? 'Tin đã đóng. Có thể sửa nội dung trước khi mở lại.'
                      : 'Bản nháp chưa hiển thị cho ứng viên. Kiểm tra nội dung trước khi đăng.'}
                </p>
                <div className="hr-row-actions">
                  {jobStatus(viewingJob) !== 'PUBLISHED' && (
                    <button
                      className="hr-button secondary"
                      disabled={openingJob || viewLoading || !!viewError}
                      onClick={() => void editJob(viewingJob as RecruiterJob)}
                    >
                      <Pencil size={16} />
                      {'Sửa nội dung'}
                    </button>
                  )}
                  <button
                    className="hr-button"
                    disabled={openingJob || viewLoading || !!viewError}
                    onClick={() => requestStatus(viewingJob as RecruiterJob)}
                  >
                    {jobStatus(viewingJob) === 'PUBLISHED'
                      ? 'Đóng tin'
                      : jobStatus(viewingJob) === 'CLOSED'
                        ? 'Mở lại tin'
                        : 'Đăng tin'}
                  </button>
                </div>
              </div>
            </section>
          )}
          {realSelected && (
            <section className="hr-detail-page hr-application-page" aria-label="Hồ sơ ứng tuyển">
              <SubmittedApplicationDetail
                key={selectedApplication}
                id={selectedApplication}
                staff
                initialTab={applicationTab}
                onTabChange={setApplicationTab}
                onChanged={() => setReload((n) => n + 1)}
              />
            </section>
          )}

          {route.kind === 'missing' && (
            <section className="hr-panel" role="alert">
              <p>
                Đường dẫn không hợp lệ. Chọn Tin tuyển dụng hoặc Tất cả đơn ứng tuyển để tiếp tục.
              </p>
            </section>
          )}
          <footer className="hr-footer">
            <span>Lumi Studio · Không gian nhà tuyển dụng</span>
            <span>{'Tin tuyển dụng · Lưu database'}</span>
          </footer>
        </main>
      </div>
      {creating && (
        <Modal
          title={editingJob ? 'Chỉnh sửa tin tuyển dụng' : 'Tạo tin tuyển dụng'}
          wide
          onClose={() => {
            if (!saving) {
              if (formDirty) setDiscardForm(true)
              else setCreating(false)
            }
          }}
        >
          {discardForm && (
            <div className="hr-discard" role="alert">
              <h3>Bỏ các thay đổi chưa lưu?</h3>
              <p>Nội dung bạn đang soạn sẽ mất nếu đóng form.</p>
              <div className="hr-row-actions">
                <button className="hr-button secondary" onClick={() => setDiscardForm(false)}>
                  Tiếp tục soạn
                </button>
                <button
                  className="hr-button"
                  onClick={() => {
                    setCreating(false)
                    setFormDirty(false)
                    setDiscardForm(false)
                  }}
                >
                  Bỏ thay đổi
                </button>
              </div>
            </div>
          )}
          <div hidden={discardForm}>
            {editingJob ? (
              <RecruiterJobForm
                onDirty={() => setFormDirty(true)}
                job={editingJob}
                departments={departments}
                departmentError={departmentError}
                onCreateDepartment={addDepartment}
                saving={saving}
                saveError={saveError}
                onSave={(draft) => void saveDraft(draft)}
                onCancel={() => (formDirty ? setDiscardForm(true) : setCreating(false))}
              />
            ) : (
              <Suspense fallback={<p role="status">Đang mở các cách tạo tin…</p>}>
                <RecruiterJobCreate
                  departments={departments}
                  departmentError={departmentError}
                  onCreateDepartment={addDepartment}
                  saving={saving}
                  saveError={saveError}
                  onDirty={() => setFormDirty(true)}
                  onSave={(draft) => void saveDraft(draft)}
                  onCancel={() => (formDirty ? setDiscardForm(true) : setCreating(false))}
                />
              </Suspense>
            )}
          </div>
        </Modal>
      )}
      {confirmJob && (
        <Modal
          title={`${confirmJob.status === 'CLOSED' ? 'Đóng' : confirmJob.job.status === 'CLOSED' ? 'Mở lại' : 'Đăng'} tin${''}?`}
          onClose={() => {
            if (!saving) {
              setConfirmJob(null)
              setActionError('')
            }
          }}
        >
          <div className="hr-job-detail">
            <h2>{confirmJob.job.title}</h2>
            <p>
              {confirmJob.status === 'CLOSED'
                ? 'Tin sẽ ẩn khỏi trang tìm việc. Nội dung và lịch sử vẫn được giữ.'
                : 'Tin sẽ công khai trên trang tìm việc. Hãy kiểm tra nội dung và hạn nhận hồ sơ trước khi xác nhận.'}
            </p>
            {actionError && (
              <p className="hr-form-error" role="alert">
                {actionError}
              </p>
            )}
            {confirmJob.status === 'PUBLISHED' &&
            Object.keys(validateDraft(confirmJob.job.draft, true)).length > 0 ? (
              <>
                <p className="hr-form-error" role="alert">
                  {Object.values(validateDraft(confirmJob.job.draft, true)).join(' ')}
                </p>
                <div className="hr-form-actions">
                  <button
                    className="hr-button"
                    onClick={() => {
                      const job = confirmJob.job
                      setConfirmJob(null)
                      void editJob(job)
                    }}
                  >
                    Sửa nội dung tin
                  </button>
                </div>
              </>
            ) : (
              <div className="hr-form-actions">
                <button
                  className="hr-button secondary"
                  disabled={saving}
                  onClick={() => {
                    setConfirmJob(null)
                    setActionError('')
                  }}
                >
                  Hủy
                </button>
                <button
                  className="hr-button"
                  disabled={saving}
                  onClick={() => void changeJobStatus(confirmJob.job, confirmJob.status)}
                >
                  {saving
                    ? 'Đang xử lý…'
                    : `Xác nhận ${confirmJob.status === 'CLOSED' ? 'đóng' : confirmJob.job.status === 'CLOSED' ? 'mở lại' : 'đăng'} tin${''}`}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
