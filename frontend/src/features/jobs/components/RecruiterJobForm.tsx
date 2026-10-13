import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Eye, FileText, Plus, Send, X } from 'lucide-react'
import type { JobDraft, RecruiterJob, SalaryMode, CriterionType } from '../recruiter-model'
import {
  contractLabels,
  criterionLabels,
  emptyDraft,
  jobWorkLocation,
  salaryLabel,
  validateDraft,
} from '../recruiter-model'
import { RecruiterJobPreview } from './RecruiterJobPreview'
import type { Department } from '../../../services/job.service'
import { getRecruiterPositions, type JobPosition } from '../../../services/recruiter-job.service'
import {
  samplePositionNames,
  selectJobPosition,
  selectJobLevel,
  suggestedJobTitle,
} from '../job-position-model'

const steps = ['Thông tin vị trí', 'Yêu cầu & nội dung', 'Xem trước']
const firstFields = new Set([
  'title',
  'headcount',
  'location',
  'salaryMin',
  'salaryMax',
  'deadline',
  'departmentId',
  'positionId',
])
export function RecruiterJobForm({
  job,
  onSave,
  onCancel,
  onDirty,
  demo = true,
  departments = [],
  departmentError = false,
  saving = false,
  saveError = '',
  initialDraft,
  onDraftChange,
}: {
  job?: RecruiterJob
  onSave: (draft: JobDraft, publish: boolean) => void
  onCancel: () => void
  onDirty: () => void
  demo?: boolean
  departments?: Department[]
  departmentError?: boolean
  onCreateDepartment?: (name: string) => Promise<Department>
  saving?: boolean
  saveError?: string
  initialDraft?: JobDraft
  onDraftChange?: (draft: JobDraft) => void
}) {
  const [draft, setDraft] = useState<JobDraft>(() => {
    const initial = structuredClone(
      job?.draft ??
        initialDraft ?? { ...emptyDraft(), ...(demo ? {} : { category: '', departmentId: '' }) },
    )
    return { ...initial, location: jobWorkLocation(initial.mode) }
  })
  const [step, setStep] = useState(0)
  useEffect(() => {
    onDraftChange?.(draft)
  }, [draft, onDraftChange])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [skillName, setSkillName] = useState('')
  const [skillRequired, setSkillRequired] = useState(true)
  const [skillError, setSkillError] = useState('')
  const [positionRetry, setPositionRetry] = useState(0)
  const [positionResult, setPositionResult] = useState<{
    key: string
    items: JobPosition[]
    error: string
  } | null>(null)
  const positionKey = `${draft.departmentId}:${positionRetry}`
  const currentPositions = positionResult?.key === positionKey ? positionResult : null
  const positions = demo
    ? (samplePositionNames[draft.category] ?? []).map((name) => ({
        id: `sample-${name}`,
        departmentId: draft.category,
        name,
      }))
    : (currentPositions?.items ?? [])
  const positionsLoading = !demo && !!draft.departmentId && !currentPositions
  useEffect(() => {
    if (demo || !draft.departmentId) return
    let active = true
    getRecruiterPositions(draft.departmentId)
      .then((items) => {
        if (active) setPositionResult({ key: positionKey, items, error: '' })
      })
      .catch(() => {
        if (active)
          setPositionResult({
            key: positionKey,
            items: [],
            error: 'Chưa tải được danh mục vị trí.',
          })
      })
    return () => {
      active = false
    }
  }, [demo, draft.departmentId, positionKey])
  const alert = useRef<HTMLDivElement>(null)
  const change = <K extends keyof JobDraft>(key: K, value: JobDraft[K]) => {
    onDirty()
    setDraft((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      const next = { ...previous }
      delete next[key]
      return next
    })
  }
  const fieldError = (key: string) =>
    errors[key] && (
      <small className="hr-field-error" id={`error-${key}`}>
        {errors[key]}
      </small>
    )
  const errorProps = (key: string) => ({
    'aria-invalid': !!errors[key],
    'aria-describedby': errors[key] ? `error-${key}` : undefined,
  })
  function check(all = true, publish = false) {
    const result = validateDraft(draft, publish)
    if (!demo && !departments.some((item) => item.id === draft.departmentId))
      result.departmentId = 'Chọn phòng ban đang hoạt động.'
    if (!positions.some((item) => item.id === draft.positionId))
      result.positionId = 'Chọn vị trí đang hoạt động thuộc phòng ban.'
    const checked = all
      ? result
      : Object.fromEntries(Object.entries(result).filter(([key]) => firstFields.has(key)))
    setErrors(checked)
    if (Object.keys(checked).length) {
      setStep(Object.keys(checked).some((key) => firstFields.has(key)) ? 0 : 1)
      requestAnimationFrame(() => alert.current?.focus())
      return false
    }
    return true
  }
  function addSkill() {
    const name = skillName.replace(/\s+/g, ' ').trim()
    if (!name) {
      setSkillError('Nhập tên kỹ năng.')
      return
    }
    if (draft.skills.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      setSkillError('Kỹ năng này đã có trong danh sách.')
      return
    }
    change('skills', [...draft.skills, { name, required: skillRequired }])
    setSkillName('')
    setSkillError('')
  }
  const preview = useMemo(
    () => ({
      id: 'preview',
      title: draft.title,
      headcount: Number(draft.headcount),
      company: 'Lumi Studio',
      mark: 'lumi',
      color: 'violet',
      category: draft.category,
      level: draft.level,
      mode: draft.mode,
      location: draft.location,
      employmentType: draft.employmentType,
      deadline: draft.deadline || null,
      salary:
        draft.salaryMode !== 'NEGOTIABLE' && !draft.salaryMin && !draft.salaryMax
          ? 'Chưa nhập mức lương'
          : salaryLabel(draft),
      minSalary: 0,
      tags: draft.skills.map((item) => item.name),
      description: draft.description,
      requirements: draft.requirements,
      benefits: draft.benefits,
      posted: '',
      ageHours: 0,
      draft,
    }),
    [draft],
  )

  return (
    <form
      className="hr-job-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!saving && check(true, job?.status === 'PUBLISHED')) onSave(draft, false)
      }}
    >
      <fieldset className="hr-form-content" disabled={saving}>
        <div className="hr-form-steps" aria-label="Các bước soạn tin">
          {steps.map((label, index) => (
            <button
              type="button"
              key={label}
              aria-current={step === index ? 'step' : undefined}
              className={step === index ? 'active' : ''}
              onClick={() => {
                if (index === 0 || check(index === 2)) setStep(index)
              }}
            >
              <span>{step > index ? <Check size={14} /> : index + 1}</span>
              <strong>{label}</strong>
            </button>
          ))}
        </div>
        <p className="hr-form-intro">
          {!demo
            ? job
              ? 'Sửa nội dung và lưu thay đổi. Tin giữ nguyên trạng thái; bạn đăng hoặc mở lại sau khi đã kiểm tra.'
              : 'Soạn nội dung và lưu bản nháp. Tin chưa hiển thị cho ứng viên cho đến khi được đăng tuyển.'
            : job
              ? 'Chỉnh sửa nội dung tin mẫu. Các thay đổi không ghi vào dữ liệu thật.'
              : 'Soạn tin, kiểm tra nội dung rồi lưu nháp hoặc thử đăng. Thao tác chỉ trong bản mẫu.'}
        </p>
        {saveError && (
          <div className="hr-form-error" role="alert">
            {saveError}
          </div>
        )}
        {Object.keys(errors).length > 0 && (
          <div className="hr-form-error" role="alert" tabIndex={-1} ref={alert}>
            <strong>Kiểm tra lại các trường được đánh dấu.</strong>
            <p>{Object.values(errors).join(' ')}</p>
          </div>
        )}
        {step === 0 && (
          <>
            <fieldset>
              <legend>Thông tin vị trí</legend>
              <p className="hr-form-intro">
                Chọn phòng ban, vị trí và cấp độ. Tiêu đề tin sẽ được gợi ý để bạn điều chỉnh theo
                đợt tuyển.
              </p>
              <div className="hr-form-grid">
                <label>
                  Phòng ban <span>*</span>
                  <select
                    required
                    value={demo ? draft.category : (draft.departmentId ?? '')}
                    onChange={(event) => {
                      const value = event.target.value
                      onDirty()
                      setDraft((previous) => ({
                        ...selectJobPosition(previous, '', ''),
                        departmentId: demo ? '' : value,
                        category: demo
                          ? value
                          : (departments.find((item) => item.id === value)?.name ?? ''),
                      }))
                      setErrors((previous) =>
                        Object.fromEntries(
                          Object.entries(previous).filter(
                            ([key]) => !['departmentId', 'positionId', 'title'].includes(key),
                          ),
                        ),
                      )
                    }}
                    {...errorProps('departmentId')}
                  >
                    <option value="">Chọn phòng ban</option>
                    {!demo
                      ? departments.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))
                      : Object.keys(samplePositionNames).map((name) => (
                          <option key={name}>{name}</option>
                        ))}
                  </select>
                  {fieldError('departmentId')}
                </label>
                <label>
                  Vị trí / chức danh <span>*</span>
                  <select
                    required
                    disabled={positionsLoading || !(demo ? draft.category : draft.departmentId)}
                    value={draft.positionId ?? ''}
                    onChange={(event) => {
                      const position = positions.find((item) => item.id === event.target.value)
                      onDirty()
                      setDraft((previous) =>
                        selectJobPosition(previous, position?.id ?? '', position?.name ?? ''),
                      )
                      setErrors((previous) =>
                        Object.fromEntries(
                          Object.entries(previous).filter(
                            ([key]) => !['positionId', 'title'].includes(key),
                          ),
                        ),
                      )
                    }}
                    {...errorProps('positionId')}
                  >
                    <option value="">
                      {positionsLoading ? 'Đang tải vị trí…' : 'Chọn vị trí'}
                    </option>
                    {positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldError('positionId')}
                </label>
                <label>
                  Cấp độ kinh nghiệm
                  <select
                    value={draft.level}
                    onChange={(event) => {
                      const level = event.target.value
                      onDirty()
                      setDraft((previous) => selectJobLevel(previous, level))
                      setErrors((previous) =>
                        Object.fromEntries(
                          Object.entries(previous).filter(([key]) => key !== 'title'),
                        ),
                      )
                    }}
                  >
                    {['Intern', 'Junior', 'Middle', 'Senior'].map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Số lượng cần tuyển <span>*</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    required
                    min="1"
                    max="2147483647"
                    step="1"
                    value={draft.headcount}
                    onChange={(event) => change('headcount', event.target.value)}
                    {...errorProps('headcount')}
                  />
                  {fieldError('headcount')}
                </label>
                <label className="hr-span-2">
                  Tiêu đề tin tuyển dụng <span>*</span>
                  <input
                    required
                    maxLength={255}
                    value={draft.title}
                    placeholder="Ví dụ: Junior Backend Developer — Java"
                    onChange={(event) => change('title', event.target.value)}
                    {...errorProps('title')}
                  />
                  <small>
                    Tự gợi ý theo vị trí và cấp độ. Bạn có thể sửa cho phù hợp với đợt tuyển.
                  </small>
                  {fieldError('title')}
                </label>
                <div className="hr-span-2">
                  <button
                    type="button"
                    className="hr-button secondary"
                    disabled={!draft.positionName}
                    onClick={() =>
                      change('title', suggestedJobTitle(draft.positionName ?? '', draft.level))
                    }
                  >
                    Dùng tiêu đề gợi ý
                  </button>
                  {job && !job.draft.positionId && (
                    <p>Tin cũ chưa có chức danh. Chọn vị trí trước khi lưu thay đổi.</p>
                  )}
                  {departmentError && (
                    <p className="hr-field-error" role="alert">
                      Chưa tải được phòng ban. Đóng form và tải lại danh sách để thử lại.
                    </p>
                  )}
                  {!demo && !departments.length && !departmentError && (
                    <p>Chưa có phòng ban. Liên hệ quản trị viên để bổ sung danh mục.</p>
                  )}
                  {!demo && currentPositions?.error && (
                    <div role="alert">
                      <p className="hr-field-error">{currentPositions.error}</p>
                      <button
                        type="button"
                        className="hr-button secondary"
                        onClick={() => setPositionRetry((value) => value + 1)}
                      >
                        Tải lại vị trí
                      </button>
                    </div>
                  )}
                  {!positionsLoading &&
                    !currentPositions?.error &&
                    !!(demo ? draft.category : draft.departmentId) &&
                    !positions.length && (
                      <p>
                        Phòng ban này chưa có vị trí tuyển dụng. Liên hệ quản trị viên để bổ sung
                        danh mục.
                      </p>
                    )}
                </div>
                <label>
                  Hình thức hợp đồng
                  <select
                    value={draft.employmentType}
                    onChange={(event) => change('employmentType', event.target.value)}
                  >
                    {Object.entries(contractLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cách làm việc
                  <select
                    value={draft.mode}
                    onChange={(event) => {
                      const mode = event.target.value
                      onDirty()
                      setDraft((previous) => ({
                        ...previous,
                        mode,
                        location: jobWorkLocation(mode),
                      }))
                    }}
                  >
                    {['Hybrid', 'Remote', 'Tại văn phòng'].map((mode) => (
                      <option key={mode}>{mode}</option>
                    ))}
                  </select>
                </label>
                <label className="hr-span-2">
                  Địa điểm làm việc
                  <input readOnly value={draft.location} />
                  <small>
                    {draft.mode === 'Remote'
                      ? 'Vị trí làm việc từ xa, không yêu cầu đến văn phòng.'
                      : 'Công ty hiện có một văn phòng tại Đà Nẵng. Địa điểm được điền tự động.'}
                  </small>
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>Lương & thời hạn</legend>
              <label>
                Cách hiển thị lương
                <select
                  value={draft.salaryMode}
                  onChange={(event) => {
                    change('salaryMode', event.target.value as SalaryMode)
                    setErrors((previous) => {
                      const next = { ...previous }
                      delete next.salaryMin
                      delete next.salaryMax
                      return next
                    })
                  }}
                >
                  <option value="NEGOTIABLE">Thỏa thuận</option>
                  <option value="RANGE">Khoảng lương</option>
                  <option value="FROM">Từ một mức lương</option>
                  <option value="UP_TO">Đến một mức lương</option>
                </select>
              </label>
              {draft.salaryMode !== 'NEGOTIABLE' && (
                <>
                  <div className="hr-form-grid">
                    {draft.salaryMode !== 'UP_TO' && (
                      <label>
                        Lương từ (VND/tháng) <span>*</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1000"
                          value={draft.salaryMin}
                          placeholder="15000000"
                          onChange={(event) => change('salaryMin', event.target.value)}
                          {...errorProps('salaryMin')}
                        />
                        {fieldError('salaryMin')}
                      </label>
                    )}
                    {draft.salaryMode !== 'FROM' && (
                      <label>
                        Lương đến (VND/tháng) <span>*</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          step="1000"
                          value={draft.salaryMax}
                          placeholder="25000000"
                          onChange={(event) => change('salaryMax', event.target.value)}
                          {...errorProps('salaryMax')}
                        />
                        {fieldError('salaryMax')}
                      </label>
                    )}
                  </div>
                  <p className="hr-control-hint">
                    Nhập số tiền đầy đủ, ví dụ 15.000.000 VND cho 15 triệu đồng.
                  </p>
                </>
              )}
              <label>
                Hạn nộp hồ sơ
                <input
                  type="date"
                  value={draft.deadline}
                  onInput={(event) => change('deadline', event.currentTarget.value)}
                  {...errorProps('deadline')}
                />
                <small>Để trống nếu không giới hạn. Hạn nộp tính hết ngày theo giờ Việt Nam.</small>
                {fieldError('deadline')}
              </label>
            </fieldset>
          </>
        )}
        {step === 1 && (
          <>
            <fieldset>
              <legend>
                Kỹ năng yêu cầu <span>*</span>
              </legend>
              <div className="hr-skill-entry">
                <label>
                  Tên kỹ năng
                  <input
                    maxLength={100}
                    value={skillName}
                    placeholder="Ví dụ: React, Docker…"
                    onChange={(event) => {
                      setSkillName(event.target.value)
                      setSkillError('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addSkill()
                      }
                    }}
                  />
                </label>
                <label>
                  Mức yêu cầu
                  <select
                    value={skillRequired ? 'required' : 'preferred'}
                    onChange={(event) => setSkillRequired(event.target.value === 'required')}
                  >
                    <option value="required">Bắt buộc</option>
                    <option value="preferred">Ưu tiên</option>
                  </select>
                </label>
                <button className="hr-button secondary" type="button" onClick={addSkill}>
                  <Plus size={16} />
                  Thêm
                </button>
              </div>
              {skillError && (
                <p className="hr-field-error" role="alert">
                  {skillError}
                </p>
              )}
              {fieldError('skills')}
              <div className="hr-skill-editor">
                {draft.skills.map((item, index) => (
                  <div key={item.name}>
                    <strong>{item.name}</strong>
                    <label className="hr-checkbox">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(event) =>
                          change(
                            'skills',
                            draft.skills.map((skill, i) =>
                              i === index ? { ...skill, required: event.target.checked } : skill,
                            ),
                          )
                        }
                      />
                      Bắt buộc
                    </label>
                    <button
                      type="button"
                      className="hr-icon-button"
                      aria-label={`Xóa kỹ năng ${item.name}`}
                      onClick={() =>
                        change(
                          'skills',
                          draft.skills.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <small className="hr-control-hint">
                Bỏ chọn “Bắt buộc” để đánh dấu kỹ năng ưu tiên. Không thêm kỹ năng trùng.
              </small>
            </fieldset>
            <fieldset>
              <legend>Tiêu chí tuyển dụng</legend>
              <p className="hr-control-hint">
                Các yêu cầu ngoài kỹ năng. Trọng số dùng khi đối chiếu hồ sơ, không hiển thị trong
                bản xem trước công khai.
              </p>
              {draft.criteria.map((item, index) => (
                <div className="hr-criterion-editor" key={item.id}>
                  <div className="hr-inline-heading">
                    <strong>Tiêu chí {index + 1}</strong>
                    <button
                      type="button"
                      className="hr-icon-button"
                      aria-label={`Xóa tiêu chí ${index + 1}`}
                      onClick={() =>
                        change(
                          'criteria',
                          draft.criteria.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="hr-form-grid">
                    <label>
                      Loại tiêu chí {index + 1}
                      <select
                        value={item.type}
                        onChange={(event) =>
                          change(
                            'criteria',
                            draft.criteria.map((criterion, i) =>
                              i === index
                                ? { ...criterion, type: event.target.value as CriterionType }
                                : criterion,
                            ),
                          )
                        }
                      >
                        {Object.entries(criterionLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Trọng số tiêu chí {index + 1}
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={Number.isFinite(item.weight) ? item.weight : ''}
                        onChange={(event) =>
                          change(
                            'criteria',
                            draft.criteria.map((criterion, i) =>
                              i === index
                                ? {
                                    ...criterion,
                                    weight:
                                      event.target.value === '' ? NaN : Number(event.target.value),
                                  }
                                : criterion,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Mô tả tiêu chí {index + 1}
                    <textarea
                      rows={2}
                      value={item.description}
                      placeholder="Ví dụ: Có ít nhất 1 năm kinh nghiệm làm việc thực tế…"
                      onChange={(event) =>
                        change(
                          'criteria',
                          draft.criteria.map((criterion, i) =>
                            i === index
                              ? { ...criterion, description: event.target.value }
                              : criterion,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="hr-checkbox">
                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(event) =>
                        change(
                          'criteria',
                          draft.criteria.map((criterion, i) =>
                            i === index
                              ? { ...criterion, required: event.target.checked }
                              : criterion,
                          ),
                        )
                      }
                    />
                    Tiêu chí bắt buộc
                  </label>
                </div>
              ))}
              {fieldError('criteria')}
              <button
                type="button"
                className="hr-button secondary"
                onClick={() =>
                  change('criteria', [
                    ...draft.criteria,
                    {
                      id: crypto.randomUUID(),
                      type: 'EXPERIENCE',
                      description: '',
                      required: true,
                      weight: 1,
                    },
                  ])
                }
              >
                <Plus size={16} />
                Thêm tiêu chí
              </button>
            </fieldset>
            <fieldset>
              <legend>Nội dung tin</legend>
              {(['description', 'requirements', 'benefits'] as const).map((key) => (
                <label key={key}>
                  {
                    {
                      description: 'Mô tả công việc',
                      requirements: 'Yêu cầu ứng viên',
                      benefits: 'Quyền lợi',
                    }[key]
                  }
                  {key !== 'benefits' && <span> *</span>}
                  <textarea
                    rows={key === 'description' ? 5 : 4}
                    value={draft[key]}
                    placeholder={
                      {
                        description: 'Trách nhiệm, sản phẩm và công việc hằng ngày…',
                        requirements: 'Kinh nghiệm, kiến thức và yêu cầu cần đáp ứng…',
                        benefits: 'Chế độ đãi ngộ và cơ hội phát triển…',
                      }[key]
                    }
                    onChange={(event) => change(key, event.target.value)}
                    {...errorProps(key)}
                  />
                  {fieldError(key)}
                </label>
              ))}
            </fieldset>
          </>
        )}
        {step === 2 && (
          <>
            <div className="hr-preview-label">
              <Eye size={17} />
              <span>Bản xem trước nội dung ứng viên sẽ đọc{demo ? ' · Dữ liệu mẫu' : ''}</span>
            </div>
            <RecruiterJobPreview job={preview} />
          </>
        )}
        <div className="hr-form-actions hr-wizard-actions">
          <button
            type="button"
            className="hr-button secondary"
            onClick={() => (step ? setStep(step - 1) : onCancel())}
          >
            {step ? <ArrowLeft size={16} /> : null}
            {step ? 'Quay lại' : 'Hủy'}
          </button>
          <div>
            <button type="submit" className="hr-button secondary">
              <FileText size={16} />
              {saving
                ? 'Đang lưu…'
                : !demo
                  ? job
                    ? 'Lưu thay đổi'
                    : 'Lưu bản nháp'
                  : job
                    ? 'Lưu thay đổi mẫu'
                    : 'Lưu nháp mẫu'}
            </button>
            {step < 2 ? (
              <button
                type="button"
                className="hr-button"
                onClick={() => {
                  if (check(step === 1)) setStep(step + 1)
                }}
              >
                {step === 1 ? 'Xem trước' : 'Tiếp tục'}
                <ArrowRight size={16} />
              </button>
            ) : (
              demo &&
              (!job || job.status === 'DRAFT') && (
                <button
                  type="button"
                  className="hr-button"
                  onClick={() => {
                    if (check(true, true)) onSave(draft, true)
                  }}
                >
                  <Send size={16} />
                  Đăng tin mẫu
                </button>
              )
            )}
          </div>
        </div>
      </fieldset>
    </form>
  )
}
