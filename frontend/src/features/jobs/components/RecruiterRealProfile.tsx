import { useEffect, useRef, useState } from 'react'
import { Pencil, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { ApiError } from '../../../services/api'
import { getDepartments, type Department } from '../../../services/job.service'
import {
  getRecruiterProfile,
  profileDraft,
  saveRecruiterProfile,
  validateProfile,
  type RecruiterProfileData,
  type RecruiterProfileDraft,
} from '../../../services/recruiter-profile.service'
import { initials } from '../recruiter-model'

const fields: [keyof RecruiterProfileDraft, string, number][] = [
  ['jobTitle', 'Chức danh', 255],
  ['employeeCode', 'Mã nhân viên', 50],
  ['phone', 'Số điện thoại', 30],
  ['avatarUrl', 'Đường dẫn ảnh đại diện', 2048],
]
const message = (e: unknown) =>
  e instanceof ApiError
    ? [e.message, ...(e.errors?.map((item) => item.message) ?? [])].join(' ')
    : 'Không thể kết nối máy chủ. Vui lòng thử lại.'

export function RecruiterRealProfile() {
  const [profile, setProfile] = useState<RecruiterProfileData | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentError, setDepartmentError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [draft, setDraft] = useState<RecruiterProfileDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failedAvatar, setFailedAvatar] = useState('')
  const savingRef = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let active = true
    getRecruiterProfile()
      .then((data) => {
        if (active) {
          setProfile(data)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (active) {
          setLoadError(message(e))
          setLoading(false)
        }
      })
    getDepartments()
      .then((data) => {
        if (active) {
          setDepartments(data)
          setDepartmentError('')
        }
      })
      .catch(() => {
        if (active)
          setDepartmentError(
            'Chưa tải được danh sách phòng ban. Bạn vẫn có thể sửa các thông tin khác hoặc tải lại hồ sơ.',
          )
      })
    return () => {
      active = false
      alive.current = false
    }
  }, [attempt])

  const reload = () => {
    setDraft(null)
    setSaveError('')
    setConflict(false)
    setSaved(false)
    setLoadError('')
    setLoading(true)
    setAttempt((n) => n + 1)
  }
  if (loading)
    return (
      <section className="hr-panel hr-profile-state" role="status">
        Đang tải hồ sơ HR…
      </section>
    )
  if (loadError || !profile)
    return (
      <section className="hr-panel hr-profile-state">
        <p className="hr-form-error" role="alert">
          {loadError || 'Không tải được hồ sơ HR.'}
        </p>
        <button className="hr-button secondary" onClick={reload}>
          <RefreshCw size={16} />
          Thử lại
        </button>
      </section>
    )

  return (
    <div className="hr-profile-grid">
      <section className="hr-panel hr-profile-summary">
        <span className="hr-avatar">
          {profile.avatarUrl && failedAvatar !== profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={`Ảnh đại diện ${profile.fullName}`}
              referrerPolicy="no-referrer"
              onError={() => setFailedAvatar(profile.avatarUrl ?? '')}
            />
          ) : (
            initials(profile.fullName)
          )}
        </span>
        <h2>{profile.fullName}</h2>
        <p>{profile.email}</p>
        <span className="hr-chip">
          {profile.role === 'COMPANY_ADMIN' ? 'QUẢN TRỊ VIÊN' : 'NHÂN SỰ TUYỂN DỤNG'}
        </span>
        <div className="hr-profile-account">
          <ShieldCheck size={20} />
          <div>
            <strong>Tài khoản đang đăng nhập</strong>
            <small>Tên, email và quyền truy cập lấy từ tài khoản của bạn.</small>
          </div>
        </div>
        {profile.avatarUrl && failedAvatar === profile.avatarUrl && (
          <p>Không tải được ảnh. Kiểm tra lại đường dẫn ảnh đại diện.</p>
        )}
      </section>
      <section className="hr-panel">
        <div className="hr-panel-heading">
          <div>
            <h2>Thông tin nhân sự</h2>
            <p>Thông tin liên hệ và vai trò công việc của bạn tại Lumi Studio.</p>
          </div>
          {!draft && (
            <button
              className="hr-button secondary"
              onClick={() => {
                setDraft(profileDraft(profile))
                setSaveError('')
                setConflict(false)
                setSaved(false)
              }}
            >
              <Pencil size={16} />
              Chỉnh sửa
            </button>
          )}
        </div>
        <div className="hr-profile-body">
          {departmentError && (
            <div className="hr-form-error" role="alert">
              <p>{departmentError}</p>
              {!draft && (
                <button className="hr-button secondary" onClick={reload}>
                  Tải lại hồ sơ
                </button>
              )}
            </div>
          )}
          {draft ? (
            <form
              className="hr-job-form"
              noValidate
              onSubmit={async (event) => {
                event.preventDefault()
                if (savingRef.current) return
                const invalid = validateProfile(draft)
                if (invalid) {
                  setSaveError(invalid)
                  return
                }
                savingRef.current = true
                setSaving(true)
                setSaveError('')
                setConflict(false)
                try {
                  const result = await saveRecruiterProfile(draft, profile.version)
                  if (alive.current) {
                    setProfile(result)
                    setDraft(null)
                    setSaved(true)
                  }
                } catch (e) {
                  if (alive.current) {
                    setSaveError(message(e))
                    setConflict(e instanceof ApiError && e.status === 409)
                  }
                } finally {
                  savingRef.current = false
                  if (alive.current) setSaving(false)
                }
              }}
            >
              <fieldset disabled={saving} className="hr-profile-inputs">
                <div className="hr-form-grid">
                  <label>
                    Phòng ban
                    <select
                      value={draft.departmentId}
                      disabled={Boolean(departmentError)}
                      onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
                    >
                      <option value="">Chưa chọn phòng ban</option>
                      {profile.departmentId &&
                        !departments.some((d) => d.id === profile.departmentId) && (
                          <option value={profile.departmentId}>
                            {profile.departmentName}
                            {!profile.departmentActive ? ' (ngừng hoạt động)' : ''}
                          </option>
                        )}
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {fields.map(([key, label, maxLength]) => (
                    <label key={key} className={key === 'avatarUrl' ? 'hr-span-2' : ''}>
                      {label}
                      <input
                        type={key === 'phone' ? 'tel' : key === 'avatarUrl' ? 'url' : 'text'}
                        value={draft[key]}
                        maxLength={maxLength}
                        autoComplete={
                          key === 'phone'
                            ? 'tel'
                            : key === 'jobTitle'
                              ? 'organization-title'
                              : 'off'
                        }
                        onChange={(event) => {
                          setDraft({ ...draft, [key]: event.target.value })
                          setSaveError('')
                          setConflict(false)
                        }}
                      />
                      {key === 'phone' && (
                        <small>7–15 chữ số, có thể thêm mã quốc gia và dấu phân cách.</small>
                      )}
                      {key === 'avatarUrl' && (
                        <small>
                          Dùng đường dẫn ảnh http/https có thể truy cập. Ảnh hiển thị sau khi lưu.
                        </small>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
              {saveError && (
                <p className="hr-form-error" role="alert">
                  {saveError}
                </p>
              )}
              {conflict && (
                <button type="button" className="hr-button secondary" onClick={reload}>
                  Tải lại hồ sơ
                </button>
              )}
              <div className="hr-form-actions">
                <button
                  type="button"
                  className="hr-button secondary"
                  disabled={saving}
                  onClick={() => {
                    setDraft(null)
                    setSaveError('')
                    setConflict(false)
                  }}
                >
                  Hủy thay đổi
                </button>
                <button type="submit" className="hr-button" disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <dl className="hr-profile-fields">
                <div>
                  <dt>Chức danh</dt>
                  <dd>{profile.jobTitle || 'Chưa bổ sung'}</dd>
                </div>
                <div>
                  <dt>Phòng ban</dt>
                  <dd>
                    {profile.departmentName || 'Chưa bổ sung'}
                    {profile.departmentId && !profile.departmentActive ? ' (ngừng hoạt động)' : ''}
                  </dd>
                </div>
                <div>
                  <dt>Mã nhân viên</dt>
                  <dd>{profile.employeeCode || 'Chưa bổ sung'}</dd>
                </div>
                <div>
                  <dt>Số điện thoại</dt>
                  <dd>{profile.phone || 'Chưa bổ sung'}</dd>
                </div>
                <div>
                  <dt>Đường dẫn ảnh đại diện</dt>
                  <dd>{profile.avatarUrl || 'Chưa bổ sung'}</dd>
                </div>
              </dl>
              {saved && (
                <p className="hr-notice" role="status">
                  Đã lưu hồ sơ nhân sự.
                </p>
              )}
            </>
          )}
          <p className="hr-detail-note">
            Các thông tin bổ sung không bắt buộc. Hồ sơ này chỉ hiển thị trong khu vực nhân sự.
            {profile.updatedAt && (
              <> Cập nhật lúc {new Date(profile.updatedAt).toLocaleString('vi-VN')}.</>
            )}
          </p>
        </div>
      </section>
    </div>
  )
}
