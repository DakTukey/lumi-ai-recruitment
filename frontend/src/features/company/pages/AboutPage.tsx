import { ArrowRight, Heart, MapPin, Sparkles, UsersRound, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'

const values = [
  {
    icon: Sparkles,
    title: 'Luôn học hỏi',
    text: 'Đặt câu hỏi, thử nghiệm và chia sẻ điều học được để cùng tiến bộ mỗi ngày.',
  },
  {
    icon: UsersRound,
    title: 'Làm cùng nhau',
    text: 'Tôn trọng góc nhìn khác biệt, phản hồi thẳng thắn và hỗ trợ nhau hoàn thành mục tiêu.',
  },
  {
    icon: Heart,
    title: 'Tạo giá trị thật',
    text: 'Ưu tiên những sản phẩm giải quyết vấn đề rõ ràng cho người dùng và cộng đồng.',
  },
]

export function AboutPage() {
  return (
    <div className="company-page">
      <section className="company-hero">
        <div className="container company-hero-grid">
          <div>
            <span className="eyebrow">VỀ LUMI STUDIO</span>
            <h1>
              Tạo sản phẩm số
              <br />
              có ích cho con người<span className="orange-dot">.</span>
            </h1>
            <p>
              Lumi Studio là công ty công nghệ giả lập tại Đà Nẵng. Chúng mình xây dựng sản phẩm số
              với đội ngũ nhỏ, chủ động và luôn hướng đến trải nghiệm tốt hơn cho người dùng.
            </p>
            <Link className="button" to="/">
              Xem vị trí đang tuyển <ArrowRight size={17} />
            </Link>
          </div>
          <div className="company-location-card">
            <span className="spark-box">
              <MapPin size={25} />
            </span>
            <span className="eyebrow">LÀM VIỆC TỪ ĐÀ NẴNG</span>
            <h2>Không gian cho ý tưởng và sự tập trung.</h2>
            <p>Hybrid linh hoạt, kết nối trực tiếp khi công việc cần những cuộc trao đổi sâu.</p>
            <div className="location-card-art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </section>
      <section className="container company-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CÁCH CHÚNG MÌNH LÀM VIỆC</span>
            <h2>
              Một đội ngũ nhỏ,
              <br />
              một hướng đi chung<span className="orange-dot">.</span>
            </h2>
          </div>
          <p className="company-section-copy">
            Mỗi người được trao quyền sở hữu công việc, được góp ý sớm và nhìn thấy tác động của
            phần mình tạo ra.
          </p>
        </div>
        <div className="value-grid">
          {values.map(({ icon: Icon, title, text }) => (
            <article className="value-card" key={title}>
              <span className="spark-box">
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="container culture-banner">
        <Workflow size={42} />
        <div>
          <span className="eyebrow">ĐÚNG NGƯỜI, ĐÚNG HÀNH TRÌNH</span>
          <h2>Chúng mình tìm người cùng giải quyết vấn đề.</h2>
        </div>
        <Link className="button cream" to="/hiring-process">
          Xem quy trình tuyển dụng <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  )
}
