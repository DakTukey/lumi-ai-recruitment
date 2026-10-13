import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../../app/providers/auth-context'
import './account-menu.css'

export function AccountMenu() {
  const { user, signOut, isSigningOut } = useAuth()
  const { pathname } = useLocation()
  const disclosure = useRef<HTMLDetailsElement>(null)
  const close = () => {
    if (disclosure.current) disclosure.current.open = false
  }
  useEffect(() => {
    if (disclosure.current) disclosure.current.open = false
  }, [pathname])
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !disclosure.current?.contains(event.target)) close()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && disclosure.current?.open) {
        close()
        disclosure.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  if (!user) return null
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <details ref={disclosure} className="account-disclosure">
      <summary
        className="account-trigger"
        aria-label="Mở menu tài khoản"
        aria-controls="account-panel"
      >
        <span className="header-avatar" aria-hidden="true">
          {initials}
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="account-panel" id="account-panel">
        <div className="account-panel-identity">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </div>
        <ul aria-label="Tùy chọn tài khoản">
          <li>
            <Link to="/profile" onClick={close}>
              <UserRound size={17} />
              Hồ sơ của tôi
            </Link>
          </li>
          <li>
            <Link to="/settings" onClick={close}>
              <Settings size={17} />
              Cài đặt
            </Link>
          </li>
          <li className="account-panel-logout">
            <button type="button" onClick={() => void signOut()} disabled={isSigningOut}>
              <LogOut size={17} />
              {isSigningOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
            </button>
          </li>
        </ul>
      </div>
    </details>
  )
}
