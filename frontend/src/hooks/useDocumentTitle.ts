import { useEffect } from 'react'

const BASE_TITLE = 'Lumi Studio'

/**
 * Đặt `document.title` theo trang hiện tại.
 *
 * @example
 * useDocumentTitle('Tìm việc')
 * // → "Tìm việc — Lumi Studio"
 *
 * useDocumentTitle() // chỉ "Lumi Studio"
 */
export function useDocumentTitle(pageTitle?: string) {
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} — ${BASE_TITLE}` : BASE_TITLE

    return () => {
      document.title = BASE_TITLE
    }
  }, [pageTitle])
}
