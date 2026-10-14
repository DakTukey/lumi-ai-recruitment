import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './cv-pdf-import.css'

/** Canvas rendering also works in browsers without an embedded PDF plugin. */
export function PdfDocumentViewer({ url, title }: { url: string; title: string }) {
  return <PdfPages key={url} url={url} title={title} />
}

function PdfPages({ url, title }: { url: string; title: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState('')
  const [width, setWidth] = useState(500)
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const node = container.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, Math.floor(entry.contentRect.width))))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined
    const controller = new AbortController()
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        if (cancelled) return
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const response = await fetch(url, { credentials: 'include', cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('file-unavailable')
        const data = new Uint8Array(await response.arrayBuffer())
        if (cancelled) return
        const task = pdfjs.getDocument({ data, enableXfa: false })
        destroy = () => { void task.destroy() }
        const pdf = await task.promise
        if (!cancelled) setDocument(pdf)
      } catch {
        if (!cancelled) setError('Chưa xem được PDF. Hãy thử mở bản gốc hoặc tải lại trang.')
      }
    })()
    return () => { cancelled = true; controller.abort(); destroy?.() }
  }, [url])

  useEffect(() => {
    if (!document || !canvas.current) return
    const node = canvas.current
    let cancelled = false
    let cancelRender: (() => void) | undefined
    void (async () => {
      try {
        const page = await document.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: (width / base.width) * ratio })
        node.width = Math.ceil(viewport.width)
        node.height = Math.ceil(viewport.height)
        const task = page.render({ canvas: node, viewport })
        cancelRender = () => task.cancel()
        await task.promise
      } catch {
        if (!cancelled) setError('Chưa hiển thị được trang PDF này. Bạn có thể mở bản gốc để xem.')
      }
    })()
    return () => { cancelled = true; cancelRender?.() }
  }, [document, pageNumber, width])

  return <section className="cv-pdf-viewer" aria-label={title}>
    <div className="cv-pdf-toolbar">
      <button type="button" disabled={!document || pageNumber <= 1} onClick={() => setPageNumber(n => n - 1)} aria-label="Trang PDF trước">←</button>
      <span aria-live="polite">{document ? `Trang ${pageNumber} / ${document.numPages}` : 'Đang tải PDF…'}</span>
      <button type="button" disabled={!document || pageNumber >= document.numPages} onClick={() => setPageNumber(n => n + 1)} aria-label="Trang PDF sau">→</button>
      <a href={url} target="_blank" rel="noreferrer">Mở bản gốc ↗</a>
    </div>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="cv-pdf-canvas" ref={container}><canvas ref={canvas} role="img" aria-label={`${title} · Trang ${pageNumber}`} hidden={!document || !!error} /></div>
  </section>
}
