# Nhập CV PDF, đối chiếu và chọn bản ứng tuyển

> Luồng hiện tại chỉ nhận CV PDF cho đối chiếu và đơn mới. Tạo/sửa CV web đã ngừng; phần mô tả Builder bên dưới là tài liệu lịch sử. Xem [luồng PDF hiện tại](pdf-only-candidate-cv.md).

Cập nhật 19/10/2026.

## PDF riêng không cần chuyển thành CV Builder

Trong **CV của tôi**, ứng viên có thể tải PDF riêng lên, đọc và xác nhận thông tin để dùng khi ứng tuyển. File xuất hiện trong thư viện bên cạnh CV tạo trên web, có nhãn **PDF riêng**, xem trước, đổi tên và đặt mặc định. Tên hiển thị có thể đổi; nội dung file và tên file gốc không đổi. Nút **Nhập PDF vào CV trên web** bên dưới vẫn dành cho người muốn AI điền dữ liệu vào Builder.

Màn hình ứng tuyển chọn một CV trên web đã hoàn tất hoặc một PDF riêng đã tải lên. PDF riêng cần được AI đọc và ứng viên kiểm tra, sửa, xác nhận thông tin; không cần tạo CV Builder. Khi gửi, đơn giữ PDF gốc, tên hiển thị và bản dữ liệu đã xác nhận tại thời điểm nộp. HR xem PDF gốc và thông tin đã xác nhận; AI chấm trong hàng đợi sau khi đơn được lưu. Nếu bước chấm lỗi, đơn đã gửi vẫn tồn tại và có thể thử chấm lại.

Trong chi tiết đơn, HR mở **Thông tin trích từ PDF và xác nhận của ứng viên** để xem các nhóm trường chuẩn, mục khác, cảnh báo, nguồn và thời điểm xác nhận. Endpoint chỉ dành cho HR: `GET /api/recruiter/applications/{id}/cv-extraction`.

Migration V21 cho phép đơn PDF có `resume_id` rỗng, kiểm tra PDF thuộc ứng viên bằng khóa ngoại kép, đồng thời lưu tên hiển thị và PDF mặc định. V22 bổ sung bản sửa, phiên bản và thời điểm xác nhận; snapshot của đơn mới giữ cả dữ liệu đã xác nhận để đánh giá. Đơn PDF cũ vẫn có thể đọc sau nộp theo quy trình trước V22.

## Luồng sử dụng

1. CV Builder → **Nhập từ PDF vào CV mới**. Chọn PDF tối đa 10 MB, 10 trang, không mã hóa.
2. Bấm **Lưu PDF và đọc bằng AI** sau khi đọc thông báo gửi nội dung tới nhà cung cấp AI. File gốc được lưu riêng trước khi phân tích.
3. Đối chiếu PDF gốc với dữ liệu AI trích xuất; xem cảnh báo và văn bản theo trang. Nội dung ngoài mẫu được giữ trong **Mục bổ sung**.
4. Sửa các trường, lưu hoặc xác nhận thông tin, rồi mở CV mới trong tab riêng. Không ghi đè CV đang soạn. Sửa thông tin rồi lưu nháp hoặc hoàn tất; lúc này mới tạo bản ghi CV.
5. Khi ứng tuyển, chọn CV trên web đã hoàn tất hoặc PDF riêng đã xác nhận. HR xem đúng bản đã chọn. Chỉnh sửa dữ liệu trích xuất không làm thay đổi bố cục/nội dung PDF gốc.

Trình xem dùng Mozilla PDF.js, tải khi cần, dựng trang trên canvas với nút chuyển trang. Dùng chung cho đối chiếu, CV Builder, màn hình ứng tuyển và HR; không phụ thuộc plugin PDF của trình duyệt. Frontend yêu cầu Node >=22.13.

## Dữ liệu và quyền truy cập

Migration V20 tạo `candidate.resume_documents` (file BYTEA riêng tư, hash, trạng thái, kết quả parse, lease và số lần thử). `candidate.resumes` thêm `source_document_id` và `extra_sections` JSONB. `recruitment.applications` thêm `submission_format` và `source_document_id`.

Chủ sở hữu mới được xem/quản lý tài liệu. HR/admin chỉ lấy PDF qua đơn đã nộp dạng ORIGINAL_PDF; không truy cập thư viện upload của ứng viên. Các route file yêu cầu đăng nhập, trả `no-store`, MIME PDF và chỉ cho nhúng cùng nguồn. Những response khác giữ X-Frame-Options DENY.

File gốc và kết quả parse thành công bất biến. Nếu nộp PDF, snapshot dùng bản thông tin đã được ứng viên xác nhận, độc lập với nội dung trong Builder. Worker đánh giá đơn sử dụng snapshot này. `extraSections` được đưa vào ngữ cảnh AI.

## Đọc PDF và phục hồi lỗi

- Kiểm tra cấu trúc PDF, số trang, mật khẩu và giới hạn văn bản trước khi gọi AI.
- Khi cấu hình `CV_PROCESSING_PROVIDER=ollama`, PDF có chữ được trích chữ cục bộ rồi Qwen đọc; PDF scan/nhiều cột được dựng ảnh trang rồi Qwen đọc. Không tự chuyển sang API ngoài khi local lỗi.
- Cấu hình cloud có thể dùng Gemini/Groq cho chữ và Gemini cho ảnh.
- Giữ các trường ngoài mẫu; không tự bịa tháng nếu chỉ có năm. Giá trị thời gian nguồn được giữ lại để người dùng sửa.
- Cùng file/cùng người dùng tái sử dụng tài liệu; kết quả đã đọc được dùng lại, không gọi AI lần nữa.
- Lỗi vẫn giữ PDF, không tự tạo CV. Cho đọc lại có giới hạn: tối đa 3 lần, lease 10 phút, 2 lượt đọc đồng thời mỗi tiến trình.
- Tối đa 50 file mỗi tài khoản. Local AI có ngân sách xử lý 250 giây; backend và frontend chờ 270 giây cho bước đọc.

