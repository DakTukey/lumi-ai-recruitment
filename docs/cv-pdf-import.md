# Nhập CV PDF, đối chiếu và chọn bản ứng tuyển

Cập nhật 14/10/2026.

## Luồng sử dụng

1. CV Builder → **Nhập từ PDF vào CV mới**. Chọn PDF tối đa 10 MB, 10 trang, không mã hóa.
2. Bấm **Lưu PDF và đọc bằng AI** sau khi đọc thông báo gửi nội dung tới nhà cung cấp AI. File gốc được lưu riêng trước khi phân tích.
3. Đối chiếu PDF gốc với dữ liệu AI trích xuất; xem cảnh báo và văn bản theo trang. Nội dung ngoài mẫu được giữ trong **Mục bổ sung**.
4. Xác nhận kiểm tra, mở CV mới trong tab riêng. Không ghi đè CV đang soạn. Sửa thông tin rồi lưu nháp hoặc hoàn tất; lúc này mới tạo bản ghi CV.
5. Khi ứng tuyển với CV hoàn tất có PDF nguồn, chọn **CV trên hệ thống** hoặc **PDF gốc**. HR xem đúng bản đã chọn. Bản gốc không chứa các chỉnh sửa trong CV Builder.

Trình xem dùng Mozilla PDF.js, tải khi cần, dựng trang trên canvas với nút chuyển trang. Dùng chung cho đối chiếu, CV Builder, màn hình ứng tuyển và HR; không phụ thuộc plugin PDF của trình duyệt. Frontend yêu cầu Node >=22.13.

## Dữ liệu và quyền truy cập

Migration V20 tạo `candidate.resume_documents` (file BYTEA riêng tư, hash, trạng thái, kết quả parse, lease và số lần thử). `candidate.resumes` thêm `source_document_id` và `extra_sections` JSONB. `recruitment.applications` thêm `submission_format` và `source_document_id`.

Chủ sở hữu mới được xem/quản lý tài liệu. HR/admin chỉ lấy PDF qua đơn đã nộp dạng ORIGINAL_PDF; không truy cập thư viện upload của ứng viên. Các route file yêu cầu đăng nhập, trả `no-store`, MIME PDF và chỉ cho nhúng cùng nguồn. Những response khác giữ X-Frame-Options DENY.

File gốc và kết quả parse thành công bất biến. Nếu nộp PDF, snapshot dùng chính kết quả đọc của PDF đó, không dùng nội dung đã sửa trong Builder. Worker đánh giá đơn sử dụng snapshot này. `extraSections` được đưa vào ngữ cảnh AI.

## Đọc PDF và phục hồi lỗi

- Kiểm tra cấu trúc PDF, số trang, mật khẩu và giới hạn văn bản trước khi gọi AI.
- PDF có chữ đơn giản: trích chữ cục bộ rồi Gemini → Groq dự phòng.
- PDF ít chữ/scan hoặc có dấu hiệu nhiều cột: gửi PDF tới Gemini để đọc bố cục.
- Giữ các trường ngoài mẫu; không tự bịa tháng nếu chỉ có năm. Giá trị thời gian nguồn được giữ lại để người dùng sửa.
- Cùng file/cùng người dùng tái sử dụng tài liệu; kết quả đã đọc được dùng lại, không gọi AI lần nữa.
- Lỗi vẫn giữ PDF, không tự tạo CV. Cho đọc lại có giới hạn: tối đa 3 lần, lease/cooldown 90 giây, 2 lượt đọc đồng thời mỗi tiến trình.
- Tối đa 50 file mỗi tài khoản. AI có ngân sách xử lý 45 giây; frontend chờ 65 giây.

API: `GET/POST /api/candidate/cv-documents`, `GET /{id}`, `POST /{id}/parse`, `GET /{id}/file`; HR dùng `GET /api/recruiter/applications/{id}/cv-file`.

## Kiểm tra

- 20 integration tests PostgreSQL liên quan PDF/CV/ứng tuyển/AI qua trên database riêng; sau sửa header, chạy lại 3 test PDF qua.
- 50 Python tests, 19 tệp frontend tests, frontend build qua. Lint còn cảnh báo TopCandidatesWidget có sẵn.
- PDF giả 1 trang đã được đọc bằng AI thật (~20,5 giây), giữ cả Research Publications và Volunteering. Lưu/mở lại CV và tái sử dụng kết quả thành công; provider đầu lỗi, provider dự phòng trả kết quả.
- Test phân quyền, CSRF, cache, bất biến nguồn, lỗi parser, nộp bản gốc và snapshot đánh giá riêng so với CV đã sửa.
- Trình duyệt: PDF gốc đã render cạnh preview, CV mới mở tab riêng đúng dữ liệu. Kiểm tra màn hình 390px không tràn ngang. Dependency audit sau cập nhật source-map-js: 0 cảnh báo.

## Giới hạn hiện tại

Chưa hỗ trợ DOCX. Nhận diện bố cục là heuristic, AI vẫn có thể đọc thiếu/sai; người dùng cần đối chiếu. PDF scan chỉ có Gemini, chưa có nhà cung cấp vision dự phòng. Chưa nghiệm thu scan bằng API thật. Chưa có provenance/confidence cho từng field; có PDF gốc và văn bản theo trang. Upload/parse hiện là request có giới hạn thời gian và trạng thái lưu DB, chưa là hàng đợi nền bền vững. Chưa có UI xóa/lưu trữ tài liệu; BYTEA phù hợp demo, cần kế hoạch object storage/retention khi tăng tải.
