# CV ứng viên chỉ dùng PDF

Ứng viên vào **Hồ sơ → CV & tài liệu → Tải CV PDF**, giữ nguyên file gốc và có thể nộp đơn ngay. AI đọc và đối chiếu sau khi nộp qua hàng chờ riêng. PDF chưa đọc, đang đọc hoặc đọc thất bại đều có thể gửi; không gọi AI trong giao dịch nộp đơn.

Đọc, sửa và xác nhận trước khi gửi là tùy chọn. Nếu gửi kèm `documentVersion` hiện tại và PDF đã xác nhận, đơn lưu cố định bản dữ liệu đã xác nhận. Nếu không có `documentVersion`, đơn chỉ dùng PDF gốc; worker dùng bản trích xuất máy bất biến, không lấy các chỉnh sửa/xác nhận xảy ra sau khi nộp. Đối chiếu JD và so sánh nhóm trước khi ứng tuyển vẫn cần dữ liệu đã xác nhận.

Thư viện hỗ trợ nhiều PDF, đổi tên và đặt mặc định. Đổi nội dung PDF bằng cách tải file mới. Khi AI không hoạt động, PDF vẫn được giữ, vẫn nộp được và HR vẫn xem PDF/chuyển vòng. Worker thử lại có giới hạn (mặc định 3 lượt); nếu thất bại, không gán điểm 0. HR có thể thử lại ở **Đánh giá AI → Phân tích ngay** khi dịch vụ phục hồi. Lỗi 5xx không trừ lượt đọc của PDF. Không chuyển PDF thành CV Builder.

Tiến độ độc lập với trạng thái tuyển dụng: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `SKIPPED`. Ứng viên xem qua `GET /api/candidate/applications/{id}/ai-status` (chỉ đơn của mình), HR qua `GET /api/recruiter/applications/{id}/ai-status`. Hai endpoint đặt `Cache-Control: no-store`. Dữ liệu AI đọc sau khi nộp được hiển thị rõ là chưa được ứng viên xác nhận.

## Lịch sử và đóng tính năng cũ

CV web cũ nằm trong mục **CV tạo trước đây · Chỉ xem**. HR và ứng viên vẫn mở được đơn cũ và snapshot CV. Route `/cv-builder` chuyển về thư viện PDF và giữ ngữ cảnh công việc/document khi có. Trang Builder, form nhập vào Builder và các trợ lý viết/rà soát Builder được gỡ khỏi frontend.

`app.cv-builder.enabled=false` là cấu hình mặc định. Backend trả 410 cho tạo/sửa/xóa/đặt mặc định CV web, trợ lý viết/rà soát Builder, tạo đối chiếu web và nộp đơn dùng CV web. GET lịch sử được giữ. Các service/DTO cũ còn phục vụ dữ liệu lịch sử và kiểm thử tương thích; không xóa bảng hay chuyển đổi hàng loạt dữ liệu cũ. Kiểm thử lịch sử bật cấu hình legacy trong database thử nghiệm riêng, đồng thời kiểm tra rõ chế độ đóng.

## Đối chiếu PDF

- `GET /api/candidate/jobs/{jobId}/match/pdf?documentId=...`
- `POST /api/candidate/jobs/{jobId}/match/pdf` với `{documentId, documentVersion, force?}`.
- `GET /api/candidate/jobs/{jobId}/benchmark/pdf?documentId=...`.

Migration V23 tạo cache `recruitment.candidate_pdf_job_matches`, khóa theo ứng viên/công việc/PDF. Khóa ngoại kép kiểm tra tài liệu thuộc ứng viên. Cache kiểm tra phiên bản xác nhận và fingerprint nội dung CV/JD. Bỏ xác nhận, sửa dữ liệu hoặc sửa JD khiến cache cũ không được sử dụng. Kết quả AI phải đủ tiêu chí và có trích dẫn hợp lệ. Họ tên/email/điện thoại, toàn bộ văn bản PDF và metadata trích xuất không được đưa vào yêu cầu đánh giá. Worker có thể tái sử dụng kết quả đối chiếu nếu khớp đúng nội dung đơn đã gửi.

## Kiểm tra sau thay đổi

1. Tải PDF có chữ hoặc scan; đọc, sửa và xác nhận cạnh PDF gốc.
2. Với PDF chưa xác nhận, đối chiếu trước khi ứng tuyển bị chặn nhưng gửi đơn vẫn thành công. Thử đủ trạng thái UPLOADED/PROCESSING/FAILED/PARSED.
3. Đối chiếu đúng PDF/phiên bản; xem trích dẫn và phần so sánh nhóm (chỉ có thống kê khi đủ dữ liệu).
4. Sửa dữ liệu đã đọc; kết quả cũ không được dùng cho bản mới.
5. Gửi PDF đã xác nhận; HR xem file gốc, dữ liệu và đánh giá. Sửa bản trong thư viện không đổi đơn đã gửi.
6. Mở CV web/đơn cũ; vẫn xem được. Gọi API tạo CV cũ bị từ chối và đường dẫn Builder chuyển về thư viện.
7. Tắt dịch vụ AI, gửi PDF: đơn lưu ngay, không có điểm, HR vẫn đọc PDF và chuyển vòng. Bật lại dịch vụ, worker/HR thử lại để bổ sung kết quả; đơn gốc không đổi.
