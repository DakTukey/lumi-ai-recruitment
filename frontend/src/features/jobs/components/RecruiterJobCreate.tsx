import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  FileUp,
  Loader2,
  PencilLine,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { Department } from '../../../services/job.service'
import type { JobDraft } from '../recruiter-model'
import { emptyDraft, jobWorkLocation } from '../recruiter-model'
import { RecruiterJobForm } from './RecruiterJobForm'
import { parseJobDraft, generateJobDraft } from '../../../services/recruiter-job.service'

type Method = 'manual' | 'import' | 'generate'
const methods = [
  {
    id: 'manual',
    title: 'Nhập thủ công',
    icon: PencilLine,
    description: 'Tự điền thông tin vị trí, yêu cầu và quyền lợi theo nhu cầu tuyển dụng.',
    hint: 'Phù hợp khi bạn muốn chủ động soạn từng mục.',
    status: 'Sẵn sàng',
  },
  {
    id: 'import',
    title: 'Nhập từ JD có sẵn',
    icon: FileUp,
    description: 'Dán nội dung hoặc chọn tài liệu để AI hỗ trợ điền thông tin tuyển dụng.',
    hint: 'Phù hợp khi đã có bản mô tả công việc.',
    status: 'AI sẵn sàng',
  },
  {
    id: 'generate',
    title: 'AI hỗ trợ viết JD',
    icon: Sparkles,
    description: 'Cung cấp vị trí và vài yêu cầu chính để AI hỗ trợ soạn bản nháp.',
    hint: 'Phù hợp khi bạn mới có ý tưởng tuyển dụng.',
    status: 'AI sẵn sàng',
  },
] as const
export function RecruiterJobCreate({
  departments,
  departmentError,
  onCreateDepartment,
  saving,
  saveError,
  onDirty,
  onSave,
  onCancel,
}: {
  departments: Department[]
  departmentError: boolean
  onCreateDepartment: (name: string) => Promise<Department>
  saving: boolean
  saveError: string
  onDirty: () => void
  onSave: (draft: JobDraft, publish: boolean) => void
  onCancel: () => void
}) {
  const [method, setMethod] = useState<Method | null>(null)
  const [manualDraft, setManualDraft] = useState<JobDraft>(() => ({
    ...emptyDraft(),
    ...{ category: '', departmentId: '' },
  }))
  const [manualTouched, setManualTouched] = useState(false)
  const [source, setSource] = useState<'text' | 'file'>('text')
  const [jd, setJd] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [brief, setBrief] = useState({
    title: '',
    level: '',
    location: jobWorkLocation(''),
    mode: '',
    skills: '',
    requirements: '',
    tone: 'professional',
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [importedSource, setImportedSource] = useState('')
  const [importedLocation, setImportedLocation] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const current = methods.find((item) => item.id === method)

  async function handleParseJd() {
    if (source === 'file' && !file) {
      setFileError('Vui lòng chọn một tệp JD.')
      return
    }
    if (source === 'text' && !jd.trim()) {
      setAiError('Vui lòng dán nội dung JD.')
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const parsed = await parseJobDraft({
        file: source === 'file' ? file : null,
        text: source === 'text' ? jd : undefined,
      })
      setManualDraft({
        ...parsed,
        departmentId: parsed.departmentId || '',
      })
      setImportedSource(source === 'file' ? file!.name : 'Nội dung JD đã dán')
      setImportedLocation(parsed.location)
      setManualTouched(true)
      onDirty()
      setMethod('manual')
    } catch (e: any) {
      setAiError(
        e.message ||
          'Không thể phân tích JD bằng AI. Vui lòng kiểm tra lại tài liệu hoặc dán text.',
      )
    } finally {
      setAiLoading(false)
    }
  }

  async function handleGenerateJd() {
    if (!brief.title.trim()) {
      setAiError('Vui lòng nhập tên chức danh hoặc vị trí.')
      return
    }
    setAiLoading(true)
    setAiError('')
    try {
      const generated = await generateJobDraft({
        title: brief.title,
        level: brief.level || 'Middle',
        location: brief.location || 'Đà Nẵng',
        mode: brief.mode || 'Hybrid',
        skills: brief.skills,
        requirements: brief.requirements,
        tone: brief.tone || 'professional',
      })
      let matchedDeptId = generated.departmentId
      if (!matchedDeptId && departments.length > 0) {
        matchedDeptId = departments[0].id
      }
      setManualDraft({
        ...generated,
        departmentId: matchedDeptId,
      })
      setImportedSource('')
      setImportedLocation('')
      setManualTouched(true)
      onDirty()
      setMethod('manual')
    } catch (e: any) {
      setAiError(e.message || 'Không thể tạo JD bằng AI. Vui lòng thử lại sau.')
    } finally {
      setAiLoading(false)
    }
  }
  function selectFile(next?: File) {
    setDragging(false)
    if (!next) return
    setFile(null)
    onDirty()
    if (!/\.(pdf|docx|md|txt)$/i.test(next.name)) {
      setFileError('Chọn file PDF, DOCX, MD hoặc TXT.')
      return
    }
    if (next.size === 0) {
      setFileError('File đang rỗng. Chọn tài liệu có nội dung.')
      return
    }
    if (next.size > 10 * 1024 * 1024) {
      setFileError('File vượt quá 10 MB. Chọn tài liệu nhỏ hơn.')
      return
    }
    setFile(next)
    setFileError('')
  }
  function changeBrief(key: keyof typeof brief, value: string) {
    setBrief((previous) => ({
      ...previous,
      [key]: value,
      ...(key === 'mode' ? { location: jobWorkLocation(value) } : {}),
    }))
    onDirty()
  }
  function continueManually() {
    if (method === 'generate' && !manualTouched) {
      // These are HR-entered values, never represented as an AI result.
      setManualDraft((previous) => ({
        ...previous,
        title: previous.title || brief.title,
        level: brief.level || previous.level,
        location: brief.location || previous.location,
        mode: brief.mode || previous.mode,
      }))
    }
    setMethod('manual')
  }
  if (!method)
    return (
      <div className="hr-create-start">
        <div className="hr-create-intro">
          <span className="hr-eyebrow">CHUẨN BỊ TIN TUYỂN DỤNG</span>
          <h3>Bạn muốn bắt đầu bằng cách nào?</h3>
          <p>
            Chọn cách phù hợp với nội dung bạn đang có. Bạn sẽ kiểm tra thông tin trước khi lưu bản
            nháp.
          </p>
        </div>
        <div className="hr-create-methods" aria-label="Chọn cách tạo tin tuyển dụng">
          {methods.map((item) => (
            <button
              key={item.id}
              className={`hr-create-method ${item.id}`}
              onClick={() => setMethod(item.id)}
            >
              <span className="hr-method-top">
                <span className="hr-method-icon">
                  <item.icon size={23} />
                </span>
                <span className={`hr-method-status ${item.id === 'manual' ? 'ready' : ''}`}>
                  {item.status}
                </span>
              </span>
              <strong>{item.title}</strong>
              <span className="hr-method-description">{item.description}</span>
              <span className="hr-method-hint">{item.hint}</span>
              <span className="hr-method-link">
                {item.id === 'manual' ? 'Mở form soạn tin' : 'Xem giao diện'}
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>
        <div className="hr-create-review">
          <ShieldCheck size={20} />
          <div>
            <strong>Bạn kiểm tra và quyết định nội dung cuối cùng</strong>
            <p>
              Bản nháp chưa hiển thị cho ứng viên. Bạn có thể dùng AI để chuẩn bị nhanh nội dung rồi
              hoàn thiện lại trong form.
            </p>
          </div>
        </div>
        <div className="hr-create-bottom">
          <span>Hỗ trợ nhập thủ công, nhập từ JD file/text hoặc AI tự động soạn thảo.</span>
          <button className="hr-button secondary" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    )
  return (
    <div className="hr-create-flow">
      <div className="hr-create-flow-head">
        <span>
          <span className="hr-method-icon">{current && <current.icon size={18} />}</span>
          <strong>{current?.title}</strong>
        </span>
        <button
          type="button"
          className="hr-text-button"
          disabled={saving || aiLoading}
          onClick={() => setMethod(null)}
        >
          <ArrowLeft size={15} />
          Đổi cách tạo
        </button>
      </div>
      {method === 'manual' ? (
        <>
          {importedSource && (
            <div className="hr-ai-ready" role="note">
              <FileText size={19} />
              <div>
                <strong>Đã đọc: {importedSource}</strong>
                {importedLocation && importedLocation !== jobWorkLocation(manualDraft.mode) && (
                  <p>
                    Địa điểm trong JD gốc: {importedLocation}. Địa điểm đăng tin áp dụng theo cách
                    làm việc và văn phòng hiện tại của công ty; hãy kiểm tra sự khác biệt này.
                  </p>
                )}
                <p>
                  Hãy đối chiếu với tài liệu gốc, nhất là mức lương, thời gian và yêu cầu tuyển
                  dụng. Kiểm tra cả trọng số tiêu chí AI đề xuất. Thông tin chưa có cần được bổ sung
                  trước khi lưu.
                </p>
              </div>
            </div>
          )}
          <RecruiterJobForm
            initialDraft={manualDraft}
            onDraftChange={setManualDraft}
            departments={departments}
            departmentError={departmentError}
            onCreateDepartment={onCreateDepartment}
            saving={saving}
            saveError={saveError}
            onDirty={() => {
              setManualTouched(true)
              onDirty()
            }}
            onSave={onSave}
            onCancel={onCancel}
          />
        </>
      ) : (
        <>
          {aiError && (
            <div className="hr-form-error" role="alert" style={{ marginBottom: '1rem' }}>
              <p>{aiError}</p>
            </div>
          )}
          <div className="hr-ai-ready" role="note">
            <Sparkles size={19} />
            <div>
              <strong>Trợ lý AI sẵn sàng hỗ trợ</strong>
              <p>
                {method === 'import'
                  ? 'AI đọc JD từ văn bản, PDF có chữ hoặc PDF scan để điền vào bản nháp cho bạn kiểm tra.'
                  : 'AI sẽ viết bản thảo JD hoàn chỉnh dựa trên các thông tin tóm tắt bạn cung cấp.'}
              </p>
            </div>
          </div>
          <ol className="hr-ai-flow" aria-label="Luồng tạo tin với AI">
            <li className="active">
              <span>1</span>
              {method === 'import' ? 'Cung cấp JD' : 'Cung cấp yêu cầu'}
            </li>
            <li>
              <span>2</span>Kiểm tra thông tin
            </li>
            <li>
              <span>3</span>Lưu bản nháp
            </li>
          </ol>
          <div className="hr-ai-input-grid">
            <section className="hr-ai-input" aria-labelledby="hr-ai-input-title">
              <h3 id="hr-ai-input-title">
                {method === 'import'
                  ? 'Bản mô tả công việc của bạn'
                  : 'Bạn đang tìm kiếm vị trí nào?'}
              </h3>
              <p>
                {method === 'import'
                  ? 'Dùng JD hiện có để chuẩn bị thông tin tuyển dụng.'
                  : 'Cung cấp bối cảnh cụ thể để chuẩn bị nội dung phù hợp với công việc.'}
              </p>
              {method === 'import' ? (
                <>
                  <div className="hr-jd-source" role="group" aria-label="Nguồn JD">
                    <button
                      disabled={aiLoading}
                      aria-pressed={source === 'text'}
                      onClick={() => setSource('text')}
                    >
                      <FileText size={16} />
                      Dán nội dung
                    </button>
                    <button
                      disabled={aiLoading}
                      aria-pressed={source === 'file'}
                      onClick={() => setSource('file')}
                    >
                      <FileUp size={16} />
                      Tải tài liệu
                    </button>
                  </div>
                  {source === 'text' ? (
                    <label className="hr-ai-field">
                      Nội dung JD
                      <textarea
                        disabled={aiLoading}
                        rows={11}
                        maxLength={12000}
                        value={jd}
                        onChange={(event) => {
                          setJd(event.target.value)
                          onDirty()
                        }}
                        placeholder={
                          'Dán bản mô tả công việc tại đây…\n\nVí dụ: tên vị trí, trách nhiệm, kỹ năng yêu cầu, mức lương và quyền lợi.'
                        }
                      />
                      <small>
                        {jd.length.toLocaleString('vi-VN')} / 12.000 ký tự · Giữ nguyên thông tin từ
                        JD gốc.
                      </small>
                    </label>
                  ) : (
                    <>
                      <input
                        ref={fileInput}
                        type="file"
                        disabled={aiLoading}
                        hidden
                        accept=".pdf,.docx,.md,.txt"
                        aria-label="Chọn tài liệu JD"
                        onChange={(event) => {
                          selectFile(event.target.files?.[0])
                          event.target.value = ''
                        }}
                      />
                      <div
                        className={`hr-jd-drop ${dragging ? 'dragging' : ''}`}
                        onDragOver={(event) => {
                          event.preventDefault()
                          setDragging(true)
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                          event.preventDefault()
                          if (aiLoading) return
                          if (event.dataTransfer.files.length > 1) {
                            setDragging(false)
                            setFileError('Mỗi lần chọn một tài liệu JD.')
                            return
                          }
                          selectFile(event.dataTransfer.files[0])
                        }}
                      >
                        <span className="hr-upload-icon">
                          <FileUp size={30} />
                        </span>
                        <strong>Kéo tài liệu vào đây</strong>
                        <span>hoặc chọn file từ máy của bạn</span>
                        <button
                          className="hr-button secondary"
                          type="button"
                          disabled={aiLoading}
                          onClick={() => fileInput.current?.click()}
                        >
                          Chọn tài liệu
                        </button>
                        <small>
                          PDF có chữ hoặc scan (tối đa 10 trang), DOCX, MD, TXT · Tối đa 10 MB
                        </small>
                      </div>
                      {file && (
                        <div className="hr-jd-selected">
                          <FileText size={23} />
                          <div>
                            <strong>{file.name}</strong>
                            <small>
                              {file.size < 1024 * 1024
                                ? `${Math.ceil(file.size / 1024)} KB`
                                : `${(file.size / 1024 / 1024).toFixed(1)} MB`}{' '}
                              · Đã chọn trên máy
                            </small>
                          </div>
                          <button
                            className="hr-icon-button"
                            aria-label="Bỏ tài liệu đã chọn"
                            disabled={aiLoading}
                            onClick={() => {
                              setFile(null)
                              setFileError('')
                              onDirty()
                            }}
                          >
                            <X size={17} />
                          </button>
                        </div>
                      )}
                      {fileError && (
                        <p className="hr-field-error" role="alert">
                          {fileError}
                        </p>
                      )}
                      <p className="hr-ai-file-note">
                        File chưa được gửi lên máy chủ. PDF scan hoặc ảnh sẽ cần hỗ trợ nhận dạng
                        chữ.
                      </p>
                    </>
                  )}
                </>
              ) : (
                <div className="hr-ai-brief">
                  <label className="hr-ai-field">
                    Tên vị trí
                    <input
                      maxLength={255}
                      value={brief.title}
                      onChange={(event) => changeBrief('title', event.target.value)}
                      placeholder="Ví dụ: Java Backend Developer"
                    />
                  </label>
                  <div className="hr-form-grid">
                    <label className="hr-ai-field">
                      Cấp độ kinh nghiệm
                      <select
                        value={brief.level}
                        onChange={(event) => changeBrief('level', event.target.value)}
                      >
                        <option value="">Chọn cấp độ</option>
                        {['Intern', 'Junior', 'Middle', 'Senior'].map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </label>
                    <label className="hr-ai-field">
                      Cách làm việc
                      <select
                        value={brief.mode}
                        onChange={(event) => changeBrief('mode', event.target.value)}
                      >
                        <option value="">Chọn cách làm việc</option>
                        {['Tại văn phòng', 'Hybrid', 'Remote'].map((mode) => (
                          <option key={mode}>{mode}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="hr-ai-field">
                    Địa điểm làm việc
                    <input readOnly value={brief.location} />
                    <small>
                      {brief.mode === 'Remote'
                        ? 'Làm việc từ xa, không yêu cầu đến văn phòng.'
                        : 'Tự điền văn phòng duy nhất của công ty tại Đà Nẵng.'}
                    </small>
                  </label>
                  <label className="hr-ai-field">
                    Kỹ năng chính
                    <input
                      maxLength={1000}
                      value={brief.skills}
                      onChange={(event) => changeBrief('skills', event.target.value)}
                      placeholder="Ví dụ: Java, Spring Boot, PostgreSQL"
                    />
                  </label>
                  <label className="hr-ai-field">
                    Công việc và yêu cầu chính
                    <textarea
                      rows={5}
                      maxLength={5000}
                      value={brief.requirements}
                      onChange={(event) => changeBrief('requirements', event.target.value)}
                      placeholder="Sản phẩm, trách nhiệm, kinh nghiệm và những yêu cầu quan trọng của vị trí…"
                    />
                  </label>
                  <label className="hr-ai-field">
                    Giọng văn
                    <select
                      value={brief.tone}
                      onChange={(event) => changeBrief('tone', event.target.value)}
                    >
                      <option value="professional">Rõ ràng, chuyên nghiệp</option>
                      <option value="friendly">Gần gũi, thân thiện</option>
                    </select>
                  </label>
                </div>
              )}
            </section>
            <aside className="hr-ai-review-guide">
              <span className="hr-method-icon">
                <ShieldCheck size={22} />
              </span>
              <h3>Kiểm tra trước khi lưu</h3>
              <p>Khi AI được kết nối, kết quả sẽ đưa về form chung để bạn chỉnh sửa.</p>
              <ul>
                <li>
                  <Check size={16} />
                  <span>
                    <strong>AI đề xuất</strong>Nội dung được nhận diện hoặc soạn sẽ có nhãn để bạn
                    kiểm tra.
                  </span>
                </li>
                <li>
                  <Check size={16} />
                  <span>
                    <strong>Cần bổ sung</strong>Thông tin thiếu hoặc chưa rõ sẽ được đánh dấu, gồm
                    số lượng tuyển, lương và hạn nộp.
                  </span>
                </li>
                <li>
                  <Check size={16} />
                  <span>
                    <strong>Bạn xác nhận</strong>Phòng ban, kỹ năng và tiêu chí cần phù hợp với nhu
                    cầu tuyển dụng.
                  </span>
                </li>
              </ul>
              <small>Chỉ lưu bản nháp sau khi bạn kiểm tra và bấm lưu.</small>
            </aside>
          </div>
          <div className="hr-ai-create-actions">
            <div>
              <button
                type="button"
                className="hr-button"
                disabled={
                  aiLoading ||
                  (method === 'import'
                    ? source === 'file'
                      ? !file
                      : !jd.trim()
                    : !brief.title.trim())
                }
                onClick={method === 'import' ? handleParseJd : handleGenerateJd}
              >
                {aiLoading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    {method === 'import'
                      ? 'Đang phân tích JD qua AI…'
                      : 'Đang soạn thảo JD qua AI…'}
                  </>
                ) : (
                  <>
                    <Sparkles size={17} />
                    {method === 'import' ? 'Phân tích JD bằng AI' : 'Tạo nội dung bằng AI'}
                  </>
                )}
              </button>
              <small id="hr-ai-action-note">
                {method === 'import'
                  ? aiLoading
                    ? 'PDF scan có thể mất vài phút. Giữ trang này mở trong lúc xử lý.'
                    : 'Nội dung đọc được sẽ điền vào form để bạn kiểm tra trước khi lưu.'
                  : 'AI sẽ tạo bản nháp đầy đủ kỹ năng & tiêu chí để bạn duyệt'}
              </small>
            </div>
            <button
              type="button"
              className="hr-button secondary"
              disabled={aiLoading}
              onClick={continueManually}
            >
              Tiếp tục nhập thủ công
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
