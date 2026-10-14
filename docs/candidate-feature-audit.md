# Rà soát tính năng ứng viên

Ngày rà soát: 13/10/2026. Kiểm tra source hiện có, chạy lại build/test và dùng một tài khoản/CV giả riêng cho kiểm thử trình duyệt. Không suy ra chức năng đã hoàn thành chỉ từ giao diện.

| Nhóm | Hiện trạng | Chi tiết |
|---|---|---|
| Tài khoản | Đã có luồng thật | Đăng ký, đăng nhập, đăng xuất, phiên và phân quyền CANDIDATE; chưa đổi/quên mật khẩu. |
| Onboarding/hồ sơ | Đã lưu PostgreSQL | Khảo sát 3 bước, lưu tiến độ, bỏ qua/hoàn tất; sửa thông tin cá nhân, kỹ năng, định hướng, kinh nghiệm và hình thức làm việc. |
| Tìm và xem việc | API thật; đã bỏ chế độ mẫu giao diện | Khách được xem danh sách/chi tiết; tìm kiếm, phòng ban, kinh nghiệm, hình thức, lương, sắp xếp và tải thêm. Chỉ lấy tin đang công khai, chưa hết hạn và phòng ban hoạt động. |
| Quản lý CV | Đã có luồng thật | Tạo nhiều CV, lưu nháp, mở lại, sửa, hoàn tất, mặc định, xóa; chặn xóa CV đã dùng nộp đơn; kiểm tra phiên bản. Preview chung HR/ứng viên, sáng/tối và in/lưu PDF từ trình duyệt. |
| Trường CV | Đã nối lưu/preview | Giới thiệu, kỹ năng tags, ngoại ngữ, học vấn/GPA, kinh nghiệm, dự án/thời gian/công nghệ, chứng chỉ/link, giải thưởng, hoạt động. Gợi ý vị trí, trường, kỹ năng và đồng bộ từ profile. |
| AI diễn đạt CV | Đã nối API | Viết rõ hơn, rút gọn, gạch đầu dòng cho giới thiệu/kinh nghiệm/dự án; duyệt, áp dụng, hoàn tác. Groq → Gemini. |
| AI rà soát/hoàn thiện CV | Đã nối API và thử trình duyệt | Rà soát theo job hoặc nội dung chung, căn cứ CV/JD, câu hỏi làm rõ, trả lời, đề xuất trước/sau, áp dụng/hoàn tác/lưu/mở lại. Chặn đề xuất cũ khi sửa CV/job/answer. |
| Ứng tuyển | Đã lưu PostgreSQL | Chọn CV READY của chính mình, thư giới thiệu tùy chọn, kiểm tra phiên bản, chống nộp trùng, chặn tin đóng/hết hạn; chụp snapshot CV/JD và ghi lịch sử. |
| Theo dõi đơn | Đã có luồng thật | Danh sách, lọc trạng thái, phân trang, chi tiết, lịch sử và bản CV/JD đã nộp. Chưa có API/nút để ứng viên tự rút đơn. Nhãn WITHDRAWN không đồng nghĩa đã có thao tác rút. |
| AI tóm tắt JD | Đã có API/cache | Tóm tắt trách nhiệm, bắt buộc/ưu tiên, lưu ý và căn cứ; có Groq → Gemini dự phòng, kiểm chứng căn cứ và cache theo nội dung JD. |
| AI CV–job | Đã hoàn thiện luồng chính | Chọn CV READY, điểm tổng, tiêu chí, căn cứ, thiếu bằng chứng và gợi ý bổ sung; có radar/thanh ngang. Cache theo ứng viên/job/CV, phiên bản và hash nội dung/quan hệ JD. Nối sửa CV → lưu → đối chiếu lại → chọn đúng CV ứng tuyển. Có kiểm chứng quote, giới hạn gọi, dự phòng và xử lý lỗi; xem candidate-ai-matching.md. |
| AI tự phân tích đơn | Đã có worker/database/API | Đơn mới được đưa vào hàng đợi nguyên tử, dùng snapshot bất biến; dùng lại kết quả cùng CV/JD, retry có giới hạn, phục hồi lease. Ứng viên xem tiến độ/điểm/tóm tắt của mình; HR dùng báo cáo hiện có. Không tự thay đổi trạng thái tuyển dụng. |
| So sánh CV với nhóm ứng tuyển | Đã có thống kê thật + UI | Phân vị, trung vị tổng/từng kỹ năng và ưu tiên cải thiện; cùng job/JD/model/cách chấm. Ít nhất 10 hồ sơ khác, từng kỹ năng ít nhất 5 hồ sơ có căn cứ. Không lộ CV/điểm cá nhân người khác, không dự báo xác suất trúng tuyển. Xem candidate-ai-benchmark.md. |
| Việc làm đã lưu | Mới trạng thái giao diện | DemoProvider dùng useState, không database/localStorage, không theo tài khoản. F5 mất dữ liệu; đổi tài khoản cùng phiên có thể còn trạng thái cũ. |
| Upload CV có sẵn | Đã có luồng PDF thật | Lưu PDF riêng tư tối đa 10MB/10 trang, AI trích xuất + mục bổ sung, đối chiếu bản gốc, tạo CV mới để sửa/lưu. Ứng tuyển chọn PDF gốc hoặc CV trên hệ thống; HR xem đúng bản nộp. Cache, retry có giới hạn; xem cv-pdf-import.md. Chưa hỗ trợ DOCX. |
| Cài đặt | Chủ yếu placeholder | Thông tin tài khoản có thật; đổi mật khẩu, thông báo và quyền riêng tư ghi SẮP CÓ. |
| Tính năng nâng cao | Chưa triển khai | Chat về JD, phỏng vấn AI/video thích ứng, giám sát gian lận, Skill Passport, gom bằng chứng GitHub, xác minh kỹ năng/chứng chỉ thực tế và theo dõi roadmap học tập. |

