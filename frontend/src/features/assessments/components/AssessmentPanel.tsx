import { Check, CircleHelp, FileText, Sparkles } from 'lucide-react'
import { Modal } from '../../../components/ui/Modal'
export function AssessmentPanel({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <Modal title="Hiểu hồ sơ, trước khi quyết định" onClose={onClose} wide>
      <div className="assessment-header">
        <span className="candidate-avatar">
          {name
            .split(' ')
            .map((x) => x[0])
            .slice(-2)
            .join('')}
        </span>
        <div>
          <h2>{name}</h2>
          <p>Frontend Developer · Hồ sơ giả lập</p>
        </div>
        <span className="status-badge">
          <Sparkles size={14} /> Phân tích mẫu
        </span>
      </div>
      <div className="assessment-summary">
        <div>
          <strong>3/4</strong>
          <span>tiêu chí có bằng chứng</span>
        </div>
        <p>
          Kỹ năng frontend phù hợp. Cần trao đổi thêm về kinh nghiệm kiểm thử tự động trước khi đánh
          giá đầy đủ.
        </p>
      </div>
      <div className="criteria-list">
        {[
          [
            'React & TypeScript',
            'Đáp ứng',
            '“Phát triển giao diện quản lý công việc bằng React và TypeScript.”',
            true,
          ],
          [
            'Làm việc với REST API',
            'Đáp ứng',
            '“Tích hợp API tìm kiếm, phân trang và quản lý phiên đăng nhập.”',
            true,
          ],
          [
            'Git & làm việc nhóm',
            'Đáp ứng',
            '“Phối hợp nhóm 4 thành viên, review code qua pull request.”',
            true,
          ],
          [
            'Kiểm thử tự động',
            'Chưa đủ thông tin',
            'CV mẫu chưa nêu công cụ hoặc ví dụ kiểm thử.',
            false,
          ],
        ].map(([title, status, evidence, ok]) => (
          <div className="criterion" key={String(title)}>
            <div>
              <h3>{title}</h3>
              <span className={ok ? 'criterion-ok' : 'criterion-unknown'}>
                {ok ? <Check size={14} /> : <CircleHelp size={14} />} {status}
              </span>
            </div>
            <p>
              <FileText size={14} />
              {evidence}
            </p>
          </div>
        ))}
      </div>
      <section className="detail-section">
        <h3>Câu hỏi gợi ý để làm rõ</h3>
        <p className="interview-question">
          “Bạn đã từng viết kiểm thử cho component React chưa? Hãy mô tả một trường hợp kiểm thử và
          cách bạn chọn công cụ.”
        </p>
      </section>
      <p className="info-note">
        Kết quả minh họa cố định. Chưa có mô hình AI hoặc quyết định tuyển dụng tự động.
      </p>
    </Modal>
  )
}
