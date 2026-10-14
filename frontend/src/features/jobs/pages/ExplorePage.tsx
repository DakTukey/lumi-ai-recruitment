import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Check,
  CircleCheck,
  Code2,
  FileText,
  LaptopMinimal,
  LayoutGrid,
  MapPin,
  Megaphone,
  MoveUpRight,
  Palette,
  ScanLine,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../app/providers/auth-context'
import { useSavedJobs } from '../../../app/providers/saved-jobs-context'
import type { Department } from '../../../services/job.service'
import { getDepartments, getJobs, workModes } from '../../../services/job.service'
import { jobDetailPath } from '../candidate-job-route'
import { JobCard } from '../components/JobCard'
import type { JobListResult } from '../job-browse-state'
import { readJobBrowseSnapshot, saveJobBrowseSnapshot } from '../job-browse-state'
import { appendJobPage, JOB_PAGE_SIZE } from '../job-list-pagination'
import '../styles/candidate-home.css'
import '../styles/candidate-job-list.css'
const categoryIcons = [LayoutGrid, Code2, Palette, ChartNoAxesCombined, Megaphone]
export function ExplorePage({ savedOnly = false }: { savedOnly?: boolean }) {
  const { saved } = useSavedJobs()
  const [params] = useSearchParams()

  const savedCount = saved.filter((id) => typeof id === 'string').length
  const returnJobId = params.get('jobId')
  const location = useLocation()
  const { user } = useAuth()
  const [snapshot] = useState(() => readJobBrowseSnapshot(location.key, user?.id))
  const restoreScroll = useRef(snapshot?.scrollY)
  const [query, setQuery] = useState(snapshot?.query ?? '')
  const [category, setCategory] = useState(snapshot?.category ?? 'Tất cả')
  const [levels, setLevels] = useState<string[]>(snapshot?.levels ?? [])
  const [modes, setModes] = useState<string[]>(snapshot?.modes ?? [])
  const [salary, setSalary] = useState(snapshot?.salary ?? false)
  const [sort, setSort] = useState(snapshot?.sort ?? 'featured')
  const [filtersOpen, setFiltersOpen] = useState(snapshot?.filtersOpen ?? false)
  const [departments, setDepartments] = useState<Department[]>(snapshot?.departments ?? [])
  const [page, setPage] = useState(snapshot?.page ?? 0)
  const [retry, setRetry] = useState(snapshot?.retry ?? 0)
  const [departmentError, setDepartmentError] = useState('')
  const categories = ['Tất cả', ...departments.map((d) => d.name)]
  const filterKey = JSON.stringify({
    query,
    category,
    levels,
    modes,
    salary,
    sort,
    savedOnly,
    saved: savedOnly ? saved : [],
  })
  const [currentFilter, setCurrentFilter] = useState(snapshot?.filterKey ?? filterKey)
  // Reset pagination before fetching a changed filter, so a late response cannot replace it.
  if (currentFilter !== filterKey) {
    setCurrentFilter(filterKey)
    setPage(0)
  }
  useEffect(() => {
    let active = true
    getDepartments()
      .then((data) => {
        if (active) {
          setDepartments(data)
          setDepartmentError('')
        }
      })
      .catch(() => {
        if (active) setDepartmentError('Chưa tải được phòng ban. Vui lòng thử lại.')
      })
    return () => {
      active = false
    }
  }, [retry])
  const departmentId = departments.find((d) => d.name === category)?.id
  const requestKey = JSON.stringify([filterKey, departmentId, page, retry])
  const resultScope = JSON.stringify([filterKey, departmentId])
  const [result, setResult] = useState<JobListResult | null>(snapshot?.result ?? null)
  const emptySaved = savedOnly && !saved.some((id) => typeof id === 'string')
  const current = result?.scope === resultScope ? result : null
  const loading = !emptySaved && current?.key !== requestKey
  const jobs = emptySaved ? [] : (current?.jobs ?? [])
  const total = emptySaved ? 0 : (current?.total ?? 0)
  const pages = emptySaved ? 0 : (current?.pages ?? 0)
  const loadError = loading ? '' : (current?.error ?? '')
  useEffect(() => {
    let active = true
    const filter = JSON.parse(filterKey) as {
      query: string
      category: string
      levels: string[]
      modes: string[]
      salary: boolean
      sort: string
      savedOnly: boolean
      saved: (string | number)[]
    }
    if (filter.savedOnly && !filter.saved.some((id) => typeof id === 'string')) return
    const params = new URLSearchParams({
      keyword: filter.query,
      sort: filter.sort,
      page: String(page),
      size: String(JOB_PAGE_SIZE),
    })
    if (departmentId) params.set('departmentId', departmentId)
    filter.levels.forEach((level) => params.append('level', level.toUpperCase()))
    filter.modes.forEach((mode) => params.append('workMode', workModes[mode]))
    if (filter.salary) params.set('minSalary', '15000000')
    if (filter.savedOnly)
      params.set('ids', filter.saved.filter((id) => typeof id === 'string').join(','))
    getJobs(params)
      .then((data) => {
        if (active)
          setResult((previous) => ({
            key: requestKey,
            scope: resultScope,
            jobs: appendJobPage(
              page > 0 && previous?.scope === resultScope ? previous.jobs : [],
              data.content,
            ),
            total: data.totalElements,
            pages: data.totalPages,
            error: '',
          }))
      })
      .catch(() => {
        if (active)
          setResult((previous) => ({
            key: requestKey,
            scope: resultScope,
            jobs: page > 0 && previous?.scope === resultScope ? previous.jobs : [],
            total: previous?.scope === resultScope ? previous.total : 0,
            pages: previous?.scope === resultScope ? previous.pages : 0,
            error: 'Chưa tải được việc làm. Vui lòng thử lại.',
          }))
      })
    return () => {
      active = false
    }
  }, [filterKey, departmentId, page, retry, requestKey, resultScope])
  useEffect(() => {
    if (loading || restoreScroll.current == null) return
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, restoreScroll.current ?? 0)
      restoreScroll.current = undefined
    })
    return () => cancelAnimationFrame(frame)
  }, [loading])
  const rememberList = () =>
    saveJobBrowseSnapshot(
      location.key,
      {
        query,
        category,
        levels,
        modes,
        salary,
        sort,
        filtersOpen,
        page,
        retry,
        filterKey,
        result,
        departments,
        scrollY: window.scrollY,
      },
      user?.id,
    )
  const listPath = `${location.pathname}${location.search}${location.hash}`
  const filtered = jobs
  const reset = () => {
    setQuery('')
    setCategory('Tất cả')
    setLevels([])
    setModes([])
    setSalary(false)
  }
  const toggle = (value: string, list: string[], setter: (values: string[]) => void) =>
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  const activeCount = levels.length + modes.length + Number(salary)
  if (returnJobId) return <Navigate to={jobDetailPath(returnJobId)} replace />
  return (
    <div
      className={`candidate-home candidate-jobs-page${savedOnly ? ' candidate-saved-page' : ''}`}
    >
      <div className="container candidate-data-source">
        <div>
          <strong>{'Việc làm đang tuyển'}</strong>
          <p>{'Tin do HR đăng và còn hạn tuyển.'}</p>
        </div>
      </div>
      {!savedOnly && (
        <>
          <section className="hero">
            <div className="container hero-inner">
              <div className="hero-copy">
                <div className="hero-kicker">
                  <span className="eyebrow">LUMI STUDIO · CAREERS</span>
                  <span className="hero-vacancies">
                    <span className="status-dot" /> {total} {'vị trí đang mở'}
                  </span>
                </div>
                <h1>
                  Công việc phù hợp.
                  <br />
                  <span>Tương lai rộng mở.</span>
                  <svg className="heading-stroke" viewBox="0 0 360 13" aria-hidden="true">
                    <path d="M3 9 Q170 -3 356 6" />
                  </svg>
                </h1>
                <p>
                  Khám phá cơ hội tại Lumi Studio, hiểu thế mạnh
                  <br className="desktop-break" /> và tìm đội ngũ bạn thực sự thuộc về.
                </p>
                <div className="hero-actions">
                  <a className="button hero-primary" href="#opportunities">
                    Khám phá cơ hội <ArrowUpRight size={18} />
                  </a>
                  <Link className="hero-secondary" to="/hiring-process">
                    Cách chúng mình tuyển dụng <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="hero-benefits">
                  <span>
                    <CircleCheck size={16} />
                    Cơ hội rõ ràng
                  </span>
                  <span>
                    <CircleCheck size={16} />
                    Kết nối đúng năng lực
                  </span>
                </div>
              </div>
              <div className="hero-art" aria-label="Đối chiếu CV với công việc">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="art-star">
                  <Sparkles size={35} />
                </span>
                <div className="floating-label">
                  <span className="little-avatar">A</span>
                  <div>
                    Bước tiếp theo của bạn
                    <strong>
                      Đang ở rất gần <ArrowUpRight size={12} />
                    </strong>
                  </div>
                </div>
                <div className="match-preview">
                  <div className="preview-top">
                    <span className="preview-icon">
                      <ScanLine size={19} />
                    </span>
                    <span>lumi intelligence</span>
                    <span className="preview-demo">AI Match</span>
                  </div>
                  <div className="preview-job">
                    <div className="mini-mark">lumi</div>
                    <div>
                      <strong>Frontend Developer</strong>
                      <span>Lumi Studio · Đà Nẵng</span>
                    </div>
                  </div>
                  <div className="match-heading">
                    <span>Điểm chạm của bạn</span>
                    <span className="preview-pill">CV ↔ JD</span>
                  </div>
                  <div className="skill-track">
                    <span>
                      <Check size={13} /> React & TypeScript
                    </span>
                    <span>Phù hợp</span>
                  </div>
                  <div className="skill-track">
                    <span>
                      <Check size={13} /> Tư duy sản phẩm
                    </span>
                    <span>Phù hợp</span>
                  </div>
                  <div className="skill-track dim">
                    <span>
                      <Search size={13} /> Kinh nghiệm dự án
                    </span>
                    <span>Tìm hiểu thêm</span>
                  </div>
                  <div className="preview-bottom">
                    <Sparkles size={13} /> Hiểu rõ hơn, lựa chọn tốt hơn.
                  </div>
                </div>
                <div className="floating-cv">
                  <span>
                    <FileText size={18} />
                  </span>
                  <div>
                    Hơn cả một bản CV<small>Thế mạnh của bạn, được nhìn thấy.</small>
                  </div>
                  <div className="cv-check">
                    <Check size={13} />
                  </div>
                </div>
                <span className="art-caption">MỘT KẾT NỐI. NHIỀU KHẢ NĂNG.</span>
              </div>
            </div>
            <form
              className="container search-bar"
              onSubmit={(e) => {
                e.preventDefault()
                document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <label className="search-keyword">
                <Search size={21} />
                <input
                  aria-label="Vị trí hoặc kỹ năng"
                  maxLength={200}
                  placeholder="Vị trí hoặc kỹ năng bạn quan tâm"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => setQuery('')}
                  >
                    <X size={16} />
                  </button>
                )}
              </label>
              <div className="search-location" aria-label="Văn phòng Đà Nẵng">
                <MapPin size={20} />
                <span>Văn phòng Đà Nẵng</span>
              </div>
              <button className="button search-submit" type="submit">
                Tìm cơ hội của bạn <ArrowRight size={18} />
              </button>
            </form>
            <div className="container popular-search">
              <span>Thử tìm:</span>
              {['React', 'Python', 'Product Design', 'Spring Boot'].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setQuery(t)
                    document.getElementById('opportunities')?.scrollIntoView({ behavior: 'smooth' })
                  }}
                >
                  {t}
                  <ArrowUpRight size={11} />
                </button>
              ))}
            </div>
          </section>
          <section className="career-highlights" aria-label="Cơ hội tại Lumi Studio">
            <div className="container career-highlights-inner">
              <div className="career-highlight">
                <span className="highlight-icon">
                  <BriefcaseBusiness size={21} />
                </span>
                <div>
                  <strong>{total} cơ hội dành cho bạn</strong>
                  <span>Cùng xây dựng sản phẩm số</span>
                </div>
              </div>
              <div className="career-highlight">
                <span className="highlight-icon">
                  <MapPin size={21} />
                </span>
                <div>
                  <strong>Bắt đầu từ Đà Nẵng</strong>
                  <span>Kết nối cùng đội ngũ Lumi</span>
                </div>
              </div>
              <div className="career-highlight">
                <span className="highlight-icon">
                  <LaptopMinimal size={21} />
                </span>
                <div>
                  <strong>Linh hoạt cách làm việc</strong>
                  <span>Văn phòng · Hybrid · Remote</span>
                </div>
              </div>
              <Link className="text-link" to="/about">
                Gặp gỡ Lumi <ArrowUpRight size={17} />
              </Link>
            </div>
          </section>
        </>
      )}
      <section className="opportunities container" id="opportunities">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{savedOnly ? 'BỘ SƯU TẬP CỦA BẠN' : 'CƠ HỘI ĐANG CHỜ'}</span>
            <h2>
              {savedOnly ? 'Những cơ hội đã lưu' : 'Tìm nơi bạn muốn bắt đầu'}
              <span className="orange-dot">.</span>
            </h2>
            <p>
              {savedOnly
                ? 'Dành một chút thời gian cho những lựa chọn bạn yêu thích.'
                : 'Một công việc tốt bắt đầu từ một kết nối phù hợp.'}
            </p>
          </div>
          <Link className="text-link" to="/profile">
            Khám phá thế mạnh với AI <Sparkles size={16} />
          </Link>
        </div>
        {user?.role === 'CANDIDATE' && user.onboardingStatus === 'SKIPPED' && (
          <aside className="profile-completion-reminder" aria-labelledby="profile-reminder-title">
            <span className="profile-reminder-icon" aria-hidden="true">
              <FileText size={21} />
            </span>
            <div className="profile-reminder-copy">
              <h3 id="profile-reminder-title">Hồ sơ của bạn chưa hoàn tất</h3>
              <p>Bổ sung hồ sơ để nhà tuyển dụng hiểu bạn hơn.</p>
            </div>
            <Link className="profile-reminder-action" to="/profile">
              Bổ sung hồ sơ <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        )}
        {savedOnly && (
          <label className="saved-search">
            <Search size={18} />
            <input
              aria-label="Tìm trong việc đã lưu"
              maxLength={200}
              placeholder="Tìm trong việc đã lưu"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        {departmentError && (
          <p role="alert">
            {departmentError}{' '}
            <button className="text-button" onClick={() => setRetry(retry + 1)}>
              Thử lại
            </button>
          </p>
        )}
        <div className="category-tabs" aria-label="Lĩnh vực">
          {categories.map((c, i) => {
            const Icon = categoryIcons[i] ?? BriefcaseBusiness
            return (
              <button
                key={c}
                className={category === c ? 'active' : ''}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
              >
                <Icon size={17} />
                {c}
                {c === 'Tất cả' && <span>{total}</span>}
              </button>
            )
          })}
        </div>
        <div className="job-explorer">
          <aside id="job-filters" className={`filters ${filtersOpen ? 'filters-open' : ''}`}>
            <div className="filter-heading">
              <h3>
                <SlidersHorizontal size={17} /> Bộ lọc
              </h3>
              <button className="text-button" onClick={reset}>
                Đặt lại
              </button>
            </div>
            <fieldset>
              <legend>Kinh nghiệm</legend>
              {['Intern', 'Junior', 'Middle', 'Senior'].map((l) => (
                <label className="checkbox-row" key={l}>
                  <input
                    type="checkbox"
                    checked={levels.includes(l)}
                    onChange={() => toggle(l, levels, setLevels)}
                  />
                  <span>{l === 'Intern' ? 'Thực tập sinh' : l}</span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Hình thức làm việc</legend>
              {['Tại văn phòng', 'Hybrid', 'Remote'].map((m) => (
                <label className="checkbox-row" key={m}>
                  <input
                    type="checkbox"
                    checked={modes.includes(m)}
                    onChange={() => toggle(m, modes, setModes)}
                  />
                  <span>{m}</span>
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Mức lương</legend>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={salary}
                  onChange={(e) => setSalary(e.target.checked)}
                />
                <span>Từ 15 triệu / tháng</span>
              </label>
            </fieldset>
            <div className="filter-promo">
              <span className="spark-box">
                <Sparkles size={21} />
              </span>
              <h3>
                Cơ hội đúng người.
                <br />
                Bắt đầu từ bạn.
              </h3>
              <p>Hoàn thiện hồ sơ để sẵn sàng cho hành trình mới.</p>
              <Link to="/profile">
                Tạo dấu ấn của bạn <ArrowUpRight size={16} />
              </Link>
            </div>
          </aside>
          <div className="job-results">
            <div className="results-toolbar">
              <span>
                <strong>{total}</strong> cơ hội {savedOnly ? 'đã lưu' : 'dành cho bạn'}
                <span className="results-dot">·</span>
                <span className="muted">
                  {savedOnly ? 'Đã lưu trong phiên này' : 'Tin đang tuyển'}
                </span>
              </span>
              <div>
                <button
                  className="filter-mobile-toggle icon-button"
                  aria-label="Bật bộ lọc"
                  aria-expanded={filtersOpen}
                  aria-controls="job-filters"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <SlidersHorizontal size={18} />
                  Bộ lọc
                  {activeCount || ''}
                </button>
                <label>
                  Sắp xếp:
                  <select
                    aria-label="Sắp xếp việc làm"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="featured">Nổi bật</option>
                    <option value="salary">Lương cao nhất</option>
                    <option value="newest">Mới thêm</option>
                  </select>
                </label>
              </div>
            </div>
            {loading && !filtered.length ? (
              <p role="status">Đang tải việc làm…</p>
            ) : loadError && !filtered.length ? (
              <div role="alert" className="empty-state">
                <p>{loadError}</p>
                <button className="button" onClick={() => setRetry(retry + 1)}>
                  Thử lại
                </button>
              </div>
            ) : filtered.length ? (
              <div className="job-grid">
                {filtered.map((j) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    to={jobDetailPath(j.id, listPath)}
                    navigationState={{ listKey: location.key, fromList: listPath }}
                    onNavigate={rememberList}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={35} />
                <h3>
                  {savedOnly && !savedCount
                    ? 'Lưu lại một cơ hội bạn thích'
                    : 'Chưa tìm thấy cơ hội phù hợp'}
                </h3>
                <p>
                  {savedOnly && !savedCount
                    ? 'Nhấn biểu tượng đánh dấu trên tin tuyển dụng để xem lại tại đây.'
                    : 'Thử một từ khóa khác hoặc mở rộng bộ lọc của bạn.'}
                </p>
                {savedOnly && !savedCount ? (
                  <Link to={'/'} className="button">
                    Khám phá việc làm
                  </Link>
                ) : (
                  <button className="button secondary" onClick={reset}>
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}
            {filtered.length > 0 && (
              <div className="job-load-more">
                <p role="status" aria-live="polite" aria-atomic="true">
                  Đã hiển thị{' '}
                  <strong>
                    {filtered.length}/{total}
                  </strong>{' '}
                  công việc
                </p>
                {loadError && <p role="alert">{loadError} Các tin đã tải vẫn được giữ lại.</p>}
                {loading || loadError || page + 1 < pages ? (
                  <button
                    className="button secondary"
                    disabled={loading}
                    onClick={() => (loadError ? setRetry(retry + 1) : setPage(page + 1))}
                  >
                    {loading
                      ? 'Đang tải thêm…'
                      : loadError
                        ? 'Thử tải thêm lại'
                        : 'Xem thêm công việc'}
                    {!loading && !loadError && <ArrowRight size={16} />}
                  </button>
                ) : (
                  <span className="job-list-complete">
                    <Check size={16} /> Bạn đã xem tất cả công việc
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="container closing-banner">
        <div>
          <span className="eyebrow">BẠN MANG ĐẾN TIỀM NĂNG</span>
          <h2>Chúng mình kết nối cơ hội.</h2>
          <p>Một hồ sơ rõ ràng. Một bước gần hơn đến công việc bạn yêu.</p>
        </div>
        <Link className="button cream" to="/profile">
          Bắt đầu với hồ sơ của bạn <MoveUpRight size={18} />
        </Link>
        <div className="banner-decoration" aria-hidden="true">
          ↗
        </div>
      </section>
    </div>
  )
}
