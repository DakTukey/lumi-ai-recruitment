import { useState } from 'react'
import { cvWritingSamples } from './cv-writing-samples'
import './cv-writing.css'

export function CvWritingExamples() {
  const [selected, setSelected] = useState(0)
  const sample = cvWritingSamples[selected]
  return (
    <details className="cv-ai-examples">
      <summary>Xem ví dụ viết CV đã lưu</summary>
      <div className="cv-ai-examples-body">
        <span className="cv-ai-eyebrow">VÍ DỤ ĐÃ LƯU · CÓ THỂ XEM KHI AI KHÔNG KHẢ DỤNG</span>
        <h2>Từ vài ý ngắn đến một đoạn CV rõ ràng</h2>
        <p className="cv-ai-description">
          Dữ liệu minh họa, không phải kết quả phân tích CV của bạn. Mở ví dụ không gọi AI và không
          thay đổi nội dung đang sửa.
        </p>
        <div className="cv-ai-modes" role="group" aria-label="Chọn ví dụ viết CV">
          {cvWritingSamples.map((item, index) => (
            <button
              type="button"
              key={item.section}
              aria-pressed={index === selected}
              onClick={() => setSelected(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="cv-ai-examples-grid">
          <section>
            <h3>Ý ban đầu</h3>
            <p>{sample.original}</p>
          </section>
          <section>
            <h3>Đề xuất đã lưu · {sample.actionLabel}</h3>
            <p>{sample.suggestion}</p>
          </section>
        </div>
        <p className="cv-ai-disclosure">
          Tạo bằng {sample.provider} · {sample.savedDate} · Ví dụ chỉ để tham khảo.
        </p>
      </div>
    </details>
  )
}
