import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Sparkles, Eye, EyeOff, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../../app/providers/auth-context'
import { recruiterLoginDestination } from '../jobs/recruiter-route'
import { candidateJobLoginDestination } from '../jobs/candidate-job-route'

type LocationState = { from?: string }

export function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const requestedPath = (location.state as LocationState | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const destinationFor = (role: string) => {
    if (role === 'COMPANY_ADMIN' || role === 'RECRUITER') {
      const recruiterDestination = recruiterLoginDestination(requestedPath)
      if (recruiterDestination) return recruiterDestination
    }
    if (role === 'COMPANY_ADMIN') return '/admin'
    if (role !== 'CANDIDATE') return '/recruiter'
    const jobDestination = candidateJobLoginDestination(requestedPath)
    if (jobDestination) return jobDestination
    if (requestedPath && /^\/\?jobId=[0-9a-f-]{36}$/i.test(requestedPath)) return requestedPath
    if (isRegistering) return '/'
    return requestedPath && ['/', '/saved', '/profile', '/applications'].includes(requestedPath)
      ? requestedPath
      : '/'
  }

  if (loading)
    return (
      <p className="container inner-page" role="status">
        Đang kiểm tra phiên đăng nhập…
      </p>
    )
  if (user) return <Navigate to={destinationFor(user.role)} replace />

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setError('')
    if (isRegistering) {
      if (!fullName.trim()) {
        setError('Vui lòng nhập họ và tên.')
        return
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận chưa khớp.')
        return
      }
      if (new TextEncoder().encode(password).length > 72) {
        setError(
          'Mật khẩu quá dài. Vui lòng dùng tối đa 72 byte UTF-8 (ký tự có dấu chiếm nhiều byte).',
        )
        return
      }
    }
    setIsSubmitting(true)
    try {
      const result = isRegistering
        ? await signUp(email, password, fullName)
        : await signIn(email, password)
      if (!result.ok) {
        setError(result.message)
        return
      }
      setPassword('')
      setConfirmPassword('')
      navigate(destinationFor(result.user.role), { replace: true })
    } finally {
      setIsSubmitting(false)
    }
  }

  const changeMode = (registering: boolean) => {
    if (isSubmitting || registering === isRegistering) return
    setIsRegistering(registering)
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setError('')
  }

  return (
    <div className="auth-shell">
      <div className="container auth-page">
        <section className="auth-story">
          <span className="eyebrow">
            <span className="auth-live-dot" /> LUMI STUDIO · CAREERS
          </span>
          <h1>
            Bước tiếp theo.
            <br />
            <em>Một khởi đầu mới.</em>
          </h1>
          <p>
            Mang theo đam mê của bạn.
            <br />
            Cùng Lumi viết tiếp hành trình phía trước.
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-art-orbit" />
            <svg className="auth-workspace-art" viewBox="0 0 460 340" fill="none">
              <path d="M114 268V124a116 116 0 0 1 232 0v144" fill="#b7c6a7" />
              <path d="M135 249V124a95 95 0 0 1 190 0v125" fill="#e5e8ce" />
              <circle cx="277" cy="92" r="30" fill="#e9a36f" />
              <path d="M135 202c47-61 100-67 190-28v75H135Z" fill="#9cac8b" />
              <path d="M135 229c64-37 124-35 190-7v27H135Z" fill="#7e9778" />
              <path d="M230 30v219M135 143h190" stroke="#b7c6a7" strokeWidth="8" />
              <path d="M66 273h329" stroke="#eed8b6" strokeWidth="13" strokeLinecap="round" />
              <path d="m96 280-12 53m283-53 12 53" stroke="#acc09f" strokeWidth="9" />
              <rect x="172" y="194" width="112" height="71" rx="7" fill="#284c3f" />
              <rect x="179" y="201" width="98" height="55" rx="3" fill="#d6ddc1" />
              <path
                d="m213 222 10 10 20-20"
                stroke="#718c64"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M158 265h140" stroke="#75916e" strokeWidth="7" strokeLinecap="round" />
              <path d="M103 264v-57" stroke="#afc499" strokeWidth="4" />
              <ellipse
                cx="91"
                cy="221"
                rx="10"
                ry="22"
                transform="rotate(-40 91 221)"
                fill="#afc499"
              />
              <ellipse
                cx="115"
                cy="202"
                rx="10"
                ry="23"
                transform="rotate(35 115 202)"
                fill="#d1dcb5"
              />
              <path d="M84 242h39l-5 25H90Z" fill="#df996c" />
              <path d="M317 244h23v20h-23z" fill="#f0dbb7" />
              <path d="M340 249h4a5 5 0 0 1 0 10h-4" stroke="#f0dbb7" strokeWidth="3" />
            </svg>
            <div className="auth-art-tag auth-art-tag-top">
              <Sparkles size={17} /> Không gian để phát triển
            </div>
            <div className="auth-opportunity-card">
              <span className="auth-opportunity-icon">
                <BriefcaseBusiness size={22} />
              </span>
              <span>
                <small>CHƯƠNG TIẾP THEO CỦA BẠN</small>
                <strong>Bắt đầu từ một kết nối.</strong>
              </span>
              <ArrowUpRight size={23} />
            </div>
          </div>
          <div className="auth-story-bottom">
            <span>Đà Nẵng, Việt Nam</span>
            <span>
              Cùng làm. Cùng lớn lên. <ArrowUpRight size={14} />
            </span>
          </div>
        </section>
        <section className="auth-panel" aria-label="Tài khoản Lumi Studio">
          <div className="auth-mode-switch" role="group" aria-label="Chọn đăng nhập hoặc đăng ký">
            <button type="button" aria-pressed={!isRegistering} onClick={() => changeMode(false)}>
              Đăng nhập
            </button>
            <button type="button" aria-pressed={isRegistering} onClick={() => changeMode(true)}>
              Đăng ký
            </button>
          </div>
          <span className="auth-welcome">
            <Sparkles size={15} /> CƠ HỘI MỚI ĐANG CHỜ BẠN
          </span>
          <h2>{isRegistering ? 'Tạo tài khoản ứng viên' : 'Chào mừng trở lại!'}</h2>
          <p>
            {isRegistering
              ? 'Bắt đầu hành trình tìm cơ hội mới cùng Lumi Studio.'
              : 'Đăng nhập để vào đúng không gian của bạn.'}
          </p>
          <form
            key={isRegistering ? 'register' : 'login'}
            className="stack-form auth-form"
            onSubmit={submit}
            aria-busy={isSubmitting}
            onChange={() => {
              setError('')
            }}
          >
            {isRegistering && (
              <label>
                Họ và tên
                <input
                  disabled={isSubmitting}
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nguyễn Văn An"
                  maxLength={150}
                  required
                />
              </label>
            )}
            <label>
              Email
              <input
                disabled={isSubmitting}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ban@example.com"
                required
              />
            </label>
            <div className="auth-password-field">
              <label htmlFor="auth-password">Mật khẩu</label>
              <div className="auth-password-input">
                <input
                  disabled={isSubmitting}
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  minLength={isRegistering ? 6 : undefined}
                  maxLength={isRegistering ? 100 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegistering ? 'Tối thiểu 6 ký tự' : 'Nhập mật khẩu'}
                  required
                />
                <button
                  type="button"
                  disabled={isSubmitting}
                  className="auth-password-toggle"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {isRegistering && (
              <label>
                Xác nhận mật khẩu
                <input
                  disabled={isSubmitting}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  minLength={6}
                  maxLength={100}
                  required
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button full-width" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isRegistering
                  ? 'Đang tạo tài khoản…'
                  : 'Đang đăng nhập…'
                : isRegistering
                  ? 'Đăng ký'
                  : 'Đăng nhập'}{' '}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {isRegistering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
            <button type="button" className="text-link" onClick={() => changeMode(!isRegistering)}>
              {isRegistering ? 'Đăng nhập' : 'Đăng ký ngay'}
            </button>
          </p>
          <p className="small-text muted">
            {isRegistering
              ? 'Tạo tài khoản để khám phá cơ hội tại Lumi. Bạn có thể bổ sung hồ sơ sau.'
              : 'Đăng nhập để quản lý hồ sơ và theo dõi cơ hội của bạn.'}
          </p>
          <Link to="/" className="text-link">
            Tiếp tục khám phá việc làm
          </Link>
        </section>
      </div>
    </div>
  )
}
