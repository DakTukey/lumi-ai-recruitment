import { useEffect, useState } from 'react'
import { getSubmittedPdfExtraction } from '../../../services/resume.service'
import { reviewLabel } from '../../resumes/pdf-review-model'
import type { ParsedResume } from '../../../services/resume.service'

type Extraction = Awaited<ReturnType<typeof getSubmittedPdfExtraction>>

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <section>
      <h4>{title}</h4>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function Fields({ parsed }: { parsed: ParsedResume }) {
  const contact = [
    parsed.fullName && `Họ tên: ${parsed.fullName}`,
    parsed.email && `Email: ${parsed.email}`,
    parsed.phone && `Điện thoại: ${parsed.phone}`,
    parsed.location && `Địa điểm: ${parsed.location}`,
  ].filter(Boolean) as string[]
  return (
    <div className="cv-extraction-fields">
      <Section title="Thông tin liên hệ" items={contact} />
      {parsed.desiredPosition && <Section title="Vị trí" items={[parsed.desiredPosition]} />}
      {parsed.summary && <Section title="Giới thiệu" items={[parsed.summary]} />}
      <Section title="Kỹ năng" items={parsed.skills ?? []} />
      <Section
        title="Kinh nghiệm"
        items={(parsed.experiences ?? []).map((e) =>
          [
            e.position && `Vị trí: ${e.position}`,
            e.company && `Công ty: ${e.company}`,
            e.startDate && `Từ: ${e.startDate}`,
            e.endDate && `Đến: ${e.endDate}`,
            e.description,
          ]
            .filter(Boolean)
            .join(' · '),
        )}
      />
      <Section
        title="Học vấn"
        items={(parsed.educations ?? []).map((e) =>
          [
            e.school && `Trường: ${e.school}`,
            e.degree && `Bằng cấp: ${e.degree}`,
            e.field && `Ngành: ${e.field}`,
            e.description,
          ]
            .filter(Boolean)
            .join(' · '),
        )}
      />
      <Section
        title="Dự án"
        items={(parsed.projects ?? []).map((p) =>
          [p.name && `Tên: ${p.name}`, p.role && `Vai trò: ${p.role}`, p.description]
            .filter(Boolean)
            .join(' · '),
        )}
      />
      <Section
        title="Chứng chỉ"
        items={(parsed.certifications ?? []).map((c) =>
          [c.name && `Tên: ${c.name}`, c.issuer && `Đơn vị cấp: ${c.issuer}`]
            .filter(Boolean)
            .join(' · '),
        )}
      />
      <Section
        title="Ngoại ngữ"
        items={(parsed.languages ?? []).map((l) =>
          [
            l.name,
            l.proficiency && `Trình độ: ${l.proficiency}`,
            l.certification && `Chứng nhận: ${l.certification}`,
          ]
            .filter(Boolean)
            .join(' · '),
        )}
      />
      <Section
        title="Giải thưởng"
        items={(parsed.awards ?? []).map((a) =>
          [a.title, a.issuer && `Đơn vị trao: ${a.issuer}`, a.description]
            .filter(Boolean)
            .join(' · '),
        )}
      />
      <Section
        title="Hoạt động"
        items={(parsed.activities ?? []).map((a) =>
          [
            a.name,
            a.organization && `Tổ chức: ${a.organization}`,
            a.role && `Vai trò: ${a.role}`,
            a.description,
          ]
            .filter(Boolean)
            .join(' · '),
        )}
      />
      <Section
        title="Mục khác trong CV"
        items={(parsed.extraSections ?? []).map((s) => `${s.title}: ${s.content}`)}
      />
      {!!parsed.sources?.length && (
        <details>
          <summary>Nguồn từ bản AI đọc ban đầu</summary>
          <p>Nguồn dùng để đối chiếu. Thông tin ứng viên sửa có thể khác đoạn AI trích ban đầu.</p>
          <ul>
            {parsed.sources.map((source, i) => (
              <li key={i}>
                {reviewLabel(source.path)} · Trang {source.page}: “{source.quote}” ·{' '}
                {source.verified ? 'Đoạn trích khớp văn bản' : 'Cần kiểm tra trên PDF'}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Section title="Cần đối chiếu" items={parsed.warnings ?? []} />
      {parsed.extractedText && (
        <details>
          <summary>Văn bản trích xuất theo trang</summary>
          <pre className="cv-extracted-text">{parsed.extractedText}</pre>
        </details>
      )}
    </div>
  )
}

export function SubmittedPdfExtraction({ applicationId }: { applicationId: string }) {
  const [result, setResult] = useState<Extraction | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    getSubmittedPdfExtraction(applicationId)
      .then((data) => {
        if (active) {
          setResult(data)
          setError('')
        }
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Chưa tải được thông tin trích xuất.')
      })
    return () => {
      active = false
    }
  }, [applicationId, retry])
  useEffect(() => {
    if (!result?.status || result.status === 'PARSED') return
    if (result.status === 'FAILED' && !['PENDING', 'PROCESSING'].includes(result.analysisState))
      return
    let active = true
    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return
      void getSubmittedPdfExtraction(applicationId)
        .then((data) => {
          if (active) setResult(data)
        })
        .catch(() => {})
    }, 10000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [applicationId, result?.status, result?.analysisState])
  return (
    <details className="cv-source-note">
      <summary>Thông tin AI đọc từ PDF</summary>
      {result?.confirmedAt && (
        <p>
          Ứng viên xác nhận lúc {new Date(result.confirmedAt).toLocaleString('vi-VN')}. Đây là bản
          đã lưu cùng đơn ứng tuyển.
        </p>
      )}
      {result?.status === 'PARSED' && !result.confirmedAt && (
        <p>Dữ liệu AI đọc từ PDF gốc, chưa được ứng viên xác nhận. Hãy đối chiếu với file gốc.</p>
      )}
      <p>
        Đây là dữ liệu hỗ trợ tìm kiếm và đánh giá. Khi thông tin khác PDF gốc, hãy dùng PDF gốc để
        kiểm tra.
      </p>
      {error && <p role="alert">{error}</p>}
      {!result && !error && <p role="status">Đang tải thông tin…</p>}
      {result?.status === 'PARSED' && result.parsed ? (
        <Fields parsed={result.parsed} />
      ) : (
        result && (
          <p role="status">
            {result.status === 'FAILED'
              ? 'AI chưa đọc được PDF. HR vẫn có thể xem file gốc.'
              : 'Chờ AI đọc PDF. Hồ sơ đã được nhận; HR có thể xem file gốc và chuyển vòng trong lúc chờ.'}
          </p>
        )
      )}
      <button
        type="button"
        className="hr-button secondary"
        onClick={() => {
          setResult(null)
          setError('')
          setRetry((n) => n + 1)
        }}
      >
        Cập nhật trạng thái
      </button>
    </details>
  )
}
