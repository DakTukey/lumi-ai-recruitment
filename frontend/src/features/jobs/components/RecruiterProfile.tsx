import { useState, type ComponentProps } from 'react'
import { RecruiterRealProfile } from './RecruiterRealProfile'
import { Pencil, Save, ShieldCheck } from 'lucide-react'
import type { User } from '../../../types/domain'
import type { HrProfile } from '../recruiter-model'
import { initials } from '../recruiter-model'

function RecruiterDemoProfile({
  user,
  demo,
  profile,
  onSave,
  onSample,
}: {
  user: User | null
  demo: boolean
  profile: HrProfile
  onSave: (profile: HrProfile) => void
  onSample: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const fields: [keyof HrProfile, string][] = [
    ['jobTitle', 'Chức danh'],
    ['department', 'Phòng ban'],
    ['employeeCode', 'Mã nhân viên'],
    ['phone', 'Số điện thoại'],
    ['avatarUrl', 'Đường dẫn ảnh đại diện'],
  ]
  return (
    <div className="hr-profile-grid">
      <section className="hr-panel hr-profile-summary">
        <span className="hr-avatar">{initials(user?.fullName ?? 'Nhân sự')}</span>
        <h2>{user?.fullName}</h2>
        <p>{user?.email}</p>
        <span className="hr-chip">
          {user?.role === 'COMPANY_ADMIN' ? 'QUẢN TRỊ VIÊN' : 'NHÂN SỰ TUYỂN DỤNG'}
        </span>
        <div className="hr-profile-account">
          <ShieldCheck size={20} />
          <div>
            <strong>Tài khoản đang đăng nhập</strong>
            <small>Tên, email và quyền truy cập lấy từ tài khoản thật.</small>
          </div>
        </div>
      </section>
      <section className="hr-panel">
        <div className="hr-panel-heading">
          <div>
            <h2>Thông tin nhân sự</h2>
            <p>
              {demo
                ? 'Thử chỉnh sửa hồ sơ HR trong phiên trải nghiệm.'
                : 'Thông tin bổ sung chưa được kết nối để xem hoặc cập nhật.'}
            </p>
          </div>
          {demo && !editing && (
            <button
              className="hr-button secondary"
              onClick={() => {
                setDraft(profile)
                setEditing(true)
                setSaved(false)
              }}
            >
              <Pencil size={16} />
              Chỉnh sửa mẫu
            </button>
          )}
        </div>
        <div className="hr-profile-body">
          {editing && demo ? (
            <form
              className="hr-job-form"
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                const cleaned = Object.fromEntries(
                  Object.entries(draft).map(([key, value]) => [key, value.trim()]),
                ) as HrProfile
                if (cleaned.phone && !/^\+?[\d\s().-]{8,20}$/.test(cleaned.phone)) {
                  setError('Số điện thoại cần từ 8 đến 20 ký tự, gồm số và dấu phân cách.')
                  return
                }
                if (cleaned.avatarUrl) {
                  try {
                    const url = new URL(cleaned.avatarUrl)
                    if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
                  } catch {
                    setError('Đường dẫn ảnh cần là URL http hoặc https hợp lệ.')
                    return
                  }
                }
                onSave(cleaned)
                setEditing(false)
                setError('')
                setSaved(true)
              }}
            >
              <div className="hr-form-grid">
                {fields.map(([key, label]) => (
                  <label key={key} className={key === 'avatarUrl' ? 'hr-span-2' : ''}>
                    {label}
                    <input
                      type={key === 'phone' ? 'tel' : 'text'}
                      maxLength={
                        key === 'avatarUrl'
                          ? 2048
                          : key === 'employeeCode'
                            ? 50
                            : key === 'phone'
                              ? 30
                              : 255
                      }
                      value={draft[key]}
                      onChange={(event) => {
                        setDraft({ ...draft, [key]: event.target.value })
                        setError('')
                      }}
                    />
                    {key === 'avatarUrl' && (
                      <small>
                        Bản mẫu chỉ lưu đường dẫn trong phiên, chưa tải ảnh lên hoặc thay ảnh tài
                        khoản.
                      </small>
                    )}
                  </label>
                ))}
              </div>
              {error && (
                <p role="alert" className="hr-form-error">
                  {error}
                </p>
              )}
              <div className="hr-form-actions">
                <button
                  type="button"
                  className="hr-button secondary"
                  onClick={() => {
                    setEditing(false)
                    setError('')
                  }}
                >
                  Hủy thay đổi
                </button>
                <button type="submit" className="hr-button">
                  <Save size={16} />
                  Lưu hồ sơ mẫu
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="hr-profile-fields">
                {fields.map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{demo ? profile[key] || 'Chưa bổ sung' : 'Chưa kết nối'}</dd>
                  </div>
                ))}
              </dl>
              {saved && (
                <p className="hr-notice" role="status">
                  Đã lưu hồ sơ mẫu trong phiên này.
                </p>
              )}
              {!demo && (
                <button className="hr-button secondary" onClick={onSample}>
                  Xem giao diện hồ sơ mẫu
                </button>
              )}
            </>
          )}
          <p className="hr-detail-note">
            {demo
              ? 'Các trường bên phải là dữ liệu minh họa. Không cập nhật hồ sơ tài khoản thật.'
              : 'Bạn có thể kiểm tra bố cục và thử chỉnh sửa bằng chế độ “Xem mẫu”.'}
          </p>
        </div>
      </section>
    </div>
  )
}

export function RecruiterProfile(props: ComponentProps<typeof RecruiterDemoProfile>) {
  return props.demo ? <RecruiterDemoProfile {...props} /> : <RecruiterRealProfile />
}
