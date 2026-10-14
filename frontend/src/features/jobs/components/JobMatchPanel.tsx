import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  FileText,
  ListFilter,
  LockKeyhole,
  Radar,
  RotateCw,
  ScanLine,
  Sparkles,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../app/providers/auth-context'
import { ApiError } from '../../../services/api'
import { analyzeJobMatch, getCachedJobMatch } from '../../../services/candidate-match.service'
import { getMyResumes } from '../../../services/resume.service'
import type { Job, Resume } from '../../../types/domain'
import type { CandidateJobMatch } from '../candidate-job-match-model'
import { isCurrentJobMatch, jobMatchOverview, jobMatchStatus } from '../candidate-job-match-model'
import { improveCvPath, jobDetailPath } from '../candidate-job-route'
import '../styles/job-match.css'
import { JobBenchmarkPanel } from './JobBenchmarkPanel'
import { JobMatchBars, JobMatchRadar, JobMatchScore } from './JobMatchCharts'
export function JobMatchPanel({
  job,
  onApply,
  canApply,
  open,
  onToggle,
  initialResumeId,
  onRefreshJob,
}: {
  job: Job

  onApply: (resumeId?: string) => void
  canApply: boolean
  open: boolean
  onToggle: () => void
  initialResumeId?: string
  onRefreshJob: () => void
}) {
  const { user, loading: authLoading } = useAuth()
  const panelId = useId()
  const [retry, setRetry] = useState(0)
  const [cvResult, setCvResult] = useState<{
    key: string
    resumes?: Resume[]
    error?: string
  } | null>(null)
  const [selectedResume, setSelectedResume] = useState(initialResumeId ?? '')
  const sequence = useRef(0)
  const running = useRef(false)
  const [cacheChecked, setCacheChecked] = useState<string | null>(null)
  const [refreshRequired, setRefreshRequired] = useState(false)
  const [matchResults, setMatchResults] = useState<Record<string, CandidateJobMatch>>({})
  const [analyzing, setAnalyzing] = useState(false)
  const [matchError, setMatchError] = useState<string | null>(null)
  const candidate = user?.role === 'CANDIDATE'
  const requestKey = `${user?.id}:${retry}`
  const current = cvResult?.key === requestKey ? cvResult : null
  const readyResumes = current?.resumes?.filter((resume) => resume.status === 'READY') ?? []
  const defaultResume = readyResumes.find((resume) => resume.isDefault) ?? readyResumes[0]
  const resumeId = readyResumes.some((resume) => resume.id === selectedResume)
    ? selectedResume
    : (defaultResume?.id ?? '')
  const chosenResume = readyResumes.find((resume) => resume.id === resumeId)
  const resultKey = `${resumeId}:${chosenResume?.version ?? ''}`
  const stored = matchResults[resultKey]
  const result =
    stored && chosenResume && isCurrentJobMatch(stored, String(job.id), chosenResume)
      ? stored
      : null
  const checkingCache = !!resumeId && !result && cacheChecked !== resultKey
  useEffect(
    () => () => {
      sequence.current++
      running.current = false
    },
    [],
  )
  useEffect(() => {
    if (!open || !candidate) return
    let active = true
    getMyResumes()
      .then((resumes) => {
        if (active) setCvResult({ key: requestKey, resumes })
      })
      .catch(() => {
        if (active)
          setCvResult({ key: requestKey, error: 'Chưa tải được CV của bạn. Vui lòng thử lại.' })
      })
    return () => {
      active = false
    }
  }, [candidate, requestKey, open])
  useEffect(() => {
    if (!open || !candidate || !chosenResume || result) return
    let active = true
    const request = sequence.current
    getCachedJobMatch(String(job.id), chosenResume.id)
      .then((cached) => {
        if (
          active &&
          request === sequence.current &&
          cached &&
          isCurrentJobMatch(cached, String(job.id), chosenResume)
        )
          setMatchResults((prev) => ({ ...prev, [resultKey]: cached }))
      })
      .catch((error) => {
        if (active && request === sequence.current) {
          setMatchError(error instanceof Error ? error.message : 'Chưa tải được kết quả đã lưu.')
          setRefreshRequired(error instanceof ApiError && [404, 409].includes(error.status))
        }
      })
      .finally(() => {
        if (active) setCacheChecked(resultKey)
      })
    return () => {
      active = false
    }
  }, [open, candidate, chosenResume, resultKey, job.id, result])
  const handleAnalyze = async (force = false) => {
    if (running.current) return
    setMatchError(null)
    setRefreshRequired(false)
    if (!chosenResume) return
    running.current = true
    const request = ++sequence.current
    setAnalyzing(true)
    try {
      const match = await analyzeJobMatch(String(job.id), resumeId, force)
      if (request !== sequence.current) return
      if (!isCurrentJobMatch(match, String(job.id), chosenResume)) {
        setRefreshRequired(true)
        setMatchError('CV đã thay đổi. Hãy tải lại CV để xem đúng phiên bản.')
        return
      }
      setMatchResults((prev) => ({ ...prev, [resultKey]: match }))
    } catch (err) {
      if (request === sequence.current) {
        setMatchError(
          err instanceof Error ? err.message : 'Chưa thể phân tích lúc này. Hãy thử lại.',
        )
        setRefreshRequired(err instanceof ApiError && [404, 409].includes(err.status))
      }
    } finally {
      if (request === sequence.current) {
        setAnalyzing(false)
        running.current = false
      }
    }
  }
  const logIn = (
    <Link className="jm-open-button" to="/login" state={{ from: jobDetailPath(job.id) }}>
      Đăng nhập để chọn CV
      <ArrowRight size={15} />
    </Link>
  )
  return (
    <section
      className={`job-match-panel ${open ? 'is-open' : ''}`}
      id="job-cv-match"
      aria-labelledby={`${panelId}-title`}
      tabIndex={-1}
    >
      <header className="jm-header">
        <span className="jm-icon">
          <ScanLine size={22} />
        </span>
        <div className="jm-heading">
          <span className="jm-kicker">TÌM ĐIỂM GIAO GIỮA BẠN & VỊ TRÍ</span>
          <h2 id={`${panelId}-title`}>CV của bạn phù hợp đến đâu?</h2>
          <p>Nhìn rõ điểm mạnh, khoảng thiếu và căn cứ trong CV trước khi ứng tuyển.</p>
        </div>
      </header>
      <div className="jm-intro-actions">
        <span>
          <LockKeyhole size={12} />
          Bạn chủ động chọn CV để đối chiếu
        </span>
        {!user && !authLoading ? (
          logIn
        ) : (
          <button
            className="jm-open-button"
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            disabled={authLoading || !candidate}
            onClick={onToggle}
          >
            {authLoading
              ? 'Đang kiểm tra phiên…'
              : !candidate
                ? 'Dành cho ứng viên'
                : open
                  ? 'Thu gọn'
                  : 'Chọn CV đối chiếu'}
            <ChevronDown size={15} />
          </button>
        )}
      </div>
      <div id={panelId} className="jm-body" hidden={!open}>
        {!candidate ? (
          <div className="jm-state">
            <p>
              {user ? 'Phân tích CV dành cho tài khoản ứng viên.' : 'Đăng nhập để chọn CV của bạn.'}
            </p>
            {!user && logIn}
          </div>
        ) : !current ? (
          <p className="jm-state" role="status">
            <RotateCw size={16} />
            Đang tải danh sách CV…
          </p>
        ) : current?.error ? (
          <div className="jm-state">
            <p role="alert">{current.error}</p>
            <button className="jm-text-button" onClick={() => setRetry(retry + 1)}>
              <RotateCw size={14} />
              Thử lại
            </button>
          </div>
        ) : !readyResumes.length ? (
          <div className="jm-empty">
            <FileText size={26} />
            <h3>Chuẩn bị một CV để bắt đầu</h3>
            <p>
              {current?.resumes?.length
                ? 'Bạn có CV bản nháp. Hãy hoàn tất CV trước khi đối chiếu với vị trí.'
                : 'Tạo CV với kinh nghiệm, kỹ năng và dự án để có căn cứ đối chiếu.'}
            </p>
            <Link
              className="jm-open-button"
              to={`/cv-builder?jobId=${encodeURIComponent(String(job.id))}`}
            >
              Tạo hoặc hoàn tất CV
              <ArrowUpRight size={15} />
            </Link>
          </div>
        ) : (
          <>
            <div className="jm-cv-picker">
              <label htmlFor={`${panelId}-cv`}>
                <FileText size={16} />
                <span>
                  CV dùng để đối chiếu
                  <small>{'Chỉ dùng phiên bản đã lưu và hoàn tất'}</small>
                </span>
              </label>
              <div>
                <select
                  id={`${panelId}-cv`}
                  value={resumeId}
                  disabled={analyzing}
                  onChange={(event) => {
                    setSelectedResume(event.target.value)
                    setMatchError(null)
                    setRefreshRequired(false)
                  }}
                >
                  {readyResumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.title} · v{resume.version}
                    </option>
                  ))}
                </select>
                <button
                  className="jm-analyze"
                  type="button"
                  disabled={analyzing || checkingCache || refreshRequired || !resumeId}
                  onClick={() => void handleAnalyze(Boolean(result))}
                >
                  {analyzing || checkingCache ? (
                    <>
                      <RotateCw size={15} className="jm-spinning" />
                      {checkingCache ? 'Đang kiểm tra kết quả…' : 'Đang phân tích…'}
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      {result ? 'Phân tích lại với AI' : 'Phân tích độ phù hợp'}
                    </>
                  )}
                </button>
              </div>
            </div>
            {
              <p className="jm-data-note">
                Khi bấm phân tích, nội dung năng lực trong CV và JD được gửi tới Groq hoặc Gemini dự
                phòng. Họ tên, email và số điện thoại không được gửi.
              </p>
            }
            {matchError && (
              <div className="jm-error-banner" role="alert">
                <p>{matchError}</p>
                <button
                  className="jm-text-button"
                  type="button"
                  disabled={analyzing}
                  onClick={() => {
                    if (refreshRequired) {
                      setMatchError(null)
                      setMatchResults({})
                      setRetry(retry + 1)
                      onRefreshJob()
                    } else void handleAnalyze(Boolean(result))
                  }}
                >
                  <RotateCw size={14} /> {refreshRequired ? 'Tải lại CV và tin' : 'Thử lại'}
                </button>
              </div>
            )}
            {analyzing ? (
              <div className="jm-analyzing-state" role="status" aria-live="polite">
                <RotateCw size={24} className="jm-spinning" />
                <h4>AI đang đối chiếu CV với tiêu chí công việc…</h4>
                <p>
                  Đang kiểm tra từng tiêu chí và trích dẫn CV. Thường mất tối đa khoảng 30 giây; kết
                  quả sẽ được lưu để mở lại.
                </p>
              </div>
            ) : result ? (
              <JobMatchResult
                key={`${result.resumeId}:${result.evaluatedAt ?? result.resumeVersion}`}
                result={result}
                benchmarkEnabled={open}
                onApply={() => onApply(resumeId)}
                canApply={canApply}
              />
            ) : (
              <div className="jm-awaiting">
                <span>
                  01<small>Chọn CV</small>
                </span>
                <i />
                <span>
                  02<small>Đối chiếu với JD</small>
                </span>
                <i />
                <span>
                  03<small>Xem điểm & căn cứ</small>
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
function JobMatchResult({
  benchmarkEnabled,
  result,
  onApply,
  canApply,
}: {
  benchmarkEnabled: boolean
  result: CandidateJobMatch
  onApply: () => void
  canApply: boolean
}) {
  const [chart, setChart] = useState<'bars' | 'radar'>('bars')
  const [selected, setSelected] = useState(0)
  const evidenceId = useId()
  const overview = jobMatchOverview(result.criteria)
  const active = result.criteria[selected] ?? result.criteria[0]
  const isReal = true
  const displayScore = overview.score
  const improvementPath = improveCvPath(result.jobId, result.resumeId)
  return (
    <div
      className="jm-result"
      aria-label={isReal ? 'Kết quả đối chiếu CV thực tế' : 'Kết quả đối chiếu mẫu'}
    >
      <div className="jm-overview">
        <JobMatchScore score={displayScore} />
        <div className="jm-overview-copy">
          <span className="jm-kicker">
            {isReal ? 'MỨC ĐÁP ỨNG TỪ CV ĐÃ CHỌN' : 'MỨC ĐÁP ỨNG CV–JD · MẪU'}
          </span>
          <h3>
            {result.summary
              ? result.summary
              : displayScore != null && displayScore >= 65
                ? 'Có điểm giao tốt giữa CV và yêu cầu vị trí.'
                : 'Một điểm khởi đầu để định hướng và bổ sung CV.'}
          </h3>
          <p>
            Điểm đối chiếu theo tiêu chí có trọng số,{' '}
            <strong>không phải xác suất trúng tuyển</strong> hoặc năng lực đã được xác minh.
          </p>
          <div className="jm-counts">
            <span>
              <i className="jm-dot-matched" />
              {overview.matched} phù hợp
            </span>
            <span>
              <i className="jm-dot-partial" />
              {overview.partial} một phần
            </span>
            <span>
              <i className="jm-dot-unknown" />
              {overview.unknown} chưa có căn cứ
            </span>
          </div>
        </div>
      </div>
      <details className="jm-method">
        <summary>
          <CircleHelp size={13} />
          Điểm này được hiểu như thế nào?
        </summary>
        <p>
          Điểm tổng = tổng (mức đáp ứng × trọng số) / tổng trọng số. Tiêu chí chưa có bằng chứng
          chưa được cộng điểm; điều đó không khẳng định bạn thiếu kỹ năng.{' '}
          {isReal
            ? 'Đánh giá được AI đối chiếu trực tiếp từ thông tin trong CV của bạn với tin tuyển dụng.'
            : 'Trọng số, điểm và phân loại bắt buộc/ưu tiên trong bản này đều là dữ liệu mẫu.'}
        </p>
        <p>
          Kết quả gắn với {result.resumeTitle}, phiên bản {result.resumeVersion}. Khi CV hoặc JD
          thay đổi, cần đối chiếu lại.
        </p>
      </details>
      <div className="jm-chart-heading">
        <div>
          <span className="jm-kicker">ĐI VÀO TỪNG TIÊU CHÍ</span>
          <h3>Điều CV đã thể hiện</h3>
        </div>
        <div className="jm-chart-switch" role="group" aria-label="Kiểu biểu đồ đối chiếu">
          <button type="button" aria-pressed={chart === 'bars'} onClick={() => setChart('bars')}>
            <ListFilter size={14} />
            Thanh ngang
          </button>
          <button type="button" aria-pressed={chart === 'radar'} onClick={() => setChart('radar')}>
            <Radar size={14} />
            Radar
          </button>
        </div>
      </div>
      <div className="jm-detail-grid">
        <div className="jm-chart-area">
          {chart === 'bars' ? (
            <JobMatchBars
              criteria={result.criteria}
              selected={selected}
              onSelect={setSelected}
              evidenceId={evidenceId}
            />
          ) : (
            <JobMatchRadar
              criteria={result.criteria}
              selected={selected}
              onSelect={setSelected}
              evidenceId={evidenceId}
            />
          )}
        </div>
        <section
          className="jm-evidence"
          id={evidenceId}
          aria-label={isReal ? `Căn cứ CV: ${active.name}` : `Căn cứ CV mẫu: ${active.name}`}
          aria-live="polite"
        >
          <span className="jm-kicker">CĂN CỨ & GIẢI THÍCH</span>
          <h4>{active.name}</h4>
          {active.jobEvidence && (
            <>
              <h5>Yêu cầu từ tin tuyển dụng</h5>
              <blockquote>{active.jobEvidence}</blockquote>
            </>
          )}
          <span className={`jm-status jm-status-${active.status.toLowerCase()}`}>
            {jobMatchStatus[active.status].label}
          </span>
          <p className="jm-source">
            <FileText size={13} />
            {active.source}
          </p>
          <h5>CV đã thể hiện gì?</h5>
          {active.evidence ? (
            <blockquote>{active.evidence}</blockquote>
          ) : (
            <p className="jm-no-evidence">
              Chưa có trích dẫn cho tiêu chí này. Đây là phần cần làm rõ, không phải kết luận bạn
              không có kỹ năng.
            </p>
          )}
          <h5>Vì sao có nhận xét này?</h5>
          <p>{active.reason}</p>
          <h5>Bước tiếp theo của bạn</h5>
          <p>{active.suggestion}</p>
          <span className="jm-evidence-weight">
            {active.required ? 'Tiêu chí bắt buộc' : 'Tiêu chí ưu tiên'} · Trọng số: {active.weight}
          </span>
        </section>
      </div>
      {isReal && (
        <JobBenchmarkPanel
          key={`${result.resumeId}:${result.evaluatedAt}`}
          jobId={result.jobId}
          resumeId={result.resumeId}
          enabled={benchmarkEnabled}
        />
      )}
      {isReal && !!result.gaps?.length && (
        <section className="jm-gap-list" aria-label="Ưu tiên cải thiện theo JD">
          <h3>Những phần nên làm rõ trước</h3>
          <p>Đây là gợi ý từ nội dung CV, chưa kết luận bạn không có kỹ năng.</p>
          {result.gaps.map((gap, index) => (
            <article key={`${gap.skill}:${index}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h4>{gap.skill}</h4>
                <p>
                  <strong>CV hiện tại:</strong> {gap.currentLevel}
                </p>
                <p>
                  <strong>Yêu cầu trong JD:</strong> {gap.targetLevel}
                </p>
                <p>
                  <strong>Nếu chưa có trải nghiệm:</strong> {gap.roadmap}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
      <div className="jm-next-steps">
        <div>
          <BookOpen size={18} />
          <h3>Nên làm gì trước khi gửi CV?</h3>
        </div>
        <ul>
          <li>
            <Check size={14} />
            <span>
              Làm rõ phần{' '}
              <strong>
                {result.criteria.find((row) => row.status === 'PARTIAL')?.name ??
                  'kinh nghiệm liên quan'}
              </strong>{' '}
              bằng một ví dụ và kết quả thực tế.
            </span>
          </li>
          {overview.requiredUnknown > 0 && (
            <li>
              <CircleHelp size={14} />
              <span>
                Bổ sung căn cứ cho {overview.requiredUnknown} tiêu chí bắt buộc chưa được thể hiện,
                nếu bạn có trải nghiệm tương ứng.
              </span>
            </li>
          )}
        </ul>
        <p>
          Chỉ bổ sung thông tin đúng với trải nghiệm của bạn. Gợi ý này chưa phải lộ trình học cá
          nhân.
        </p>
      </div>
      {isReal && (
        <div className="jm-improve">
          <div>
            <h3>Hoàn thiện CV cho đúng vị trí</h3>
            <p>
              AI hỏi thêm trải nghiệm thật, đề xuất sửa từng mục. Bạn duyệt, lưu CV rồi quay lại đối
              chiếu phiên bản mới.
            </p>
          </div>
          <Link className="jm-open-button" to={improvementPath}>
            <Sparkles size={15} />
            Cải thiện CV cho vị trí này
            <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
      <div className="jm-result-footer">
        <span>
          <Sparkles size={13} />
          {result.evaluatedAt
            ? `Đã lưu · ${new Date(result.evaluatedAt).toLocaleString('vi-VN')}`
            : 'Phân tích chỉ hỗ trợ bạn chuẩn bị hồ sơ.'}
        </span>
        <button type="button" disabled={!canApply} onClick={onApply}>
          {canApply ? 'Tiếp tục ứng tuyển' : 'Chưa thể ứng tuyển'}
          <ArrowUpRight size={16} />
        </button>
      </div>
    </div>
  )
}