API: `GET/POST /api/candidate/cv-documents`, `GET /{id}`, `POST /{id}/parse`, `GET /{id}/file`; HR dùng `GET /api/recruiter/applications/{id}/cv-file`.

## Kiểm tra (19/10/2026)

- 6 kiểm thử tích hợp PostgreSQL trên database riêng: quyền truy cập, CSRF, cache, xác nhận bắt buộc, kiểm tra dữ liệu, xung đột phiên bản, giữ nguyên PDF và snapshot khi sửa CV sau nộp. Không có test bị bỏ qua.
- 69 Python tests qua; các ca mới kiểm tra nguồn theo trang, không tin cờ `verified` từ model, giữ năm chưa có tháng và không yêu cầu model sinh nguồn cho PDF có chữ.
- 3 tệp frontend tests liên quan import, sửa/chuyển mục và trợ lý CV qua; frontend build qua. Lint còn cảnh báo TopCandidatesWidget có sẵn.

## Giới hạn hiện tại

Chưa hỗ trợ DOCX. Nhận diện bố cục là heuristic, AI vẫn có thể đọc thiếu/sai; người dùng cần đối chiếu. PDF scan dùng Qwen vision khi cấu hình local; nguồn không có lớp chữ cần đối chiếu bằng mắt. Không có chỉ số độ tin cậy được hiệu chuẩn cho từng trường. Bản trích xuất cũ có thể chưa có nguồn theo trường. Upload/parse hiện là request có giới hạn thời gian và trạng thái lưu DB, chưa là hàng đợi nền bền vững. Chưa có UI xóa/lưu trữ tài liệu; BYTEA phù hợp demo, cần kế hoạch object storage/retention khi tăng tải.

### Kiểm tra dữ liệu PDF trước khi ứng tuyển

- Với đơn mới gửi bằng PDF gốc, ứng viên cần đọc, kiểm tra và xác nhận thông tin trước khi gửi. Backend kiểm tra điều kiện này, kể cả khi gọi API trực tiếp.
- Thư viện CV → **Kiểm tra PDF** hoặc ngay màn hình ứng tuyển: PDF gốc nằm cạnh các trường có thể sửa; hỗ trợ thêm/xóa mục và chuyển Kinh nghiệm ↔ Dự án.
- Bản AI đọc nằm trong `parsed_content` và vẫn bất biến. Bản ứng viên sửa nằm trong `reviewed_content`, có `review_version` và `confirmed_at` (migration V22). Lưu bản sửa sẽ bỏ trạng thái xác nhận; cần xác nhận lại.
- Email, điện thoại, URL, giới hạn kích thước, khoảng thời gian và GPA dùng các quy tắc của CV builder. Lỗi chặn xác nhận; thông tin thiếu như công ty/trường là cảnh báo để đối chiếu. Dữ liệu không rõ không tự được bổ sung.
- Với PDF có chữ, thông tin liên hệ/nơi ở/giới thiệu không khớp nguồn được để trống và cảnh báo; mục bổ sung không khớp cần người dùng thêm lại từ PDF. Tên và mô tả mục công việc/học vấn chưa khớp được cảnh báo để kiểm tra, không coi là bằng chứng đã xác minh. Scan không có chữ không áp dụng cách lọc theo văn bản này.
- `sources` gồm đường dẫn trường, đoạn trích, trang và trạng thái kiểm tra đoạn trích. PDF có chữ không đưa trường nguồn vào schema sinh kết quả; Python tự tìm nguồn nguyên văn theo trang, tránh model phải sinh lại các câu trích. Với vision, giới hạn 12 nguồn ưu tiên (160 ký tự/nguồn) để kiểm soát thời gian; server bổ sung nguồn khi có lớp chữ và kiểm tra nguồn model cung cấp trên đúng trang. Một số trường có thể không có nguồn tự động. Với scan không có lớp chữ, nguồn chỉ là thông tin AI đề xuất cần kiểm tra bằng mắt. Khớp câu trích không chứng minh AI phân loại đúng trường.
- Nguồn luôn được ghi là **nguồn AI ban đầu**, vì việc chuyển/xóa/sửa mục có thể đổi thứ tự trường. Client không được thay nguồn, văn bản gốc hoặc cảnh báo máy trong API lưu bản sửa. PDF đã đọc trước phiên bản này có thể chưa có nguồn theo trường.
- Khi nộp, client gửi `documentVersion`; backend khóa và kiểm tra phiên bản, lưu nội dung đã xác nhận và nguồn vào snapshot của đơn. Đánh giá và màn hình HR dùng snapshot đó, không dùng bản sửa mới nhất của tài liệu. Đơn PDF cũ trước V22 tiếp tục quy trình đọc sau nộp để tương thích.
- API mới: `PUT /api/candidate/cv-documents/{id}/review` với `{ content, version, confirm }`; `confirm=false` lưu bản sửa, `confirm=true` kiểm tra và xác nhận. Chỉ chủ tài liệu có quyền, bắt buộc CSRF và đúng phiên bản.
