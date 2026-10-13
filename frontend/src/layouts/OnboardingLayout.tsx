import type { ReactNode } from 'react'
import { Brand } from '../components/common/Brand'
import '../features/profile/onboarding.css'

export function OnboardingLayout({
  children,
  busy,
  onSkip,
}: {
  children: ReactNode
  busy: boolean
  onSkip: () => void
}) {
  return (
    <div className="onboarding-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="onboarding-header">
        <div className="container onboarding-header-inner">
          <Brand linked={false} />
          <button type="button" className="text-link" disabled={busy} onClick={onSkip}>
            Bỏ qua lúc này
          </button>
        </div>
      </header>
      <main id="main-content" className="container onboarding-page">
        <div className="onboarding-intro">
          <h1>Tìm cơ hội phù hợp với bạn</h1>
          <p>Chia sẻ mong muốn trong 3 bước. Bạn có thể bỏ qua và cập nhật sau.</p>
        </div>
        {children}
      </main>
      <footer className="onboarding-footer">
        Các bước đã lưu sẽ được giữ lại. Bạn có thể cập nhật sau trong Hồ sơ.
      </footer>
    </div>
  )
}
