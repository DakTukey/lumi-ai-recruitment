import { useId, useRef, useState } from 'react'
import { ChevronDown, BriefcaseBusiness } from 'lucide-react'

const searchable = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .trim()

export function CvPositionField({
  value,
  onChange,
  options,
  loading,
  unavailable,
  jobId,
  jobTitle,
  targetPosition,
  jobUnavailable,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  loading: boolean
  unavailable: boolean
  jobId: string | null
  jobTitle: string
  targetPosition: string
  jobUnavailable: boolean
}) {
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [active, setActive] = useState(-1)
  const unique = [
    ...new Map(
      [targetPosition, ...options].filter(Boolean).map((name) => [searchable(name), name]),
    ).values(),
  ]
  const matching = unique.filter((name) => showAll || searchable(name).includes(searchable(value)))
  const matches = matching.slice(0, 20)
  const select = (name: string) => {
    onChange(name)
    setActive(-1)
    input.current?.focus()
    setOpen(false)
  }
  return (
    <div
      className="cv-position-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <label htmlFor="cv-desiredPosition" className="cv-field-label">
        {jobId ? 'Vị trí ứng tuyển' : 'Vị trí mong muốn'}{' '}
        <small className="cv-required">Cần khi hoàn tất</small>
      </label>
      <div className="cv-position-input">
        <input
          id="cv-desiredPosition"
          ref={input}
          role="combobox"
          autoComplete="off"
          maxLength={255}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && active >= 0 && active < matches.length ? `${listId}-${active}` : undefined
          }
          aria-describedby={`${listId}-help`}
          value={value}
          placeholder="Ví dụ: Frontend Intern"
          onFocus={() => {
            setOpen(true)
            setShowAll(false)
            setActive(-1)
          }}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setShowAll(false)
            setActive(-1)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              setActive(-1)
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              setOpen(true)
              const next = matches.length
                ? active < 0
                  ? event.key === 'ArrowDown'
                    ? 0
                    : matches.length - 1
                  : (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) %
                    matches.length
                : -1
              setActive(next)
              requestAnimationFrame(() =>
                document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' }),
              )
            }
            if (event.key === 'Enter' && open && active >= 0 && matches[active]) {
              event.preventDefault()
              select(matches[active])
            }
          }}
        />
        <button
          type="button"
          aria-label="Xem gợi ý vị trí"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            const next = !open
            input.current?.focus()
            setShowAll(true)
            setActive(-1)
            setOpen(next)
          }}
        >
          <ChevronDown size={16} />
        </button>
        {open && (
          <div className="cv-position-dropdown">
            <p className="cv-position-caption">Gợi ý vị trí · Có thể tự nhập</p>
            <ul id={listId} role="listbox" aria-label="Vị trí gợi ý từ công ty">
              {matches.map((name, index) => (
                <li
                  key={name}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={active === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => select(name)}
                >
                  <BriefcaseBusiness size={14} />
                  <span>{name}</span>
                </li>
              ))}
            </ul>
            {!matches.length && (
              <p className="cv-position-empty" role="status">
                {loading
                  ? 'Đang tải gợi ý…'
                  : unavailable
                    ? 'Chưa tải được danh mục. Bạn vẫn có thể tự nhập.'
                    : unique.length
                      ? 'Không có gợi ý khớp. Bạn có thể giữ tên vừa nhập.'
                      : 'Chưa có gợi ý vị trí. Bạn có thể tự nhập.'}
              </p>
            )}
            {matching.length > matches.length && (
              <p className="cv-position-empty">Nhập thêm để thu hẹp gợi ý.</p>
            )}
          </div>
        )}
      </div>
      <p id={`${listId}-help`} className="cv-field-help">
        Chọn gợi ý của công ty hoặc nhập tên vị trí phù hợp với CV.
      </p>
      {jobTitle && (
        <div className="cv-position-job">
          <span>Tin đang ứng tuyển</span>
          <strong>{jobTitle}</strong>
          <p>Bạn có thể chỉnh tên vị trí trên CV. Tin ứng tuyển vẫn giữ nguyên.</p>
          {targetPosition && targetPosition !== value && (
            <button type="button" onClick={() => select(targetPosition)}>
              Dùng vị trí “{targetPosition}”
            </button>
          )}
        </div>
      )}
      {jobUnavailable && (
        <p className="cv-field-help">
          Chưa lấy được vị trí từ tin tuyển dụng; tin có thể đã đóng hoặc kết nối bị gián đoạn. Bạn
          vẫn có thể tự nhập và lưu CV.
        </p>
      )}
    </div>
  )
}
