import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  GitBranch,
  HelpCircle,
  Loader2,
  RotateCw,
  Sparkles,
  Terminal,
} from 'lucide-react'
import {
  getGithubVerification,
  getGithubSource,
  triggerGithubVerification,
} from '../../../services/github-verification.service'
import type {
  GithubVerification as GithubVerificationData,
  GithubSource,
} from '../../../services/github-verification.service'
import { submittedDate } from '../../../services/application.service'
import './github-verification.css'

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Java: '#b07219',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  PHP: '#4F5D95',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  Dart: '#00B4AB',
}

const DEFAULT_COLOR = '#6b7280'

export function GithubVerification({
  applicationId,
  githubUrl,
}: {
  applicationId: string
  githubUrl?: string | null
}) {
  const [data, setData] = useState<GithubVerificationData | null | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [source, setSource] = useState<GithubSource | null>(null)
  const [retry, setRetry] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([getGithubVerification(applicationId), getGithubSource(applicationId)])
      .then(([res, source]) => {
        if (active) {
          setData(res)
          setSource(source)
          setError('')
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Không tải được dữ liệu GitHub.')
      })
    return () => {
      active = false
    }
  }, [applicationId, retry])

  async function handleVerify(force: boolean) {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const res = await triggerGithubVerification(applicationId, force)
      if (mounted.current) {
        setData(res)
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Không thể đối chiếu GitHub lúc này.')
      }
    } finally {
      if (mounted.current) {
        setLoading(false)
      }
    }
  }

  if (data === undefined) {
    if (error)
      return (
        <div className="hr-form-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="hr-button secondary"
            onClick={() => setRetry((n) => n + 1)}
          >
            Thử tải lại GitHub
          </button>
        </div>
      )
    return <p role="status">Đang tải thông tin đối chiếu GitHub…</p>
  }

  if (!data) {
    return (
      <div className="hr-empty">
        <Code2 size={32} />
        <h3>Chưa có dữ liệu đối chiếu GitHub</h3>
        <p>
          Hệ thống sẽ rà soát các kho lưu trữ công khai, đo lường tín hiệu chất lượng code và đối
          chiếu với các kỹ năng khai báo trong CV.
        </p>
        {source && <p role="status">{source.message}</p>}
        <button
          type="button"
          className="hr-button secondary"
          disabled={loading}
          onClick={() => setRetry((n) => n + 1)}
        >
          Cập nhật nguồn CV
        </button>
        {(source?.url || githubUrl) && source?.state === 'READY' && (
          <p className="submitted-caption">
            URL ứng viên cung cấp:{' '}
            <a href={source.url!} target="_blank" rel="noreferrer" className="github-profile-link">
              {source.url} <ExternalLink size={14} />
            </a>
          </p>
        )}
        {error && (
          <div className="hr-form-error" role="alert" style={{ marginBottom: 16 }}>
            <p>{error}</p>
          </div>
        )}
        <button
          type="button"
          className="hr-button"
          onClick={() => void handleVerify(false)}
          disabled={loading || source?.state !== 'READY'}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? 'Đang phân tích GitHub…' : 'Đối chiếu GitHub ngay'}
        </button>
      </div>
    )
  }

  const scoreClass =
    data.codeQualityScore >= 8 ? 'high' : data.codeQualityScore >= 5 ? 'medium' : 'low'

  const langEntries = Object.entries(data.topLanguages || {})

  return (
    <div className="github-verification-tab">
      <p className="submitted-caption">
        Đây là gợi ý từ dữ liệu công khai, chưa xác minh danh tính hoặc quyền sở hữu mã nguồn. Hãy
        đối chiếu thêm khi phỏng vấn; tín hiệu ít commit hoặc tên repo không chứng minh dùng AI hay
        gian lận.
      </p>
      {error && (
        <div className="hr-form-error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Hero Profile Card */}
      <div className="github-hero-card">
        <div className="github-hero-left">
          <div className="github-avatar-badge">
            <Terminal size={26} />
          </div>
          <div className="github-hero-meta">
            <h3>
              {data.githubUsername}
              <a
                href={`https://github.com/${data.githubUsername}`}
                target="_blank"
                rel="noreferrer"
                className="github-profile-link"
                title="Mở hồ sơ GitHub"
              >
                github.com/{data.githubUsername} <ExternalLink size={14} />
              </a>
            </h3>
            <span className="submitted-caption">
              Cập nhật: {submittedDate(data.fetchedAt)}
              {data.modelName ? ` · ${data.modelName}` : ''}
            </span>
          </div>
        </div>

        <div className="github-hero-right">
          <div className="github-score-badge">
            <span className={`github-score-value ${scoreClass}`}>
              {data.codeQualityScore}
              <small style={{ fontSize: '1rem', opacity: 0.7 }}>/10</small>
            </span>
            <span className="github-score-label">Điểm chất lượng code</span>
          </div>

          <button
            type="button"
            className="hr-button secondary"
            onClick={() => void handleVerify(true)}
            disabled={loading}
            title="Quét lại toàn bộ repo và phân tích lại"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
            {loading ? 'Đang phân tích…' : 'Đối chiếu lại'}
          </button>
        </div>
      </div>

      {/* Signals & Vibe Flags */}
      <div className="github-signals-bar">
        <span className={`signal-chip ${data.hasTests ? 'active' : 'inactive'}`}>
          {data.hasTests ? <CheckCircle2 size={16} /> : <Code2 size={16} />}
          {data.hasTests ? 'Có Unit/Integration Test' : 'Chưa thấy Test'}
        </span>
        <span className={`signal-chip ${data.hasDocker ? 'active' : 'inactive'}`}>
          {data.hasDocker ? <CheckCircle2 size={16} /> : <Terminal size={16} />}
          {data.hasDocker ? 'Có Docker / Docker-compose' : 'Chưa thấy Docker'}
        </span>
        <span className={`signal-chip ${data.hasCi ? 'active' : 'inactive'}`}>
          {data.hasCi ? <CheckCircle2 size={16} /> : <GitBranch size={16} />}
          {data.hasCi ? 'Có CI/CD (GitHub Actions)' : 'Chưa cấu hình CI'}
        </span>

        {data.vibeCodingFlags?.map((flag, idx) => (
          <span key={idx} className="signal-chip warning">
            <AlertTriangle size={15} />
            {flag}
          </span>
        ))}
      </div>

      {/* Language Distribution */}
      {langEntries.length > 0 && (
        <div className="github-languages-card">
          <h4>Phân bố ngôn ngữ lập trình</h4>
          <div className="language-bar-track">
            {langEntries.map(([lang, pct]) => (
              <div
                key={lang}
                className="language-bar-segment"
                style={{
                  width: `${pct}%`,
                  backgroundColor: LANG_COLORS[lang] || DEFAULT_COLOR,
                }}
                title={`${lang}: ${pct}%`}
              />
            ))}
          </div>
          <div className="language-legend">
            {langEntries.map(([lang, pct]) => (
              <div key={lang} className="language-legend-item">
                <span
                  className="language-color-dot"
                  style={{ backgroundColor: LANG_COLORS[lang] || DEFAULT_COLOR }}
                />
                <strong>{lang}</strong>
                <span>{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skills Verification: 2 Columns */}
      <div className="github-skills-grid">
        <div className="skills-column">
          <h4>
            <CheckCircle2 size={18} color="#10b981" />
            Kỹ năng có tín hiệu công khai theo AI ({data.verifiedSkills?.length || 0})
          </h4>
          {data.verifiedSkills?.length ? (
            data.verifiedSkills.map((item, idx) => (
              <div key={idx} className="skill-evidence-card verified">
                <div className="skill-card-header">
                  <span className="skill-card-name">{item.skill}</span>
                </div>
                <p className="skill-card-body">{item.evidence}</p>
              </div>
            ))
          ) : (
            <p className="submitted-caption">Chưa ghi nhận kỹ năng nào có bằng chứng rõ ràng.</p>
          )}
        </div>

        <div className="skills-column">
          <h4>
            <HelpCircle size={18} color="#f59e0b" />
            Kỹ năng chưa có bằng chứng công khai ({data.unverifiedSkills?.length || 0})
          </h4>
          {data.unverifiedSkills?.length ? (
            data.unverifiedSkills.map((item, idx) => (
              <div key={idx} className="skill-evidence-card unverified">
                <div className="skill-card-header">
                  <span className="skill-card-name">{item.skill}</span>
                </div>
                <p className="skill-card-body">{item.note}</p>
              </div>
            ))
          ) : (
            <p className="submitted-caption">Toàn bộ kỹ năng khai báo đều tìm thấy bằng chứng.</p>
          )}
        </div>
      </div>

      {/* Matched Projects */}
      {!!data.matchedProjects?.length && (
        <div className="github-projects-card">
          <h4>Đối chiếu Dự án trong CV với Repository</h4>
          <table className="matched-projects-table">
            <thead>
              <tr>
                <th>Dự án trong CV</th>
                <th>Repository GitHub</th>
                <th>Độ tin cậy</th>
              </tr>
            </thead>
            <tbody>
              {data.matchedProjects.map((proj, idx) => {
                const conf = (proj.confidence || '').toLowerCase()
                const confClass = conf.includes('cao')
                  ? 'cao'
                  : conf.includes('trung')
                    ? 'medium'
                    : 'low'
                return (
                  <tr key={idx}>
                    <td>
                      <strong>{proj.cvProject}</strong>
                    </td>
                    <td>
                      <a
                        href={`https://github.com/${data.githubUsername}/${proj.githubRepo}`}
                        target="_blank"
                        rel="noreferrer"
                        className="github-profile-link"
                      >
                        {proj.githubRepo} <ExternalLink size={13} />
                      </a>
                    </td>
                    <td>
                      <span className={`confidence-tag ${confClass}`}>{proj.confidence}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* AI Insights & Interview Suggestions */}
      <div className="github-insights-section">
        <h4>
          <Sparkles size={18} />
          Nhận định chuyên môn & Đề xuất phỏng vấn
        </h4>
        <p className="github-summary-text">{data.technicalSummary}</p>

        {!!data.interviewSuggestions?.length && (
          <div>
            <h5 style={{ margin: '14px 0 8px', fontSize: '0.92rem', fontWeight: 600 }}>
              Câu hỏi gợi ý cho buổi phỏng vấn:
            </h5>
            <ol className="github-interview-list">
              {data.interviewSuggestions.map((q, idx) => (
                <li key={idx}>{q}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="github-disclaimer">
          ⚠️ <strong>Lưu ý quan trọng cho HR:</strong> Dữ liệu GitHub là nguồn đối chiếu bổ trợ. Ứng
          viên có thể làm việc chủ yếu trên các repository riêng tư (private) của công ty hoặc dùng
          tài khoản khác. Việc thiếu bằng chứng công khai{' '}
          <strong>không đồng nghĩa ứng viên nói dối</strong>; HR nên sử dụng các câu hỏi gợi ý trên
          để làm rõ năng lực trong buổi phỏng vấn.
        </div>
      </div>
    </div>
  )
}