## Điểm phát hiện và điều chỉnh trong lượt rà soát

1. `analyzeJobMatch` trước đây dùng timeout frontend mặc định 15 giây, trong khi AI có thể xử lý 45 giây và Java chờ 60 giây. Đã đặt riêng timeout 65 giây cho request này. Việc này tránh ngắt sớm phía giao diện, không chữa lỗi/hạn mức nhà cung cấp.
2. Đã sửa dòng quảng bá CV ở profile từ “Gợi ý AI sắp có” sang mô tả tính năng AI hiện có.
3. Test danh mục vị trí còn kỳ vọng 401/403 trong khi controller/service/security hiện công khai danh mục. Đã đồng bộ test với hợp đồng API hiện tại; các kiểm tra quyền truy cập CV riêng vẫn giữ nguyên.
4. Module `credential-verification.ts` hiện nhận diện domain/loại liên kết. Nhận diện tên nền tảng không phải xác minh chứng chỉ thuộc ứng viên, còn hiệu lực hoặc là bằng chứng kỹ năng. Không tính việc này là một chức năng xác minh đã hoàn thành.
5. Điểm CV–job là mức phù hợp theo bằng chứng trong CV, không phải xác suất đậu tuyển dụng. Chưa có hệ thống kiểm chứng dự án/GitHub/bài test/phỏng vấn.

## Bằng chứng kiểm tra

- Frontend build thành công, 17 tệp kiểm thử qua. Lint còn cảnh báo có sẵn tại TopCandidatesWidget.
- 31 integration test PostgreSQL qua trên database riêng: đăng ký, onboarding, public jobs, CV, quyền sở hữu/CSRF, snapshots, nộp đơn và trợ lý CV AI.
- 42 kiểm thử Python viết/rà soát CV, matching và summary qua; kiểm thử Java trường CV và trợ lý viết CV qua trước đó.
- AI thật đã trả kết quả cho rà soát có JD, rà soát chung và soạn lại từ câu trả lời với dữ liệu giả. Có phát hiện phản hồi sai cấu trúc/timeout trong quá trình thử, đã siết prompt, target và trích dẫn; vẫn cần duy trì khả năng báo lỗi/thử lại khi nhà cung cấp không ổn định.
- Trình duyệt: tạo nhận xét thật, trả lời câu hỏi, đề xuất đúng dạng CV, áp dụng chỉ đúng dự án, preview cập nhật, hoàn tác, lưu, tải lại giữ nguyên nội dung. Sửa vị trí khiến đề xuất cũ bị khóa. Màn hình 390px không tràn ngang, đã trả viewport về mặc định.

## Ưu tiên tiếp theo

1. Lưu việc làm vào database theo tài khoản, có API thêm/xóa/danh sách.
2. Theo dõi quota/độ ổn định nhà cung cấp trong demo; luồng AI CV–job và dự phòng đã được bổ sung.
3. Cho ứng viên rút đơn với điều kiện trạng thái, lịch sử và bảo vệ phiên bản.
4. Hoàn thiện vận hành PDF (vision dự phòng, lưu trữ/xóa), thông báo và các AI nâng cao; luồng nhập PDF cơ bản đã có.

## Cập nhật hoàn thiện AI CV–job

Xem [chi tiết triển khai và kiểm thử](candidate-ai-matching.md). Đã thêm migration V18, kiểm chứng quote và cache đầy đủ quan hệ JD, dự phòng Groq–Gemini cho matching/summary và nối CV Builder với bước đối chiếu/ứng tuyển. 31 integration tests PostgreSQL qua, trong đó 5 test mới dành cho matching. Cả Groq và Gemini flash-lite đã trả kết quả hợp lệ cho dữ liệu giả.

## Cập nhật tự phân tích và so sánh ẩn danh

Xem [triển khai V19 và nghiệm thu](candidate-ai-benchmark.md). 28 integration tests liên quan qua trên database riêng, 42 Python tests và 18 tệp frontend qua. Đã nộp một CV giả có nhãn kiểm thử trên local: tự phân tích hoàn tất, tái sử dụng kết quả matching thật 85/100, trạng thái đơn giữ SUBMITTED. Dữ liệu thật chưa đủ nhóm so sánh nên không hiển thị phân vị; trạng thái đủ mẫu đã kiểm tra bằng fixture riêng, không tạo giả hồ sơ để nâng số lượng demo.
