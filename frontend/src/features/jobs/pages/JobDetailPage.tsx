import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  MapPin,
  BriefcaseBusiness,
  Users,
  FileCheck2,
  Clock3,
  Banknote,
  CalendarDays,
  Check,
  Copy,
  Sparkles,
  ScanLine,
} from 'lucide-react'
import { useAuth } from '../../../app/providers/auth-context'
import { useDemo } from '../../../app/providers/demo-context'
import { getJobById } from '../../../services/job.service'
import { ApiError } from '../../../services/api'
import type { Job } from '../../../types/domain'
import { Modal } from '../../../components/ui/Modal'
import { ApplyWithResume } from '../../applications/components/ApplyWithResume'
import { candidatePreviewJobs } from '../candidate-job-preview'
import { jobDetailPath, safeJobListPath } from '../candidate-job-route'
import { readJobBrowseSnapshot } from '../job-browse-state'
import { JobAiSummary } from '../components/JobAiSummary'
import { JobMatchPanel } from '../components/JobMatchPanel'
import '../styles/candidate-job-detail.css'

const employmentLabels: Record<string, string> = {
  FULL_TIME: 'Toàn thời gian',
  PART_TIME: 'Bán thời gian',
  INTERNSHIP: 'Thực tập',
  CONTRACT: 'Hợp đồng',
}
const deadlineLabel = (value?: string | null) => {
  if (!value) return 'Chưa công bố'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa công bố' : date.toLocaleDateString('vi-VN')
}
function JobProse({ text, fallback }: { text?: string; fallback: string }) {
  if (!text?.trim()) return <p className="jd-unprovided">{fallback}</p>
  return (
    <div className="jd-prose">
      {text
        .trim()
        .split(/\n\s*\n/)
        .map((block, index) => {
          const lines = block.split('\n').filter((line) => line.trim())
          return lines.every((line) => /^\s*[-*•]\s+/.test(line)) ? (
            <ul key={index}>
              {lines.map((line, i) => (
                <li key={i}>{line.replace(/^\s*[-*•]\s+/, '')}</li>
              ))}
            </ul>
          ) : (
            <p key={index}>{block}</p>
          )
        })}
    </div>
  )
}
export function JobDetailPage() {
  const { jobId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const sampleMode = params.get('data') === 'sample'
  const from = safeJobListPath(params.get('from'), sampleMode)
  const state = location.state as { listKey?: string; fromList?: string } | null
  const { user } = useAuth()
  const { saved, toggleSaved } = useDemo()
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [shareLink, setShareLink] = useState('')
  const [matchFor, setMatchFor] = useState<string | null>(null)
  const key = `${jobId}:${retry}`
  const [result, setResult] = useState<{ key: string; job?: Job; error?: string } | null>(null)
  const current = result?.key === key ? result : null
  const sampleJob = sampleMode
    ? candidatePreviewJobs.find((job) => String(job.id) === jobId)
    : undefined
  const job = sampleMode ? sampleJob : current?.job
  const jobTitle = job?.title
  const loading = !sampleMode && !current
  const error = sampleMode
    ? !sampleJob
      ? 'Không tìm thấy công việc mẫu này.'
      : ''
    : current?.error
  useEffect(() => {
    if (sampleMode) return
    let active = true
    getJobById(jobId)
      .then((job) => {
        if (active) setResult({ key, job })
      })
      .catch((error) => {
        if (active)
          setResult({
            key,
            error:
              error instanceof ApiError && error.status === 404
                ? 'Tin này không còn tuyển hoặc không tồn tại.'
                : 'Chưa tải được công việc. Vui lòng kiểm tra kết nối và thử lại.',
          })
      })
    return () => {
      active = false
    }
  }, [jobId, key, sampleMode])
  useEffect(() => {
    const original = document.title
    document.title = jobTitle ? `${jobTitle} · Lumi Careers` : 'Chi tiết công việc · Lumi Careers'
    return () => {
      document.title = original
    }
  }, [jobTitle])
  const backLink = (
    <Link
      className="jd-back"
      to={from}
      onClick={(event) => {
        if (
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          state?.listKey &&
          safeJobListPath(state.fromList, sampleMode) === from &&
          readJobBrowseSnapshot(state.listKey, user?.id)
        ) {
          event.preventDefault()
          navigate(-1)
        }
      }}
    >
      <ArrowLeft size={16} /> Quay lại danh sách
    </Link>
  )
  if (loading || error || !job)
    return (
      <div className="job-detail-page">
        <div className="jd-shell">
          {backLink}
          <section className="jd-state" aria-busy={loading}>
            <span className="jd-eyebrow">LUMI CAREERS</span>
            <h1>{loading ? 'Đang mở cơ hội của bạn…' : 'Cơ hội này hiện chưa sẵn sàng'}</h1>
            <p role={loading ? 'status' : 'alert'}>
              {loading ? 'Đang tải thông tin tuyển dụng.' : error}
            </p>
            {!loading && !sampleMode && (
              <button className="button" onClick={() => setRetry(retry + 1)}>
                Thử lại <ArrowRight size={16} />
              </button>
            )}
          </section>
        </div>
      </div>
    )
  const isSaved = saved.includes(job.id)
  const wrongRole = Boolean(user && user.role !== 'CANDIDATE')
  const canApply = !sampleMode && !wrongRole
  const applying = params.get('apply') === '1' && canApply
  const setApplying = (open: boolean, resumeId?: string) => {
    if (busy) return
    const next = new URLSearchParams(params)
    if (open) {
      next.set('apply', '1')
      if (resumeId) next.set('resumeId', resumeId)
    } else next.delete('apply')
    setParams(next, { replace: true, state: location.state })
  }
  const jumpToSection = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const section = document.getElementById(event.currentTarget.hash.slice(1))
    if (!section) return
    event.preventDefault()
    section.focus({ preventScroll: true })
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }
  const applyLabel = sampleMode ? 'Tin mẫu · Chưa nhận hồ sơ' : 'Ứng tuyển vị trí này'
  const matchOpen =
    matchFor === String(job.id) || (matchFor === null && params.get('match') === '1')
  const openMatch = () => {
    setMatchFor(String(job.id))
    const panel = document.getElementById('job-cv-match')
    panel?.focus({ preventScroll: true })
    panel?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }
  const saveButton = (compact = false) => (
    <button
      className={compact ? 'jd-mobile-save' : 'jd-save'}
      aria-pressed={isSaved}
      aria-label={isSaved ? 'Bỏ lưu công việc' : 'Lưu công việc'}
      onClick={() => toggleSaved(job.id)}
    >
      <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
      {isSaved ? 'Đã lưu' : 'Lưu tin'}
    </button>
  )
  async function copyLink() {
    const url = `${window.location.origin}${jobDetailPath(job!.id, sampleMode)}`
    try {
      await navigator.clipboard.writeText(url)
      setShareStatus('Đã sao chép liên kết công việc.')
      setShareLink('')
    } catch {
      setShareStatus('Bạn có thể sao chép liên kết bên dưới.')
      setShareLink(url)
    }
  }
  return (
    <div className="job-detail-page">
      <div className="jd-shell">
        <nav className="jd-topline" aria-label="Điều hướng công việc">
          {backLink}
          <span>
            LUMI STUDIO <span aria-hidden="true">/</span> CAREERS
          </span>
        </nav>
        {sampleMode && (
          <div className="jd-sample-notice" role="note">
            <Sparkles size={16} />
            <span>
              <strong>Bản xem mẫu.</strong> Nội dung minh họa để khám phá giao diện, chưa nhận hồ sơ
              ứng tuyển.
            </span>
          </div>
        )}
        <header className="jd-hero">
          <div className="jd-hero-copy">
            <div className="jd-kicker">
              <span className="jd-eyebrow">MỘT VỊ TRÍ. NHIỀU KHẢ NĂNG.</span>
              {job.featured && (
                <span className="jd-featured">
                  <Sparkles size={13} /> Cơ hội nổi bật
                </span>
              )}
            </div>
            <h1>{job.title}</h1>
            <p className="jd-company-line">
              {job.company}
              <span aria-hidden="true">/</span>
              <span>{job.category}</span>
            </p>
            <div className="jd-hero-meta">
              <span>
                <MapPin size={16} />
                {job.location}
              </span>
              <span>
                <BriefcaseBusiness size={16} />
                {job.mode}
              </span>
              <span>{job.level}</span>
              {job.employmentType && (
                <span>{employmentLabels[job.employmentType] ?? job.employmentType}</span>
              )}
            </div>
          </div>
          <div className="jd-hero-signature" aria-hidden="true">
            <span>your next</span>
            <strong>
              chapter<span>.</span>
            </strong>
            <ArrowUpRight />
          </div>
          <div className="jd-facts">
            <div>
              <Banknote size={19} />
              <span>
                Thu nhập<strong>{job.salary}</strong>
              </span>
            </div>
            <div>
              <Users size={19} />
              <span>
                Số lượng tuyển
                <strong>{job.headcount != null ? `${job.headcount} người` : 'Chưa công bố'}</strong>
              </span>
            </div>
            <div title="Tổng số hồ sơ đã gửi cho vị trí, gồm các trạng thái xử lý.">
              <FileCheck2 size={19} />
              <span>
                Hồ sơ đã nộp
                <strong>
                  {!sampleMode && job.applicationCount != null
                    ? `${job.applicationCount.toLocaleString('vi-VN')} hồ sơ`
                    : 'Chưa thống kê'}
                </strong>
              </span>
            </div>
            <div>
              <CalendarDays size={19} />
              <span>
                Hạn ứng tuyển<strong>{deadlineLabel(job.deadline)}</strong>
              </span>
            </div>
            <div>
              <Clock3 size={19} />
              <span>
                Đăng tuyển<strong>{job.posted}</strong>
              </span>
            </div>
          </div>
        </header>
        <JobAiSummary
          key={`${job.id}:${retry}`}
          jobId={String(job.id)}
          sampleMode={sampleMode}
          onRefreshJob={() => setRetry(retry + 1)}
        />
        <div className="jd-layout">
          <article className="jd-content" aria-label="Nội dung tuyển dụng">
            <JobMatchPanel
              key={`${job.id}:${user?.id ?? 'guest'}:${retry}`}
              job={job}
              sampleMode={sampleMode}
              canApply={canApply}
              onApply={(resumeId) => setApplying(true, resumeId)}
              initialResumeId={params.get('resumeId') ?? undefined}
              onRefreshJob={() => setRetry(retry + 1)}
              open={matchOpen}
              onToggle={() => setMatchFor(matchOpen ? '' : String(job.id))}
            />
            <nav className="jd-section-nav" aria-label="Các mục công việc">
              <a href="#job-overview" onClick={jumpToSection}>
                01 <span>Công việc</span>
              </a>
              <a href="#job-requirements" onClick={jumpToSection}>
                02 <span>Yêu cầu</span>
              </a>
              <a href="#job-skills" onClick={jumpToSection}>
                03 <span>Kỹ năng</span>
              </a>
              <a href="#job-benefits" onClick={jumpToSection}>
                04 <span>Quyền lợi</span>
              </a>
            </nav>
            <section className="jd-section" id="job-overview" tabIndex={-1}>
              <span className="jd-section-index" aria-hidden="true">
                01
              </span>
              <div>
                <span className="jd-section-caption">VAI TRÒ CỦA BẠN</span>
                <h2>Những gì bạn sẽ làm</h2>
                <JobProse text={job.description} fallback="Mô tả công việc chưa được cung cấp." />
              </div>
            </section>
            <section className="jd-section" id="job-requirements" tabIndex={-1}>
              <span className="jd-section-index" aria-hidden="true">
                02
              </span>
              <div>
                <span className="jd-section-caption">ĐIỂM XUẤT PHÁT</span>
                <h2>Điều chúng mình tìm kiếm</h2>
                <JobProse
                  text={job.requirements}
                  fallback="Yêu cầu chi tiết chưa được cung cấp. Bạn có thể tham khảo các kỹ năng của vị trí bên dưới."
                />
              </div>
            </section>
            <section className="jd-section" id="job-skills" tabIndex={-1}>
              <span className="jd-section-index" aria-hidden="true">
                03
              </span>
              <div>
                <span className="jd-section-caption">BỘ CÔNG CỤ CỦA BẠN</span>
                <h2>Kỹ năng cho vị trí này</h2>
                {job.tags.length ? (
                  <div className="jd-skills">
                    {job.tags.map((tag, index) => (
                      <span key={`${tag}:${index}`}>
                        <span aria-hidden="true">↗</span>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="jd-unprovided">Chưa có danh sách kỹ năng.</p>
                )}
                <p className="jd-skills-note">Các kỹ năng được nêu trong tin tuyển dụng.</p>
              </div>
            </section>
            <section className="jd-section" id="job-benefits" tabIndex={-1}>
              <span className="jd-section-index" aria-hidden="true">
                04
              </span>
              <div>
                <span className="jd-section-caption">KHÔNG GIAN PHÁT TRIỂN</span>
                <h2>Điều bạn nhận được</h2>
                <JobProse text={job.benefits} fallback="Quyền lợi chi tiết chưa được cung cấp." />
              </div>
            </section>
            <div className="jd-closing">
              <div>
                <span className="jd-eyebrow">HIỂU NHAU TRƯỚC KHI BẮT ĐẦU</span>
                <h2>
                  Để bước tiếp theo
                  <br />
                  là một lựa chọn rõ ràng.
                </h2>
              </div>
              <Link to="/hiring-process">
                Xem quy trình tuyển dụng <ArrowUpRight size={19} />
              </Link>
            </div>
          </article>
          <aside className="jd-sidebar" aria-label="Ứng tuyển công việc">
            <section className="jd-apply-card">
              <span className="jd-eyebrow">BƯỚC TIẾP THEO CỦA BẠN</span>
              <h2>
                Cùng tạo nên
                <br />
                điều có ý nghĩa<span>.</span>
              </h2>
              <p>
                {sampleMode
                  ? 'Khám phá nội dung và lưu lại vị trí bạn quan tâm.'
                  : 'Chọn CV phù hợp, xem lại hồ sơ và gửi đến đội ngũ tuyển dụng.'}
              </p>
              <div className="jd-apply-summary">
                <span>{job.title}</span>
                <span>
                  <MapPin size={14} />
                  {job.location} · {job.mode}
                </span>
              </div>
              <button
                className="jd-apply-button"
                disabled={!canApply}
                onClick={() => setApplying(true)}
              >
                {applyLabel}
                <ArrowUpRight size={19} />
              </button>
              <button
                className="jd-match-link"
                type="button"
                disabled={wrongRole && !sampleMode}
                onClick={openMatch}
              >
                <ScanLine size={16} />
                Đối chiếu CV với vị trí
              </button>
              {saveButton()}
              <p className="jd-apply-note">
                {wrongRole && !sampleMode
                  ? 'Tính năng ứng tuyển dành cho tài khoản ứng viên.'
                  : sampleMode
                    ? 'Tin mẫu không gửi đơn đến nhà tuyển dụng.'
                    : 'Sử dụng CV đã hoàn tất để ứng tuyển.'}
              </p>
            </section>
            <section className="jd-prepare">
              <span className="jd-small-label">TRƯỚC KHI GỬI HỒ SƠ</span>
              <p>
                <Check size={16} />
                Đọc kỹ yêu cầu của vị trí
              </p>
              <p>
                <Check size={16} />
                Kiểm tra thông tin liên hệ trong CV
              </p>
              <p>
                <Check size={16} />
                Chọn CV phù hợp với công việc
              </p>
            </section>
            <div className="jd-share">
              <button onClick={() => void copyLink()}>
                <Copy size={16} />
                Sao chép liên kết
              </button>
              <p role="status" aria-live="polite">
                {shareStatus}
              </p>
              {shareLink && <input aria-label="Liên kết công việc" readOnly value={shareLink} />}
            </div>
          </aside>
        </div>
      </div>
      <div className="jd-mobile-actions">
        <button className="jd-apply-button" disabled={!canApply} onClick={() => setApplying(true)}>
          {sampleMode ? 'Tin mẫu' : wrongRole ? 'Dành cho ứng viên' : 'Ứng tuyển'}
          <ArrowUpRight size={18} />
        </button>
        {saveButton(true)}
      </div>
      {applying && (
        <Modal title="Gửi hồ sơ ứng tuyển" onClose={() => setApplying(false)} wide>
          <div className="jd-modal-job">
            <span>{job.company}</span>
            <h3>{job.title}</h3>
            <p>
              {job.location} · {job.mode}
            </p>
          </div>
          <ApplyWithResume
            key={`${job.id}:${user?.id}`}
            jobId={String(job.id)}
            preferredResumeId={params.get('resumeId') ?? undefined}
            onBusy={setBusy}
            onSubmitted={() => {
              void getJobById(String(job.id))
                .then((updated) => {
                  setResult((previous) =>
                    previous?.key === key ? { key, job: updated } : previous,
                  )
                })
                .catch(() => {})
            }}
          />
        </Modal>
      )}
    </div>
  )
}
