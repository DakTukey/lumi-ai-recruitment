import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Bell, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../../app/providers/auth-context'
import './settings.css'

const sections = [
  { id: 'account', title: 'Tài khoản', icon: UserRound },
  { id: 'security', title: 'Bảo mật', icon: LockKeyhole },
  { id: 'notifications', title: 'Thông báo', icon: Bell },
  { id: 'privacy', title: 'Quyền riêng tư', icon: ShieldCheck },
] as const

export function SettingsPage() {
  const { user } = useAuth()
  const [section, setSection] = useState<(typeof sections)[number]['id']>('account')
  const title = sections.find((item) => item.id === section)?.title
  return (
    <div className="settings-surface">
      <div className="container settings-page">
        <Link to="/profile" className="settings-back">
          <ArrowLeft size={15} />
          Về hồ sơ của tôi
        </Link>
        <h1>Cài đặt</h1>
        <p className="settings-intro">Quản lý tài khoản và các tùy chọn của bạn tại Lumi.</p>
        <div className="settings-columns">
          <nav aria-label="Các mục cài đặt" className="settings-nav">
            {sections.map(({ id, title, icon: Icon }) => (
              <button
                type="button"
                key={id}
                className={section === id ? 'active' : ''}
                aria-pressed={section === id}
                onClick={() => setSection(id)}
              >
                <Icon size={18} />
                {title}
              </button>
            ))}
          </nav>
          <section className="settings-card">
            <h2>{title}</h2>
            {section === 'account' ? (
              <>
                <p>Thông tin dùng để đăng nhập và quản lý hồ sơ của bạn.</p>
                <dl className="settings-account-details">
                  <div>
                    <dt>Họ và tên</dt>
                    <dd>{user?.fullName}</dd>
                  </div>
                  <div>
                    <dt>Email đăng nhập</dt>
                    <dd>{user?.email}</dd>
                  </div>
                  <div>
                    <dt>Loại tài khoản</dt>
                    <dd>Ứng viên</dd>
                  </div>
                </dl>
                <div className="settings-note">
                  <UserRound size={20} />
                  <div>
                    <strong>Muốn cập nhật thông tin cá nhân?</strong>
                    <p>Chỉnh sửa họ tên, nơi ở và số điện thoại trong Hồ sơ của tôi.</p>
                  </div>
                </div>
                <Link className="button secondary" to="/profile">
                  Đến hồ sơ của tôi <ArrowUpRight size={16} />
                </Link>
              </>
            ) : (
              <>
                <p>
                  {section === 'security'
                    ? 'Các chính sách và tùy chọn bảo vệ tài khoản.'
                    : section === 'notifications'
                      ? 'Cập nhật và thông báo từ hệ thống tuyển dụng Lumi.'
                      : 'Quy định bảo mật và chia sẻ hồ sơ ứng tuyển.'}
                </p>
                <div className="settings-note">
                  {section === 'security' ? (
                    <>
                      <LockKeyhole size={20} />
                      <div>
                        <strong>Bảo mật mật khẩu & phiên làm việc</strong>
                        <p>
                          Mật khẩu được mã hóa an toàn bằng thuật toán BCrypt. Phiên đăng nhập được quản lý bằng JWT token tự động xác thực với máy chủ.
                        </p>
                      </div>
                    </>
                  ) : section === 'notifications' ? (
                    <>
                      <Bell size={20} />
                      <div>
                        <strong>Kênh nhận thông báo tự động</strong>
                        <p>
                          Mọi thông báo về tiến độ xử lý hồ sơ, phản hồi từ nhà tuyển dụng và lịch phỏng vấn được gửi trực tiếp đến hộp thư: <strong>{user?.email || 'email đăng ký'}</strong>.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={20} />
                      <div>
                        <strong>Chính sách quyền riêng tư hồ sơ</strong>
                        <p>
                          CV và thông tin cá nhân của bạn chỉ được chia sẻ với nhà tuyển dụng liên quan khi bạn chủ động nộp đơn. Lumi cam kết không chia sẻ dữ liệu cho bên thứ ba.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
