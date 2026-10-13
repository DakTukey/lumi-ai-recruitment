# Chức năng HR — cập nhật 10/10/2026

Phạm vi: role `RECRUITER` tại `/recruiter`. `COMPANY_ADMIN` cũng được truy cập không gian này; chức năng quản trị riêng được mô tả trong [giao diện Admin](admin-interface.md).

Trạng thái **Thật** nghĩa là đã kết nối tài khoản/API/database. **Mẫu UI** nghĩa là có giao diện và thao tác trong phiên, chưa dùng dữ liệu nghiệp vụ thật. **Chưa triển khai** nghĩa là chưa có chức năng hoàn chỉnh; schema hoặc thông báo hướng dẫn không được tính là hoàn thành.

## Danh sách hiện tại

| Nhóm | Chức năng | Trạng thái và giới hạn |
| --- | --- | --- |
| Tài khoản | Đăng nhập, đăng xuất và giới hạn quyền HR | Thật |
| Tổng quan | Thống kê tin đã công khai; xem tin và mở chi tiết | Thật; thống kê công khai loại nháp/đóng/ẩn/hết hạn |
| Tổng quan | Tổng số hồ sơ và hồ sơ chờ xem xét | Thật; thống kê toàn bộ công ty từ API, lỗi không thay bằng số mẫu |
| Tin tuyển dụng | Tìm tên/kỹ năng, lọc phòng ban/trạng thái và phân trang | Thật; đọc cả nháp/đang tuyển/đã đóng qua API nội bộ |
| Tin tuyển dụng | Tạo tin thủ công, xem trước và lưu nháp | Thật; nội dung, số lượng tuyển, lương, hạn, kỹ năng và tiêu chí lưu database |
| Tin tuyển dụng | Tạo phòng ban trong form | Thật; lưu riêng ngay khi tạo |
| Tin tuyển dụng | Sửa bản nháp hoặc tin đã đóng | Thật; tin đang tuyển cần đóng trước khi sửa |
| Tin tuyển dụng | Đăng, đóng và mở lại tin | Thật; có xác nhận và kiểm tra dữ liệu/hạn/phiên bản |
| Tin tuyển dụng | Xem nội dung, tiêu chí và lịch sử chỉnh sửa | Thật; lịch sử ghi cùng transaction với thay đổi tin |
| Tạo tin với AI | Nhập JD bằng văn bản/file PDF, DOCX, MD, TXT | Mẫu UI; có chọn file và kiểm tra cơ bản, chưa upload hoặc đọc/trích xuất nội dung |
| Tạo tin với AI | Cung cấp brief để AI soạn JD | Mẫu UI; chưa gọi AI tạo nội dung |
| Ứng viên theo job | Tab Ứng viên, lọc tên/vòng, phân trang và số hồ sơ | Thật; khóa đúng job, số tổng không chỉ tính trang đang xem |
| Ứng viên theo job | Mở CV, quay lại job; mở danh sách tổng thể đã lọc job | Thật; cùng API và CV snapshot; mở đánh giá đã lưu hoặc phân tích mới |
| Tổng hợp AI theo job | Tổng số hồ sơ và số chưa phân tích | Thật; đếm từng hồ sơ có kết quả đã lưu, không đếm lặp khi phân tích lại |
| Tổng hợp AI theo job | Nhóm ưu tiên xem với điểm và lý do; xem tất cả | Thật; tối đa 5 hồ sơ có kết quả gần nhất, điểm giảm dần; chỉ các vòng đã nộp/xem xét/phỏng vấn; không ẩn danh sách đầy đủ |
| Hồ sơ ứng tuyển | Danh sách toàn bộ job, tìm tên/email/vị trí, lọc job/vòng | Thật; phân trang và tải lại qua API nội bộ |
| Hồ sơ ứng tuyển | Các ô Tất cả/Đã nộp/Đang xem xét/Phỏng vấn/Offer/Đã tuyển/Đã loại/Đã rút | Thật; thống kê theo job trước khi lọc tên/vòng, không phụ thuộc phân trang |
| Hồ sơ ứng tuyển | Xem CV, thư ứng tuyển, JD lúc nộp và lịch sử ban đầu | Thật; đầy đủ CV có cấu trúc và snapshot JD bất biến; chưa nhận/tải file PDF |
| Hồ sơ ứng tuyển | Ghi chú nội bộ | Thật; lưu người viết/thời gian, chống gửi trùng; chỉ HR/Admin đọc, chỉ thêm |
| Hồ sơ ứng tuyển | Chuyển vòng, loại hồ sơ và lịch sử có lý do/người thực hiện/thời gian | Thật; tuần tự, lý do bắt buộc khi loại; version/khóa chống ghi đè, terminal khóa; không gửi email |
| Đánh giá AI trong hồ sơ | Cột đánh giá và tab Đánh giá AI; tổng hợp CV–JD, bằng chứng, giải thích điểm, câu hỏi kiểm chứng | Đã nối API Java → Python → Gemini và lưu V11–V12; cần cấu hình khóa Gemini để gọi mô hình thật. Bằng chứng chỉ từ CV snapshot |
| Đánh giá AI trong hồ sơ | Chưa phân tích/đang phân tích/có kết quả/lỗi | Thật; có phân tích lại, thời gian chờ hữu hạn, giữ kết quả cũ khi lỗi; chưa có kết quả không quy thành 0 điểm |
| Hồ sơ HR | Xem tên/email/role tài khoản | Thật, lấy từ phiên đăng nhập |
| Hồ sơ HR | Sửa chức danh, phòng ban, mã nhân viên, điện thoại và URL ảnh | Thật; API xem/lưu hồ sơ của chính mình, phòng ban liên kết ID, kiểm tra mã nhân viên trùng và phiên bản chống ghi đè; URL ảnh, chưa upload file |

