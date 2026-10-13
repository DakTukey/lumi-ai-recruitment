import { Link } from 'react-router-dom'
import { MoveUpRight } from 'lucide-react'
export function Brand({ light = false, linked = true }: { light?: boolean; linked?: boolean }) {
  const content = (
    <>
      <span className="brand-symbol">
        <MoveUpRight size={25} strokeWidth={3} />
      </span>
      lumi studio<span className="brand-dot">.</span>
    </>
  )
  if (!linked)
    return (
      <span className={`brand ${light ? 'brand-light' : ''}`} aria-label="Lumi Studio">
        {content}
      </span>
    )
  return (
    <Link
      to="/"
      className={`brand ${light ? 'brand-light' : ''}`}
      aria-label="Lumi Studio — trang chủ"
    >
      {content}
    </Link>
  )
}
