import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { ProfileEditor } from '../ProfileEditor'
import { getProfile } from '../../../services/profile.service'
import type { Profile } from '../../../services/profile.service'
import { employmentLabels, experienceLabels, modeLabels } from '../questions'
import { ResumeLibrary } from '../../resumes/ResumeLibrary'
import './profile-page.css'

type EditSection = 'personal' | 'preferences'
type View = 'overview' | 'documents'

function ProfileEditDialog({
  section,
  onClose,
  onSaved,
}: {
  section: EditSection
  onClose: () => void
  onSaved: (profile: Profile) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      className="candidate-edit-dialog"
      aria-labelledby="profile-edit-title"
      onCancel={onClose}
    >
      <div className="candidate-dialog-header">
        <h2 id="profile-edit-title">
          {section === 'personal'
            ? 'Chỉnh sửa thông tin cá nhân'
            : 'Chỉnh sửa định hướng & kỹ năng'}
        </h2>
        <button type="button" className="icon-button" aria-label="Đóng chỉnh sửa" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <ProfileEditor section={section} onSaved={onSaved} />
    </dialog>
  )
}

function ProfileCard({
  title,
  subtitle,
  children,
  onEdit,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  onEdit?: () => void
}) {
  return (
    <section className="candidate-card">
      <div className="candidate-card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {onEdit && (
          <button
            type="button"
            className="icon-button"
            aria-label={`Chỉnh sửa ${title.toLowerCase()}`}
            onClick={onEdit}
          >
            <Pencil size={17} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()
  const view: View = searchParams.get('tab') === 'cv' ? 'documents' : 'overview'
  const setView = (nextView: View) => {
    const params = new URLSearchParams(searchParams)
    if (nextView === 'documents') params.set('tab', 'cv')
    else params.delete('tab')
    setSearchParams(params, { replace: true })
  }
  const [edit, setEdit] = useState<EditSection | null>(null)
  const [notice, setNotice] = useState('')
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [fileError, setFileError] = useState('')
  const editTrigger = useRef<HTMLElement | null>(null)
  useEffect(() => {
    let active = true
    getProfile()
      .then((data) => {
        if (active) {
          setProfile(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setLoadError('Chưa thể tải hồ sơ. Vui lòng thử lại.')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [retry])
  const openEdit = (section: EditSection) => {
    editTrigger.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setNotice('')
    setEdit(section)
  }
  const closeEdit = () => {
    setEdit(null)
    requestAnimationFrame(() => editTrigger.current?.focus())
  }

  if (loading)
    return (
      <div className="candidate-profile-surface">
        <div className="container candidate-profile-loading" role="status">
          <div className="candidate-skeleton-cover" />
          <p>Đang tải hồ sơ của bạn…</p>
        </div>
      </div>
    )
  if (!profile)
    return (
      <div className="container candidate-profile-loading">
        <h1>Hồ sơ của bạn</h1>
        <p role="alert">{loadError}</p>
        <button
          className="button"
          onClick={() => {
            setLoading(true)
            setLoadError('')
            setRetry(retry + 1)
          }}
        >
          Thử lại
        </button>
      </div>
    )

  const skills = [
    ...new Set(
      (profile.skills ?? '')
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  ]
  const initials = profile.fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const experience = profile.experienceRange
    ? experienceLabels[profile.experienceRange]
    : profile.experienceYears !== null
      ? `${profile.experienceYears} năm kinh nghiệm`
      : null
  const checklist = [
    {
      label: 'Định hướng nghề nghiệp',
      done: !!profile.desiredPosition || profile.positionUndecided,
      section: 'preferences',
    },
    {
      label: 'Kỹ năng & kinh nghiệm',
      done: skills.length > 0 && !!experience,
      section: 'preferences',
    },
    {
      label: 'Cách làm việc mong muốn',
      done: profile.workModes.length > 0 || profile.employmentTypes.length > 0,
      section: 'preferences',
    },
    { label: 'Nơi ở hiện tại', done: !!profile.location, section: 'personal' },
    { label: 'Số điện thoại liên hệ', done: !!profile.phone, section: 'personal' },
  ] as const
  const completed = checklist.filter((item) => item.done).length
  const progress = Math.round((completed / checklist.length) * 100)
  const goal = profile.positionUndecided
    ? 'Đang khám phá định hướng nghề nghiệp'
    : profile.desiredPosition
  const updated = profile.updatedAt
    ? new Date(profile.updatedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <div className="candidate-profile-surface">
      <div className="container candidate-profile-page">
        <div className="candidate-page-context">
          <span>KHÔNG GIAN CỦA BẠN</span>
          <Link to="/">
            Khám phá việc làm <ArrowRight size={15} />
          </Link>
        </div>
        <section className="candidate-identity-card" aria-label="Giới thiệu hồ sơ">
          <div className="candidate-cover">
            <div className="candidate-cover-caption">
              <span>LUMI STUDIO / CAREERS</span>
              <p>Mỗi hành trình bắt đầu từ chính bạn.</p>
            </div>
            <svg
              className="candidate-cover-art"
              viewBox="0 0 480 180"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M100 220C100 73 198-31 361-31M157 220C157 105 231 26 361 26M214 220C214 135 268 83 361 83M271 220C271 170 303 140 361 140"
                stroke="currentColor"
                strokeWidth="27"
              />
              <circle cx="406" cy="143" r="18" fill="currentColor" />
            </svg>
          </div>
          <div className="candidate-identity-body">
            <div className="candidate-profile-avatar-row">
              <div
                className="candidate-profile-avatar"
                aria-label={`Ảnh đại diện bằng chữ ${initials}`}
              >
                {initials || <UserRound size={36} />}
              </div>
              <button
                type="button"
                className="button secondary candidate-edit-identity"
                onClick={() => openEdit('personal')}
              >
                <Pencil size={16} />
                Chỉnh sửa hồ sơ
              </button>
            </div>
            <div className="candidate-identity-info">
              <div className="candidate-name-line">
                <h1>{profile.fullName}</h1>
                <span className="candidate-account-badge">
                  <ShieldCheck size={13} />
                  Ứng viên
                </span>
              </div>
              <p className={goal ? 'candidate-headline' : 'candidate-headline candidate-muted'}>
                {goal || 'Thêm định hướng để giới thiệu bản thân rõ hơn'}
              </p>
              <div className="candidate-identity-meta">
                {profile.location && (
                  <span>
                    <MapPin size={15} />
                    {profile.location}
                  </span>
                )}
                {experience && (
                  <span>
                    <BriefcaseBusiness size={15} />
                    {experience}
                  </span>
                )}
                <button type="button" onClick={() => openEdit('personal')}>
                  Thông tin liên hệ <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <nav className="candidate-profile-nav" aria-label="Các mục trong hồ sơ">
              <button
                type="button"
                aria-pressed={view === 'overview'}
                className={view === 'overview' ? 'active' : ''}
                onClick={() => setView('overview')}
              >
                <UserRound size={17} />
                Tổng quan
              </button>
              <button
                type="button"
                aria-pressed={view === 'documents'}
                className={view === 'documents' ? 'active' : ''}
                onClick={() => setView('documents')}
              >
                <FileText size={17} />
                CV & tài liệu
              </button>
            </nav>
          </div>
        </section>
        {notice && (
          <p role="status" className="candidate-save-notice">
            <Check size={16} />
            {notice}
          </p>
        )}
        <div className="candidate-profile-columns">
          <div className="candidate-main-column">
            {view === 'overview' ? (
              <>
                <ProfileCard
                  title="Định hướng nghề nghiệp"
                  subtitle="Cơ hội bạn muốn theo đuổi tại Lumi."
                  onEdit={() => openEdit('preferences')}
                >
                  <div className="candidate-goal-block">
                    <span className="candidate-section-icon">
                      <Target size={23} />
                    </span>
                    <div>
                      <h3>{goal || 'Bạn muốn bắt đầu từ đâu?'}</h3>
                      <p>
                        {goal
                          ? 'Định hướng bạn đã chọn cho hành trình tiếp theo.'
                          : 'Thêm vị trí hoặc lĩnh vực quan tâm để hoàn thiện hồ sơ.'}
                      </p>
                    </div>
                  </div>
                  <div className="candidate-detail-grid">
                    <div>
                      <span className="candidate-field-label">Loại công việc</span>
                      <div className="candidate-tag-list">
                        {profile.employmentTypes.length ? (
                          profile.employmentTypes.map((type) => (
                            <span className="candidate-tag" key={type}>
                              {employmentLabels[type] ?? type}
                            </span>
                          ))
                        ) : (
                          <span className="candidate-muted">Chưa bổ sung</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="candidate-field-label">Cách làm việc</span>
                      <div className="candidate-tag-list">
                        {profile.workModes.length ? (
                          profile.workModes.map((mode) => (
                            <span className="candidate-tag" key={mode}>
                              {modeLabels[mode] ?? mode}
                            </span>
                          ))
                        ) : (
                          <span className="candidate-muted">Chưa bổ sung</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {profile.preferredLocations.length > 0 && (
                    <p className="candidate-location-note">
                      <MapPin size={15} />
                      Địa điểm mong muốn: {profile.preferredLocations.join(', ')}
                    </p>
                  )}
                </ProfileCard>
                <ProfileCard
                  title="Kỹ năng"
                  subtitle="Những năng lực bạn mang đến cho đội ngũ."
                  onEdit={() => openEdit('preferences')}
                >
                  {skills.length ? (
                    <div className="candidate-tag-list candidate-skill-list">
                      {skills.map((skill) => (
                        <span className="candidate-skill" key={skill}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="candidate-empty-inline">
                      <p>Thêm kỹ năng chuyên môn hoặc kỹ năng mềm bạn đang có.</p>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => openEdit('preferences')}
                      >
                        Thêm kỹ năng <ArrowRight size={15} />
                      </button>
                    </div>
                  )}
                </ProfileCard>
                <ProfileCard title="Kinh nghiệm" onEdit={() => openEdit('preferences')}>
                  <div className="candidate-experience-row">
                    <span className="candidate-section-icon">
                      <GraduationCap size={22} />
                    </span>
                    <div>
                      <h3>{experience || 'Chia sẻ kinh nghiệm của bạn'}</h3>
                      <p>
                        {experience
                          ? 'Kinh nghiệm liên quan đến công việc mong muốn.'
                          : 'Mới bắt đầu cũng là một điểm khởi đầu. Bạn có thể bổ sung sau.'}
                      </p>
                    </div>
                  </div>
                </ProfileCard>
                <ProfileCard title="Thông tin liên hệ" onEdit={() => openEdit('personal')}>
                  <dl className="candidate-contact-list">
                    <div>
                      <dt>
                        <Mail size={17} />
                        Email
                      </dt>
                      <dd>{profile.email}</dd>
                    </div>
                    <div>
                      <dt>
                        <Phone size={17} />
                        Số điện thoại
                      </dt>
                      <dd className={!profile.phone ? 'candidate-muted' : ''}>
                        {profile.phone || 'Chưa bổ sung'}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <MapPin size={17} />
                        Nơi ở hiện tại
                      </dt>
                      <dd className={!profile.location ? 'candidate-muted' : ''}>
                        {profile.location || 'Chưa bổ sung'}
                      </dd>
                    </div>
                  </dl>
                </ProfileCard>
              </>
            ) : (
              <ProfileCard
                title="CV & tài liệu"
                subtitle="Chuẩn bị CV để giới thiệu kinh nghiệm và dự án của bạn."
              >
                <nav className="candidate-cv-options" aria-label="Các lựa chọn CV">
                  <span aria-current="page">
                    <FileText size={16} />
                    CV của tôi
                  </span>
                  <Link to="/cv-builder">
                    <Sparkles size={16} />
                    Tạo CV mới <ArrowRight size={14} />
                  </Link>
                </nav>
                <ResumeLibrary />
                <div className="candidate-document-empty">
                  <span className="candidate-document-icon">
                    <FileText size={32} />
                  </span>
                  <h3>{file ? 'Tệp PDF đã được chọn' : 'Tệp PDF từ máy'}</h3>
                  <p>
                    Chọn tệp để xem tên và kích thước. Chức năng tải PDF lên đang được phát triển.
                  </p>
                  <label className="button secondary candidate-file-button">
                    <Upload size={17} />
                    {file ? 'Chọn tệp khác' : 'Chọn CV từ máy'}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      aria-label="Chọn CV hồ sơ"
                      onChange={(event) => {
                        const selected = event.target.files?.[0]
                        if (!selected) return
                        if (
                          !selected.name.toLowerCase().endsWith('.pdf') ||
                          selected.size > 5 * 1024 * 1024
                        ) {
                          setFileError('Vui lòng chọn tệp PDF tối đa 5 MB.')
                          event.target.value = ''
                          return
                        }
                        setFile({ name: selected.name, size: selected.size })
                        setFileError('')
                      }}
                    />
                  </label>
                  <small>PDF · Tối đa 5 MB</small>
                </div>
                {file && (
                  <div className="candidate-document-file">
                    <FileText size={23} />
                    <div>
                      <strong>{file.name}</strong>
                      <span>{Math.max(1, Math.round(file.size / 1024))} KB · Chưa tải lên</span>
                    </div>
                  </div>
                )}
                {fileError && (
                  <p className="form-error" role="alert">
                    {fileError}
                  </p>
                )}
                <p className="candidate-document-notice">
                  Bản trải nghiệm: tệp bạn chọn chưa được tải lên hệ thống.
                </p>
              </ProfileCard>
            )}
            {updated && <p className="candidate-updated">Hồ sơ được cập nhật ngày {updated}</p>}
          </div>
          <aside className="candidate-side-column">
            <section className="candidate-cv-promo">
              <span className="candidate-cv-promo-icon">
                <Sparkles size={22} />
              </span>
              <h2>Biến hồ sơ thành CV</h2>
              <p>Chọn mẫu, điền sẵn từ Hồ sơ và chỉnh sửa nội dung theo cách của bạn.</p>
              <Link className="button" to="/cv-builder">
                Tạo CV mới <ArrowRight size={16} />
              </Link>
              <small>Chỉnh sửa & xuất PDF · Gợi ý và rà soát bằng AI</small>
            </section>
            <section className="candidate-card candidate-completion-card">
              <div className="candidate-completion-heading">
                <span
                  className="candidate-progress-ring"
                  role="progressbar"
                  aria-label="Mức hoàn thiện hồ sơ"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <svg viewBox="0 0 60 60" aria-hidden="true">
                    <circle cx="30" cy="30" r="25" fill="none" stroke="#e8ede7" strokeWidth="4" />
                    <circle
                      cx="30"
                      cy="30"
                      r="25"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray={`${progress * 1.571} 157.1`}
                      strokeLinecap="round"
                      transform="rotate(-90 30 30)"
                    />
                  </svg>
                  <strong>{progress}%</strong>
                </span>
                <div>
                  <h2>Hoàn thiện hồ sơ</h2>
                  <p>
                    {completed}/{checklist.length} mục đã bổ sung
                  </p>
                </div>
              </div>
              <p className="candidate-completion-copy">
                Từng thông tin nhỏ giúp hồ sơ của bạn rõ ràng hơn.
              </p>
              <ul className="candidate-checklist">
                {checklist.map((item) => (
                  <li key={item.label}>
                    <button type="button" onClick={() => openEdit(item.section)}>
                      <span className={item.done ? 'done' : ''}>
                        {item.done ? <Check size={12} /> : <span />}
                      </span>
                      {item.label}
                      <ChevronRight size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            <section className="candidate-card candidate-shortcuts">
              <h2>Hành trình ứng tuyển</h2>
              <Link to="/applications">
                <span className="candidate-shortcut-icon">
                  <BriefcaseBusiness size={19} />
                </span>
                <span>
                  Đơn ứng tuyển<small>Theo dõi các cơ hội của bạn</small>
                </span>
                <ChevronRight size={16} />
              </Link>
              <Link to="/saved">
                <span className="candidate-shortcut-icon">
                  <Bookmark size={19} />
                </span>
                <span>
                  Việc làm đã lưu<small>Trở lại những vị trí quan tâm</small>
                </span>
                <ChevronRight size={16} />
              </Link>
            </section>
            <div className="candidate-profile-tip">
              <span className="candidate-tip-label">MỘT GỢI Ý NHỎ</span>
              <p>
                Kỹ năng cụ thể, kinh nghiệm rõ ràng. Một hồ sơ tốt bắt đầu từ những điều thật về
                bạn.
              </p>
              <button type="button" className="text-link" onClick={() => openEdit('preferences')}>
                Cập nhật định hướng <ArrowRight size={15} />
              </button>
            </div>
          </aside>
        </div>
      </div>
      {edit && (
        <ProfileEditDialog
          section={edit}
          onClose={closeEdit}
          onSaved={(data) => {
            setProfile(data)
            setNotice('Đã lưu thay đổi vào hồ sơ.')
            closeEdit()
          }}
        />
      )}
    </div>
  )
}
