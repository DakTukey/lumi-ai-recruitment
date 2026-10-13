import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Sprout, Plus, X } from 'lucide-react'
import { useAuth } from '../../app/providers/auth-context'
import { ApiError } from '../../services/api'
import {
  getProfile,
  getPreferenceOptions,
  saveProfile,
  saveStep,
  skipOnboarding,
} from '../../services/profile.service'
import type { Profile, ProfileInput, PreferenceOptions } from '../../services/profile.service'
import { steps, employmentLabels, modeLabels, experienceLabels } from './questions'
import { OnboardingLayout } from '../../layouts/OnboardingLayout'
import './onboarding.css'

const message = (error: unknown) =>
  error instanceof ApiError
    ? error.errors?.map((item) => item.message).join(' ') || error.message
    : 'Chưa thể lưu thông tin. Vui lòng thử lại.'
const uniqueSkills = (value: string) => [
  ...new Map(
    value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => [s.toLocaleLowerCase('vi'), s]),
  ).values(),
]

function Choices({
  title,
  values,
  selected,
  labels = {},
  onChange,
}: {
  title: string
  values: string[]
  selected: string[]
  labels?: Record<string, string>
  onChange: (values: string[]) => void
}) {
  return (
    <fieldset className="question-group">
      <legend>{title}</legend>
      <div className="choice-grid">
        {[...new Set([...values, ...selected])].map((value) => (
          <label
            key={value}
            className={`choice-card ${selected.includes(value) ? 'selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={() =>
                onChange(
                  selected.includes(value)
                    ? selected.filter((s) => s !== value)
                    : [...selected, value],
                )
              }
            />
            <span>
              {labels[value] ?? value}
              {!values.includes(value) && (
                <small>Đã chọn trước đây · hiện không còn trong danh sách</small>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ProfileEditor({
  onboarding = false,
  section,
  onSaved,
}: {
  onboarding?: boolean
  section?: 'personal' | 'preferences'
  onSaved?: (profile: Profile) => void
}) {
  const { updateProfileUser } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [options, setOptions] = useState<PreferenceOptions | null>(null)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [retry, setRetry] = useState(0)
  const [skillDraft, setSkillDraft] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    let active = true
    Promise.all([getProfile(), getPreferenceOptions()])
      .then(([data, choices]) => {
        if (active) {
          setProfile(data)
          setOptions(choices)
          setStep(data.onboardingStep)
        }
      })
      .catch((error) => {
        if (active) setError(message(error))
      })
    return () => {
      active = false
    }
  }, [retry])
  const update = (patch: Partial<ProfileInput>) => {
    setProfile((current) => (current ? { ...current, ...patch } : current))
    setSaved(false)
  }
  const skills = uniqueSkills(profile?.skills ?? '')
  const draftSkills = () => {
    const draft = skillDraft.trim()
    if (draft.includes(',')) {
      setError('Thêm từng kỹ năng riêng bằng nút Thêm.')
      return null
    }
    const next = uniqueSkills([...skills, draft].join(','))
    if (next.length > 50 || next.join(',').length > 4000) {
      setError('Bạn có thể thêm tối đa 50 kỹ năng.')
      return null
    }
    return next.join(',')
  }
  const addSkill = () => {
    const next = draftSkills()
    if (next === null) return
    update({ skills: next })
    setSkillDraft('')
    setError('')
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile || busy) return
    const nextSkills = draftSkills()
    if (nextSkills === null) return
    setBusy(true)
    setError('')
    setSaved(false)
    const input: ProfileInput = {
      fullName: profile.fullName,
      phone: profile.phone,
      location: profile.location,
      desiredPosition: profile.desiredPosition,
      skills: nextSkills,
      experienceYears: profile.experienceYears,
      employmentTypes: profile.employmentTypes,
      workModes: profile.workModes,
      preferredLocations: profile.preferredLocations,
      experienceRange: profile.experienceRange,
      positionUndecided: profile.positionUndecided,
    }
    try {
      const result = onboarding ? await saveStep(step, input) : await saveProfile(input)
      setProfile(result)
      setSkillDraft('')
      updateProfileUser(result)
      if (onboarding && step === 2) navigate('/', { replace: true })
      else if (onboarding) {
        setStep(step + 1)
        heading.current?.focus()
      } else {
        setSaved(true)
        onSaved?.(result)
      }
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  const skip = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await skipOnboarding()
      updateProfileUser(result)
      navigate('/', { replace: true })
    } catch (error) {
      setError(message(error))
    } finally {
      setBusy(false)
    }
  }
  const frame = (content: ReactNode) =>
    onboarding ? (
      <OnboardingLayout busy={busy} onSkip={() => void skip()}>
        {content}
      </OnboardingLayout>
    ) : (
      content
    )
  if (!profile || !options)
    return frame(
      <div className="panel onboarding-card">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button
              className="button"
              onClick={() => {
                setError('')
                setRetry(retry + 1)
              }}
            >
              Thử lại
            </button>
          </>
        ) : (
          <p role="status">Đang tải hồ sơ của bạn…</p>
        )}
      </div>,
    )
  const personal = !onboarding && section !== 'preferences'
  const goal = onboarding ? step === 0 : section !== 'personal'
  const experience = onboarding ? step === 1 : section !== 'personal'
  const work = onboarding ? step === 2 : section !== 'personal'
  return frame(
    <form className="panel stack-form onboarding-card" onSubmit={save} aria-busy={busy}>
      {onboarding && (
        <ol className="onboarding-progress" aria-label="Tiến trình tìm hiểu mong muốn">
          {steps.map((item, i) => (
            <li
              key={item.title}
              aria-current={step === i ? 'step' : undefined}
              className={i <= step ? 'active' : ''}
            >
              <span>{i < step ? <Check size={16} /> : i + 1}</span>
              <small>{item.title}</small>
            </li>
          ))}
        </ol>
      )}
      <div className="profile-section-heading">
        <div>
          <span className="eyebrow">{onboarding ? `BƯỚC ${step + 1} / 3` : 'HỒ SƠ CỦA BẠN'}</span>
          <h2 ref={heading} tabIndex={-1}>
            {onboarding
              ? steps[step].title
              : personal
                ? 'Thông tin cá nhân'
                : 'Mong muốn & kinh nghiệm'}
          </h2>
          <p>
            {onboarding
              ? steps[step].description
              : 'Thông tin được lưu vào hồ sơ và có thể chỉnh sửa bất cứ lúc nào.'}
          </p>
        </div>
        <Sprout size={26} />
      </div>
      {onboarding && <p className="question-hint">Tất cả câu trả lời đều không bắt buộc.</p>}
      <fieldset disabled={busy} className="onboarding-fields">
        {personal && (
          <>
            <label>
              Họ và tên
              <input
                autoComplete="name"
                required
                maxLength={150}
                value={profile.fullName}
                onChange={(e) => update({ fullName: e.target.value })}
              />
            </label>
            <label>
              Email
              <input value={profile.email} readOnly />
            </label>
            <label>
              Nơi ở hiện tại
              <input
                autoComplete="address-level2"
                maxLength={255}
                value={profile.location ?? ''}
                onChange={(e) => update({ location: e.target.value })}
              />
            </label>
            <label>
              Số điện thoại liên hệ
              <input
                type="tel"
                autoComplete="tel"
                maxLength={30}
                value={profile.phone ?? ''}
                onChange={(e) => update({ phone: e.target.value })}
              />
            </label>
          </>
        )}
        {goal && (
          <>
            <label>
              Vị trí hoặc lĩnh vực bạn quan tâm
              <input
                list="position-suggestions"
                maxLength={255}
                placeholder="Tìm hoặc nhập vị trí, lĩnh vực của bạn"
                value={profile.desiredPosition ?? ''}
                onChange={(e) =>
                  update({ desiredPosition: e.target.value, positionUndecided: false })
                }
              />
            </label>
            <datalist id="position-suggestions">
              {options.positions.map((position) => (
                <option key={position} value={position} />
              ))}
            </datalist>
            <div className="choice-chips" aria-label="Gợi ý định hướng">
              {options.positions.map((position) => (
                <button
                  type="button"
                  key={position}
                  aria-pressed={!profile.positionUndecided && profile.desiredPosition === position}
                  onClick={() => update({ desiredPosition: position, positionUndecided: false })}
                >
                  {position}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={profile.positionUndecided}
                onClick={() =>
                  update({ positionUndecided: !profile.positionUndecided, desiredPosition: null })
                }
              >
                Chưa xác định
              </button>
            </div>
            <p className="question-hint">
              Đây là gợi ý cách mô tả định hướng, không phải danh sách vị trí đang tuyển.
            </p>
            <Choices
              title="Bạn quan tâm loại công việc nào?"
              values={options.employmentTypes}
              selected={profile.employmentTypes}
              labels={employmentLabels}
              onChange={(employmentTypes) => update({ employmentTypes })}
            />
          </>
        )}
        {experience && (
          <>
            <fieldset className="question-group">
              <legend>Kinh nghiệm liên quan đến công việc mong muốn</legend>
              <div className="choice-grid">
                {Object.entries(experienceLabels).map(([value, label]) => (
                  <label
                    className={`choice-card ${profile.experienceRange === value ? 'selected' : ''}`}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="experienceRange"
                      checked={profile.experienceRange === value}
                      onChange={() => update({ experienceRange: value, experienceYears: null })}
                    />
                    <span>{label}</span>
                  </label>
                ))}
                <label className={`choice-card ${!profile.experienceRange ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="experienceRange"
                    checked={!profile.experienceRange}
                    onChange={() => update({ experienceRange: null, experienceYears: null })}
                  />
                  <span>Chưa muốn trả lời</span>
                </label>
              </div>
            </fieldset>
            {profile.experienceYears !== null && (
              <p className="question-hint">
                Hồ sơ trước đây đã lưu {profile.experienceYears} năm. Chọn một khoảng mới sẽ thay
                thế số năm chính xác này.
              </p>
            )}
            <fieldset className="question-group">
              <legend>Những kỹ năng bạn đang có</legend>
              <p className="question-hint">Chọn kỹ năng gợi ý hoặc thêm kỹ năng của riêng bạn.</p>
              <div className="choice-chips" aria-label="Kỹ năng gợi ý">
                {options.skills.map((skill) => {
                  const selected = skills.some((s) => s.toLowerCase() === skill.toLowerCase())
                  return (
                    <button
                      type="button"
                      key={skill}
                      aria-pressed={selected}
                      onClick={() => {
                        if (!selected && skills.length >= 50) {
                          setError('Bạn có thể thêm tối đa 50 kỹ năng.')
                          return
                        }
                        update({
                          skills: (selected
                            ? skills.filter((s) => s.toLowerCase() !== skill.toLowerCase())
                            : [...skills, skill]
                          ).join(','),
                        })
                      }}
                    >
                      {selected && <Check size={14} />} {skill}
                    </button>
                  )
                })}
              </div>
              <label htmlFor="custom-skill">Thêm kỹ năng khác</label>
              <div className="skill-entry">
                <input
                  id="custom-skill"
                  maxLength={80}
                  placeholder="Ví dụ: Docker"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={!skillDraft.trim()}
                  onClick={addSkill}
                >
                  <Plus size={16} />
                  Thêm
                </button>
              </div>
              {!!skills.length && (
                <div className="chosen-skills" aria-label="Kỹ năng đã chọn">
                  {skills.map((skill) => (
                    <button
                      type="button"
                      key={skill.toLowerCase()}
                      aria-label={`Bỏ kỹ năng ${skill}`}
                      onClick={() =>
                        update({ skills: skills.filter((s) => s !== skill).join(',') })
                      }
                    >
                      {skill}
                      <X size={14} />
                    </button>
                  ))}
                </div>
              )}
            </fieldset>
          </>
        )}
        {work && (
          <>
            <Choices
              title="Hình thức làm việc phù hợp với bạn"
              values={options.workModes}
              selected={profile.workModes}
              labels={modeLabels}
              onChange={(workModes) => update({ workModes })}
            />
            {options.locations.length > 1 || profile.preferredLocations.length > 0 ? (
              <Choices
                title="Bạn muốn làm việc tại đâu?"
                values={options.locations}
                selected={profile.preferredLocations}
                onChange={(preferredLocations) => update({ preferredLocations })}
              />
            ) : (
              options.locations.length === 1 && (
                <div className="info-note">
                  Văn phòng Lumi ở {options.locations[0]}. Bạn có thể chọn cách làm việc phù hợp với
                  mình ở trên.
                </div>
              )
            )}
            <p className="question-hint">
              Đây là mong muốn của bạn. Hình thức và địa điểm cụ thể được ghi trong từng tin tuyển
              dụng.
            </p>
          </>
        )}
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {saved && <p role="status">Đã lưu thông tin vào hồ sơ.</p>}
      <div className="onboarding-actions">
        {onboarding && step > 0 && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setStep(step - 1)
              setError('')
            }}
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>
        )}
        <button type="submit" className="button" disabled={busy}>
          {busy
            ? 'Đang lưu…'
            : onboarding
              ? step === 2
                ? 'Lưu và khám phá việc làm'
                : 'Tiếp tục'
              : 'Lưu thông tin'}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>,
  )
}
