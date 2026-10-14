import { ArrowUpRight, BriefcaseBusiness, Menu, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../app/providers/auth-context'
import { useSavedJobs } from '../app/providers/saved-jobs-context'
import { AccountMenu } from '../components/common/AccountMenu'
import { Brand } from '../components/common/Brand'
export function PublicLayout() {
  const [menu, setMenu] = useState(false)
  const { saved } = useSavedJobs()
  const { user, signOut, loading, isSigningOut } = useAuth()
  const { pathname } = useLocation()
  const jobsPath = '/'
  const savedPath = '/saved'
  const savedCount = saved.filter((id) => typeof id === 'string').length
  const isHome = pathname === '/'
  const isJobList = isHome || pathname === '/saved'
  const isJobDetail = pathname.startsWith('/jobs/')
  return (
    <>
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header
        className={`site-header${isHome || isJobDetail ? ' candidate-home-header' : ''}${isJobList || isJobDetail ? ' candidate-jobs-header' : ''}${pathname === '/profile' ? ' candidate-profile-header' : ''}`}
      >
        <div className="header-inner">
          <Brand light />
          <nav
            aria-label="Điều hướng chính"
            className={menu ? 'nav-open' : ''}
            onClick={() => setMenu(false)}
          >
            <NavLink to={jobsPath} end>
              Vị trí tuyển dụng
            </NavLink>
            <NavLink to="/about">Về Lumi Studio</NavLink>
            <NavLink to="/hiring-process">Quy trình tuyển dụng</NavLink>
            {user?.role === 'CANDIDATE' && (
              <>
                <NavLink to={savedPath}>
                  Đã lưu{savedCount > 0 && <span className="nav-count">{savedCount}</span>}
                </NavLink>
              </>
            )}
          </nav>
          <div className="header-actions">
            {user && user.role !== 'CANDIDATE' ? (
              <Link
                className="employer-link"
                to={user.role === 'COMPANY_ADMIN' ? '/admin' : '/recruiter'}
              >
                {user.role === 'COMPANY_ADMIN' ? 'Trang quản trị' : 'Không gian tuyển dụng'}{' '}
                <ArrowUpRight size={15} />
              </Link>
            ) : (
              <Link className="employer-link" to="/login" state={{ from: '/recruiter' }}>
                Khu vực tuyển dụng <ArrowUpRight size={15} />
              </Link>
            )}
            {user ? (
              <>
                {user.role === 'CANDIDATE' ? (
                  <AccountMenu />
                ) : (
                  <button
                    className="button small"
                    onClick={() => void signOut()}
                    disabled={isSigningOut}
                  >
                    {isSigningOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                  </button>
                )}
              </>
            ) : loading ? (
              <span className="small-text" role="status">
                Đang kết nối…
              </span>
            ) : (
              <Link className="button small" to="/login">
                Đăng nhập
              </Link>
            )}
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer
        className={`footer${isHome ? ' candidate-home-footer' : ''}${isJobList || isJobDetail ? ' candidate-jobs-footer' : ''}${isJobDetail ? ' candidate-job-detail-footer' : ''}`}
      >
        <div className="container footer-inner">
          <div>
            <Brand light />
            <p>Kết nối đúng người. Mở lối tương lai.</p>
          </div>
          <div className="footer-links">
            <Link to={jobsPath}>
              Vị trí tuyển dụng <ArrowUpRight size={14} />
            </Link>
            <Link to="/about">Về Lumi Studio</Link>
            <Link to="/hiring-process">Quy trình tuyển dụng</Link>
            {user?.role === 'CANDIDATE' && <Link to="/applications">Đơn ứng tuyển</Link>}
            <Link
              to={
                user?.role === 'COMPANY_ADMIN'
                  ? '/admin'
                  : user?.role === 'RECRUITER'
                    ? '/recruiter'
                    : '/login'
              }
              state={user ? undefined : { from: '/recruiter' }}
            >
              <BriefcaseBusiness size={15} />{' '}
              {user?.role === 'COMPANY_ADMIN' ? 'Trang quản trị' : 'Khu vực tuyển dụng'}
            </Link>
          </div>
          <div className="demo-note">
            <Sparkles size={14} />
            <span>
              Lumi Studio · Tuyển dụng
              <br />
              Nộp và theo dõi hồ sơ đã lưu thật. AI đang phát triển.
            </span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Lumi Studio. AI Recruitment Assistant.</span>
          <span>Được thiết kế cho những bước tiến tiếp theo.</span>
        </div>
      </footer>
    </>
  )
}
