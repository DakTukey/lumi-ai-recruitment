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
                    ? 'Các tùy chọn bảo vệ tài khoản.'
                    : section === 'notifications'
                      ? 'Chọn những cập nhật bạn muốn nhận từ Lumi.'
                      : 'Kiểm soát cách chia sẻ hồ sơ và thông tin liên hệ.'}
                </p>
                <div className="settings-pending">
                  <span>SẮP CÓ</span>
                  <h3>
                    {section === 'security'
                      ? 'Đổi mật khẩu'
                      : section === 'notifications'
                        ? 'Tùy chọn nhận thông báo'
                        : 'Tùy chọn chia sẻ hồ sơ'}
                  </h3>
                  <p>
                    {section === 'security'
                      ? 'Chức năng đổi mật khẩu đang được phát triển.'
                      : section === 'notifications'
                        ? 'Bạn sẽ có thể chọn nhận cập nhật về việc làm và quá trình ứng tuyển.'
                        : 'Bạn sẽ có thể tùy chỉnh quyền hiển thị hồ sơ và thông tin liên hệ.'}
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
