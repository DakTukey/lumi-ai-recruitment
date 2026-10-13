import { Check, FileText, MessageCircle, Send, UserRoundSearch } from 'lucide-react'
import { Link } from 'react-router-dom'

const steps = [
  {
    icon: Send,
    title: 'Gửi hồ sơ',
    time: 'Ngay khi bạn sẵn sàng',
    text: 'Chọn vị trí phù hợp, gửi CV và cho chúng mình biết điều bạn muốn làm tiếp theo.',
  },
  {
    icon: UserRoundSearch,
    title: 'Đọc hồ sơ',
    time: 'Trong 3–5 ngày làm việc',
    text: 'Recruiter xem kinh nghiệm, kỹ năng và những dẫn chứng phù hợp với vị trí.',
  },
  {
    icon: MessageCircle,
    title: 'Trao đổi',
    time: '1–2 buổi gặp',
    text: 'Cùng tìm hiểu cách bạn làm việc, bài toán của đội ngũ và mong đợi hai bên.',
  },
  {
    icon: Check,
    title: 'Kết quả',
    time: 'Sau buổi trao đổi cuối',
    text: 'Chúng mình phản hồi rõ ràng, dù kết quả là lời mời hợp tác hay góp ý cho lần sau.',
  },
]

export function HiringProcessPage() {
  return (
    <div className="process-page">
      <section className="container process-intro">
        <span className="eyebrow">QUY TRÌNH TUYỂN DỤNG</span>
        <h1>
          Rõ ràng từ
          <br />
          bước đầu tiên<span className="orange-dot">.</span>
        </h1>
        <p>
          Mỗi vòng giúp chúng ta hiểu nhau hơn. Lumi Studio sẽ cập nhật trạng thái để bạn không phải
          chờ đợi trong mơ hồ.
        </p>
      </section>
      <section className="container process-timeline" aria-label="Các bước tuyển dụng">
        {steps.map(({ icon: Icon, title, time, text }, index) => (
          <article className="process-step" key={title}>
            <div className="process-number">0{index + 1}</div>
            <span className="spark-box">
              <Icon size={22} />
            </span>
            <div>
              <span className="process-time">{time}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="container faq-panel">
        <div>
          <span className="eyebrow">CÂU HỎI THƯỜNG GẶP</span>
          <h2>Trước khi bạn ứng tuyển.</h2>
        </div>
        <div className="faq-list">
          <details open>
            <summary>Có thể ứng tuyển nhiều vị trí không?</summary>
            <p>Có. Hãy ưu tiên những vị trí phù hợp nhất với mục tiêu và kinh nghiệm của bạn.</p>
          </details>
          <details>
            <summary>Chưa có nhiều kinh nghiệm có thể ứng tuyển không?</summary>
            <p>
              Có. Với các vị trí Intern và Junior, dự án cá nhân và khả năng học hỏi đều là dẫn
              chứng hữu ích.
            </p>
          </details>
          <details>
            <summary>Có được làm việc từ xa hoàn toàn không?</summary>
            <p>Tùy vị trí. Thông tin hình thức làm việc được ghi rõ trên từng tin tuyển dụng.</p>
          </details>
        </div>
      </section>
      <section className="container closing-banner process-cta">
        <div>
          <span className="eyebrow">BƯỚC TIẾP THEO LÀ CỦA BẠN</span>
          <h2>Một hồ sơ rõ ràng, một cuộc trò chuyện thật.</h2>
        </div>
        <Link className="button cream" to="/">
          Khám phá vị trí tuyển dụng <FileText size={18} />
        </Link>
        <div className="banner-decoration" aria-hidden="true">
          ↗
        </div>
      </section>
    </div>
  )
}