## Những phần chưa hoàn thành

- Ứng viên rút đơn thật chưa triển khai. HR đã ghi chú/chuyển vòng/lưu lịch sử thật bằng V10; không đặt trạng thái Đã rút.
- Điểm phù hợp từng kỹ năng 0–100% và trọng số riêng đã có trong luồng thật; chưa phải điểm năng lực đã xác minh hoặc độ tin cậy của bằng chứng.
- Matching CV–JD, giải thích, roadmap và tổng hợp kết quả đã triển khai; chưa thử Gemini thật do thiếu khóa. Xác minh claim, thu thập GitHub/bài test/phỏng vấn và Skill Passport chưa có.
- AI đọc file JD và AI soạn JD; upload, nhận dạng và kiểm tra file phía server.
- Lịch phỏng vấn, email/thông báo, quản lý offer thật và báo cáo tuyển dụng theo thời gian.
- Phỏng vấn AI video/thích ứng, báo cáo kỹ thuật, ghi nhận tín hiệu nghi vấn và xem bằng chứng theo timestamp.
- Upload ảnh HR bằng file; chức năng xóa tin chưa có. Hồ sơ HR đã xem/lưu thật qua API.

## Luồng sử dụng

**Tin tuyển dụng → mở job → Ứng viên hoặc Tổng hợp AI → mở hồ sơ → CV / Đánh giá AI / Ghi chú / Lịch sử → quay lại job.**

**Hồ sơ ứng tuyển** giữ vai trò danh sách tổng thể. Nút Xem tất cả trong job mở danh sách này và chọn sẵn job. Nhóm ưu tiên không thay thế danh sách đầy đủ; hồ sơ chưa đánh giá, offer, đã tuyển, đã loại và đã rút vẫn xem được. AI không tự chuyển vòng hoặc loại hồ sơ.

## Ưu tiên triển khai tiếp

Kế hoạch chi tiết, schema/API dự kiến và điều kiện nghiệm thu: [Luồng ứng tuyển thật và HR](recruiter-next-step-plan.md).

1. Hoàn thành luồng ứng viên rút đơn và kiểm tra cạnh tranh với HR (phần còn lại của đợt 2).
2. Cấu hình Gemini và nghiệm thu chất lượng matching bằng bộ CV/JD có đáp án đối chiếu; kiểm tra chi phí, độ ổn định và giới hạn tải trước khi dùng rộng rãi.
3. JD nhập từ file/soạn bằng AI, lịch phỏng vấn và thông báo; upload ảnh HR nếu cần.
4. Các chức năng xác minh nâng cao, Skill Passport và phỏng vấn video.

Chi tiết: [giao diện HR](recruiter-interface.md), [API tạo tin](recruiter-job-api.md), [vòng đời tin](recruiter-job-lifecycle.md), [ba cách tạo tin](recruiter-job-create-ui.md), [database HR/jobs](recruitment-catalog-and-hr.md).

Đợt 1 đã triển khai: [API ứng tuyển và snapshot V9](applications-api.md). Chế độ mẫu vẫn riêng biệt; không fallback sang mẫu khi API thật lỗi.

Đợt 2 phần HR đã triển khai: [Ghi chú, chuyển vòng và lịch sử V10](hr-application-review.md).

Đợt AI đã sửa và kiểm thử: [Đánh giá CV–JD và tổng hợp ứng viên V11–V12](hr-ai-assessment.md).

Hồ sơ HR đã triển khai: [API và giao diện hồ sơ nhân sự V13](hr-profile.md).
