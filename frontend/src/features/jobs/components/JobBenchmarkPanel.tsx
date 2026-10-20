import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChartNoAxesCombined, RefreshCw, ShieldCheck } from 'lucide-react'
import { getCandidateBenchmark } from '../../../services/candidate-benchmark.service'
import type { CandidateBenchmark } from '../../../services/candidate-benchmark.service'
import { benchmarkNumber as number, benchmarkPriorities } from '../candidate-benchmark-model'
import { improveCvPath } from '../candidate-job-route'
import '../styles/candidate-benchmark.css'

export function JobBenchmarkPanel({
  jobId,
  documentId,
  enabled,
}: {
  jobId: string
  documentId: string
  enabled: boolean
}) {
  const [result, setResult] = useState<{ data?: CandidateBenchmark; error?: string } | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let active = true,
      inFlight = false
    const load = async () => {
      if (inFlight || document.visibilityState === 'hidden') return
      inFlight = true
      try {
        const data = await getCandidateBenchmark(jobId, documentId)
        if (active) setResult({ data })
      } catch (error) {
        if (active)
          setResult({
            error: error instanceof Error ? error.message : 'Chưa tải được dữ liệu so sánh.',
          })
      } finally {
        inFlight = false
      }
    }
    void load()
    const timer = setInterval(() => {
      void load()
    }, 15000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [jobId, documentId, enabled, refresh])
  const data = result?.data
  const priorities = data ? benchmarkPriorities(data.criteria) : []
  return (
    <section className="cb-panel" aria-label="So sánh với mặt bằng ứng tuyển">
      <header className="cb-heading">
        <span className="cb-mark">
          <ChartNoAxesCombined size={22} />
        </span>
        <div>
          <span className="cb-eyebrow">GÓC NHÌN TỪ NHÓM HỒ SƠ</span>
          <h3>CV của bạn đang ở đâu?</h3>
          <p>So với các hồ sơ khác đã nộp cho cùng yêu cầu tuyển dụng.</p>
        </div>
        <button
          type="button"
          className="cb-refresh"
          onClick={() => setRefresh(refresh + 1)}
          aria-label="Cập nhật thống kê so sánh"
        >
          <RefreshCw size={15} />
        </button>
      </header>
      {!result ? (
        <p role="status" className="cb-message">
          Đang tổng hợp dữ liệu so sánh…
        </p>
      ) : result.error ? (
        <div className="cb-message" role="alert">
          <p>{result.error}</p>
          <button type="button" onClick={() => setRefresh(refresh + 1)}>
            Thử tải lại
          </button>
        </div>
      ) : (
        data && (
          <>
            <div className="cb-coverage">
              <ShieldCheck size={14} />
              <span>
                Đã có kết quả tương thích:{' '}
                <strong>
                  {data.analyzedPeers}/{data.totalPeers}
                </strong>{' '}
                hồ sơ khác · Tổng hợp ẩn danh
              </span>
            </div>
            {data.status !== 'READY' ? (
              <div className="cb-empty">
                <h4>
                  {data.status === 'UNWEIGHTED'
                    ? 'Chưa có trọng số để so sánh'
                    : data.status === 'NEEDS_MATCH'
                      ? 'Cần đối chiếu CV đã lưu trước'
                      : 'Chưa đủ dữ liệu để so sánh'}
                </h4>
                <p>
                  {data.status === 'INSUFFICIENT_DATA'
                    ? `Cần ít nhất ${data.minimumPeers} hồ sơ khác có kết quả cùng cách đánh giá. Phần so sánh sẽ xuất hiện khi đủ dữ liệu.`
                    : 'Hãy đối chiếu phiên bản CV hiện tại với tiêu chí có trọng số của tin tuyển dụng.'}
                </p>
                {data.pendingPeers > 0 && (
                  <p>
                    {data.pendingPeers} hồ sơ đang chờ hoặc được AI xử lý. Bạn có thể quay lại sau.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="cb-overview">
                  <div className="cb-percentile">
                    <span>VỊ TRÍ TƯƠNG ĐỐI</span>
                    <strong>P{number(data.percentile)}</strong>
                    <p>Phân vị trong {data.analyzedPeers} hồ sơ khác đã phân tích</p>
                  </div>
                  <div className="cb-distribution">
                    <p>
                      <strong>{number(data.lowerPercent)}%</strong> hồ sơ có điểm thấp hơn ·{' '}
                      <strong>{number(data.equalPercent)}%</strong> ngang điểm
                    </p>
                    <div className="cb-score-line">
                      <span>CV của bạn</span>
                      <div>
                        <i style={{ width: `${data.ownScore ?? 0}%` }} />
                      </div>
                      <strong>{number(data.ownScore)}</strong>
                    </div>
                    <div className="cb-score-line is-peer">
                      <span>Trung vị nhóm</span>
                      <div>
                        <i style={{ width: `${data.medianScore ?? 0}%` }} />
                      </div>
                      <strong>{number(data.medianScore)}</strong>
                    </div>
                    <p className="cb-small">
                      Trung vị là điểm giữa nhóm. P70 không có nghĩa 70% khả năng được tuyển.
                    </p>
                  </div>
                </div>
                <details className="cb-method">
                  <summary>Phạm vi và cách hiểu</summary>
                  <p>
                    Mỗi đơn chỉ dùng kết quả mới nhất, cùng nội dung JD, cách chấm và model. Không
                    gồm hồ sơ của bạn hoặc đơn đã rút. Hồ sơ chưa được phân tích hay dùng cách chấm
                    khác chưa nằm trong nhóm so sánh.
                  </p>
                  <p>
                    Đây là mức đáp ứng thể hiện trong CV tự khai, chưa phải năng lực đã xác minh.
                    Phân vị chia đều vị trí cho các hồ sơ đồng điểm.
                  </p>
                </details>
                <h4 className="cb-section-title">Từng tiêu chí so với nhóm</h4>
                <div className="cb-criteria" role="list">
                  {data.criteria.map((c) => (
                    <article className="cb-criterion" key={c.id} role="listitem">
                      <div>
                        <h5>{c.name}</h5>
                        <span>
                          {c.required ? 'Bắt buộc' : 'Ưu tiên'} · {c.peerEvidenceCount}/
                          {c.peerCount} hồ sơ có bằng chứng
                        </span>
                      </div>
                      <div>
                        <small>CV của bạn</small>
                        <strong>
                          {c.ownScore == null ? 'Chưa có căn cứ' : `${number(c.ownScore)}/100`}
                        </strong>
                      </div>
                      <div>
                        <small>Trung vị có căn cứ</small>
                        <strong>
                          {c.peerMedian == null ? 'Chưa đủ dữ liệu' : `${number(c.peerMedian)}/100`}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
                {priorities.length > 0 && (
                  <div className="cb-priorities">
                    <h4>Nên làm rõ phần nào trước?</h4>
                    {priorities.map((c) => (
                      <p key={c.id}>
                        <strong>{c.name}:</strong>{' '}
                        {c.action === 'CLARIFY'
                          ? 'CV chưa có căn cứ. Nếu đã có trải nghiệm, hãy bổ sung vai trò, cách thực hiện và kết quả.'
                          : 'Mức đáp ứng ghi nhận còn dưới trung vị nhóm. Hãy làm rõ phạm vi và kết quả thực tế, hoặc thực hành thêm nếu chưa có trải nghiệm.'}
                      </p>
                    ))}
                    <Link to={improveCvPath(jobId, documentId)}>
                      Cải thiện CV cho vị trí này
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                )}
              </>
            )}
            <footer className="cb-footer">
              Thống kê cập nhật khi có hồ sơ mới được phân tích. Chỉ hỗ trợ chuẩn bị CV, không dự
              đoán kết quả tuyển dụng.
            </footer>
          </>
        )
      )}
    </section>
  )
}
