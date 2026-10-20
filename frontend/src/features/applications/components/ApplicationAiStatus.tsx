import { useEffect, useState } from 'react'
import { getApplicationAiStatus } from '../../../services/candidate-benchmark.service'
import type { ApplicationAiStatus as Status } from '../../../services/candidate-benchmark.service'
import '../../jobs/styles/candidate-benchmark.css'
const labels: Record<Status['state'], string> = {
  PENDING: 'Hồ sơ đang chờ AI phân tích',
  PROCESSING: 'AI đang đối chiếu CV đã nộp',
  COMPLETED: 'Đã có phân tích CV–JD',
  FAILED: 'AI tạm thời chưa có kết quả',
  SKIPPED: 'Đã dừng phân tích tự động',
  NOT_REQUESTED: 'Hồ sơ này chưa có lượt phân tích tự động',
}
export function ApplicationAiStatus({
  applicationId,
  staff = false,
}: {
  applicationId: string
  staff?: boolean
}) {
  const [result, setResult] = useState<{ data?: Status; error?: string } | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true,
      inFlight = false,
      finished = false
    const load = async () => {
      if (inFlight || finished || document.visibilityState === 'hidden') return
      inFlight = true
      try {
        const data = await getApplicationAiStatus(applicationId, staff)
        if (active) {
          setResult({ data })
          finished = !['PENDING', 'PROCESSING'].includes(data.state)
        }
      } catch (e) {
        if (active) {
          setResult({ error: e instanceof Error ? e.message : 'Chưa tải được tiến độ AI.' })
          finished = true
        }
      } finally {
        inFlight = false
      }
    }
    void load()
    const timer = setInterval(() => {
      void load()
    }, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [applicationId, staff, retry])
  return (
    <section
      className="candidate-ai-status"
      aria-label="Tiến độ AI của hồ sơ đã nộp"
      aria-live="polite"
    >
      <h4>
        {result?.data
          ? labels[result.data.state]
          : result?.error
            ? 'Chưa tải được tiến độ AI'
            : 'Đang kiểm tra tiến độ AI…'}
      </h4>
      {result?.error && <p role="alert">{result.error}</p>}
      {result?.data && (
        <>
          {result.data.state === 'COMPLETED' ? (
            <>
              <p>
                <strong>Mức đáp ứng CV–JD: {result.data.score}/100.</strong> Điểm dựa trên CV tự
                khai, không phải xác suất trúng tuyển.
              </p>
              <p>{result.data.summary}</p>
            </>
          ) : (
            <p>
              Đơn ứng tuyển đã lưu và HR vẫn xem được hồ sơ. Phân tích AI được xử lý riêng, không
              làm thay đổi CV hoặc trạng thái tuyển dụng.
            </p>
          )}
          {result.data.state === 'PENDING' && result.data.attempts > 0 && (
            <p>Hệ thống đang chờ thử lại khi dịch vụ AI khả dụng.</p>
          )}
          {result.data.state === 'FAILED' && (
            <p>
              Chưa có điểm AI, không phải điểm 0.{' '}
              {staff
                ? 'Bạn có thể xem PDF, chuyển vòng thủ công hoặc thử lại trong mục Đánh giá AI.'
                : 'HR vẫn có thể xem PDF và xử lý hồ sơ của bạn.'}
            </p>
          )}
        </>
      )}
      <button type="button" onClick={() => setRetry(retry + 1)}>
        Cập nhật tiến độ
      </button>
    </section>
  )
}
