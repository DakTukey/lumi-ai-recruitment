# Bổ sung thông tin sau khi nộp hồ sơ

Ứng viên nộp CV PDF như bình thường. Việc tạo câu hỏi và trả lời là **tùy chọn**, không chặn nộp hồ sơ, không sửa PDF/CV/JD đã nộp, không tự tăng điểm hoặc chuyển vòng tuyển dụng.

## Luồng sử dụng

1. Sau khi nộp, chọn **Bổ sung thông tin cho HR**, hoặc **Đơn ứng tuyển → Xem hồ sơ đã gửi → Bổ sung thông tin**.
2. Chờ phân tích CV hoàn tất, rồi bấm **Tạo câu hỏi gợi ý**. Mở trang không tự gọi mô hình.
3. Backend lấy bản CV/JD cố định lúc nộp và kết quả đánh giá hợp lệ mới nhất. Chọn tối đa 3 tiêu chí `PARTIAL`/`NO_EVIDENCE` có trọng số dương, ưu tiên tiêu chí bắt buộc rồi trọng số cao. Không dùng câu hỏi/ghi chú phỏng vấn nội bộ của HR.
4. FastAPI gọi provider cloud đang cấu hình qua `generate_grounded`, yêu cầu đúng một câu hỏi cho mỗi khóa tiêu chí. Hai tầng kiểm tra khóa, số lượng, độ dài và schema. Trích dẫn/nhãn yêu cầu được backend lấy từ nguồn đã lưu, không lấy từ nội dung mô hình tạo.
5. Ứng viên gửi từng câu trả lời (tối đa 3.000 ký tự), sửa hoặc bỏ qua. Chỉ nội dung đã gửi mới hiển thị cho HR. Có thể trả lời lại câu đã bỏ qua.
6. HR mở hồ sơ → **Bổ sung thông tin** để xem yêu cầu, căn cứ, câu trả lời, trạng thái và thời điểm cập nhật. Câu trả lời là **ứng viên tự cung cấp, chưa xác minh**; HR cần kiểm chứng khi phỏng vấn.

## Lưu trữ và tính nhất quán

- Migration V24 thêm `application_clarification_sets` và `application_clarification_questions`, tách khỏi bảng đánh giá và CV bất biến.
- Bộ câu hỏi gắn với assessment gốc, được giữ lại kể cả khi HR phân tích lại. Không tái tạo đè lên câu trả lời.
- PDF có bản xác nhận dùng `pdfReviewedContent` trong snapshot lúc nộp. PDF chưa xác nhận dùng `parsed_content` bất biến. Tính năng này không đọc PDF lại và không dùng bản ứng viên sửa sau khi nộp.
- Chỉ ứng viên sở hữu đơn được ghi. HR chỉ đọc. `HIRED`/`REJECTED`/`WITHDRAWN` khóa sửa nhưng vẫn xem được.
- CSRF bảo vệ POST/PUT; phiên bản câu trả lời tránh hai tab ghi đè nhau (409 yêu cầu tải bản mới).
- Khóa đơn trong giao dịch ngắn để giành lượt tạo, thả khóa trước khi gọi AI; token ngăn kết quả từ lượt cũ ghi đè lượt mới. Lease hết hạn sau 180 giây, tối đa 2 lượt gọi đồng thời trên một backend.
- Lỗi provider/schema: không lưu câu hỏi giả. Tối đa 3 lượt thử/đơn/giờ, tối thiểu 60 giây giữa các lượt; có thể thử lại sau khi hết cửa sổ. Chỉ GET trạng thái khi tự làm mới, tối đa khoảng 2 phút mỗi lần mở/cập nhật tab.
- Hết quota không ảnh hưởng đơn đã gửi hoặc việc HR đọc PDF. Không có fallback bịa câu hỏi/điểm.

## API

| API | Quyền | Tác dụng |
| --- | --- | --- |
| `GET /api/candidate/applications/{id}/clarifications` | Chủ đơn | Đọc trạng thái và câu hỏi |
| `POST /api/candidate/applications/{id}/clarifications/generate` | Chủ đơn | Tạo một lần hoặc trả bộ đã lưu |
| `PUT /api/candidate/applications/{id}/clarifications/{questionId}` | Chủ đơn | `{version, action: "ANSWER"/"SKIP", answer}` |
| `GET /api/recruiter/applications/{id}/clarifications` | Recruiter/company admin | Chỉ đọc |
| `POST /api/application-clarifications` (FastAPI nội bộ) | Backend | Sinh câu hỏi theo các tiêu chí đã chọn |

Trạng thái: `WAITING`, `NEEDS_ANALYSIS`, `NOT_REQUESTED`, `GENERATING`, `READY`, `NOT_NEEDED`, `FAILED`. Mọi yêu cầu ghi được phân quyền lại trên server; không tin `canEdit`/`canGenerate` từ giao diện.

## Kiểm thử

- Backend `LoginFlowTest#clarification*`: PostgreSQL riêng được tạo/xóa tự động; provider giả lập cho luồng bình thường, lỗi quota/schema, tranh chấp, lease hết hạn, phân quyền/CSRF, phiên bản câu trả lời, hồ sơ kết thúc và cả hai loại snapshot PDF.
- Python `tests/test_application_clarifications.py`: giới hạn đầu vào, kiểm tra căn cứ/khóa tiêu chí, đầu ra sai schema, prompt phân tách dữ liệu và không bịa fallback khi provider lỗi.
- Frontend `tests/application-clarifications.test.mjs`: đọc không sinh câu hỏi, CSRF/phiên bản/action, phản hồi lưu đến sai thứ tự không đè câu trả lời mới hơn.

Phạm vi hiện tại: hỏi đáp văn bản để làm rõ CV theo JD. Chưa có voice, camera, xác minh GitHub/chứng chỉ hoặc chấm lại từ câu trả lời. Kiểm tra schema không chứng minh mọi câu hỏi AI đều đúng ngữ nghĩa; cần đánh giá chất lượng bằng nhiều CV/JD thực tế.

Khi kiểm tra trực tiếp, cấu hình model cũ trả HTTP 404. Cấu hình hiện tại dùng `openai/gpt-oss-120b` và `gemini-3.1-flash-lite`; danh sách model được kiểm tra qua API của nhà cung cấp. Một yêu cầu sinh câu hỏi thật bằng dữ liệu giả lập trả 200 trong khoảng 1,1 giây. Đây là một lần kiểm tra kết nối, không phải cam kết độ trễ cho mọi CV/JD.
