import { useId, useRef, useState } from 'react'
import { Plus, RefreshCw, Sparkles, Tag, X } from 'lucide-react'
import { skillIdentity } from './cv-builder-model'

const searchable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .trim()

export function CvSkillsField({
  skills,
  onChange,
  options,
  loading,
  unavailable,
  jobSkills = [],
  onSyncProfile,
  syncingProfile = false,
  label = 'Kỹ năng chuyên môn',
  id = 'cv-skills',
  error,
}: {
  skills: string[]
  onChange: (skills: string[]) => void
  options: string[]
  loading: boolean
  unavailable: boolean
  jobSkills?: string[]
  onSyncProfile?: () => void
  syncingProfile?: boolean
  label?: string
  id?: string
  error?: string
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [notice, setNotice] = useState('')

  // Deduplicate and filter out already added skills
  const isSelected = (name: string) => skills.some((s) => skillIdentity(s) === skillIdentity(name))

  const uniqueCatalog = [
    ...new Map(
      [...jobSkills, ...options]
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => [skillIdentity(name), name]),
    ).values(),
  ]

  const availableSuggestions = uniqueCatalog.filter((name) => !isSelected(name))

  const searchMatches = availableSuggestions.filter(
    (name) => !input.trim() || searchable(name).includes(searchable(input)),
  )
  const matches = searchMatches.slice(0, 15)

  const unselectedJobSkills = [
    ...new Map(
      jobSkills
        .map((name) => name.trim())
        .filter(Boolean)
        .filter((name) => !isSelected(name))
        .map((name) => [skillIdentity(name), name]),
    ).values(),
  ]

  const addSkill = (name: string, focus = true) => {
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) return
    if (isSelected(clean)) {
      setInput('')
      setOpen(false)
      setActive(-1)
      setNotice('Mục này đã có trong danh sách.')
      return
    }
    if (skills.length >= 100) {
      setNotice('Đã đủ 100 mục. Hãy xóa một mục trước khi thêm.')
      return
    }
    if (clean.length > 100) {
      setNotice('Tên quá dài. Hãy rút gọn còn tối đa 100 ký tự.')
      return
    }
    setNotice('')
    onChange([...skills, clean])
    setInput('')
    setActive(-1)
    setOpen(false)
    if (focus) inputRef.current?.focus()
  }

  const removeSkill = (index: number) => {
    onChange(skills.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!matches.length) return
      setOpen(true)
      const next =
        active < 0
          ? event.key === 'ArrowDown'
            ? 0
            : matches.length - 1
          : (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length
      setActive(next)
      requestAnimationFrame(() =>
        document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' }),
      )
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && active >= 0 && matches[active]) {
        addSkill(matches[active])
      } else if (input.trim()) {
        addSkill(input)
      }
      return
    }

    if (event.key === ',' || event.key === '，') {
      event.preventDefault()
      if (input.trim()) {
        addSkill(input)
      }
      return
    }

    if (event.key === 'Backspace' && !input && skills.length > 0) {
      removeSkill(skills.length - 1)
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  return (
    <div
      className="cv-skills-manager"
      ref={containerRef}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) {
          if (input.trim()) addSkill(input, false)
          setOpen(false)
          setActive(-1)
        }
      }}
    >
      <div className="cv-skills-header-row">
        <label htmlFor={id} className="cv-field-label">
          {label} <small className="cv-required">{skills.length} / 100</small>
        </label>
        {onSyncProfile && (
          <button
            type="button"
            className="cv-fill-profile-btn"
            onClick={onSyncProfile}
            disabled={syncingProfile}
            title="Lấy danh sách kỹ năng đã chọn trong hồ sơ cá nhân"
          >
            <RefreshCw size={12} className={syncingProfile ? 'cv-spin' : undefined} />
            {syncingProfile ? 'Đang lấy…' : 'Lấy từ hồ sơ cá nhân'}
          </button>
        )}
      </div>

      <div className="cv-skills-box" onClick={() => inputRef.current?.focus()}>
        {skills.map((skill, index) => (
          <span key={`${skill}-${index}`} className="cv-skill-tag">
            <Tag size={12} />
            <span>{skill}</span>
            <button
              type="button"
              aria-label={`Xóa kỹ năng ${skill}`}
              onClick={(e) => {
                e.stopPropagation()
                removeSkill(index)
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          type="text"
          className="cv-skills-input"
          value={input}
          maxLength={100}
          aria-invalid={!!error}
          aria-describedby={`${id}-help`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-activedescendant={
            open && active >= 0 && active < matches.length ? `${listId}-${active}` : undefined
          }
          placeholder={
            skills.length === 0
              ? 'Ví dụ: React, Java, Docker… (gõ rồi nhấn Enter)'
              : 'Thêm kỹ năng khác…'
          }
          onFocus={() => {
            setOpen(true)
            setActive(-1)
          }}
          onChange={(event) => {
            setInput(event.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onKeyDown={handleKeyDown}
        />
        {input.trim() && (
          <button
            type="button"
            className="cv-skill-add-btn"
            title="Thêm kỹ năng này"
            onClick={(e) => {
              e.stopPropagation()
              addSkill(input)
            }}
          >
            <Plus size={14} />
            <span>Thêm</span>
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <div className="cv-skills-dropdown">
          <p className="cv-skills-caption">Gợi ý kỹ năng · Chọn hoặc nhấn Enter để thêm</p>
          <ul id={listId} role="listbox" aria-label="Gợi ý kỹ năng">
            {matches.map((name, index) => (
              <li
                key={name}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={active === index}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addSkill(name)}
              >
                <Tag size={13} />
                <span>{name}</span>
                {jobSkills.some((js) => searchable(js) === searchable(name)) && (
                  <span className="cv-job-badge">Theo tin tuyển dụng</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unselectedJobSkills.length > 0 ? (
        <div className="cv-job-skills-suggestions">
          <span className="cv-suggestion-label">
            <Sparkles size={13} />
            Kỹ năng trong tin tuyển dụng:
          </span>
          <div className="cv-suggestion-chips">
            {unselectedJobSkills.map((name) => (
              <button
                key={name}
                type="button"
                className="cv-suggestion-chip"
                onClick={() => addSkill(name)}
                title={`Thêm ${name} vào CV`}
              >
                <Plus size={12} />
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : availableSuggestions.length > 0 && skills.length < 10 ? (
        <div className="cv-job-skills-suggestions">
          <span className="cv-suggestion-label">
            <Sparkles size={13} />
            Gợi ý kỹ năng phổ biến:
          </span>
          <div className="cv-suggestion-chips">
            {availableSuggestions.slice(0, 12).map((name) => (
              <button
                key={name}
                type="button"
                className="cv-suggestion-chip"
                onClick={() => addSkill(name)}
                title={`Thêm ${name} vào CV`}
              >
                <Plus size={12} />
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(error || notice) && (
        <p className="cv-field-error" role="status">
          {error || notice}
        </p>
      )}
      <p id={`${id}-help`} className="cv-field-help">
        Gõ tên kỹ năng rồi nhấn <strong>Enter</strong> hoặc dấu phẩy (<strong>,</strong>). Chỉ thêm
        những kỹ năng bạn thực sự có.
        {!loading &&
          !unavailable &&
          uniqueCatalog.length === 0 &&
          ' Chưa có danh mục gợi ý; bạn có thể tự nhập.'}
        {loading && ' Đang tải danh mục kỹ năng…'}
        {unavailable && ' Danh mục gợi ý chưa sẵn sàng; bạn vẫn có thể tự gõ kỹ năng bình thường.'}
      </p>
    </div>
  )
}
